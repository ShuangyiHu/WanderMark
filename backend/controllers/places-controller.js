import { validationResult } from "express-validator";
import mongoose from "mongoose";

import HttpError from "../models/http-error.js";
import getCoorsForAddress from "../util/location.js";
import Place from "../models/place.js";
import User from "../models/user.js";

// Colorwalk: import color analysis and text embedding pipeline
import {
  analyzeImageColor,
  generateTextEmbedding,
  cosineSimilarity,
  adaptiveWeights,
} from "../util/color-service.js";

// ── Existing controller functions below — no lines changed ────────

export const getPlaceById = async (req, res, next) => {
  const placeId = req.params.placeId;
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Could not find the place. Please try again later.", 500),
    );
  }
  if (!place) {
    return next(
      new HttpError("No place was found for the provided place id.", 404),
    );
  }
  res.json({ place: place.toObject({ getters: true }) });
};

export const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.userId;
  let user;
  try {
    user = await User.findById(userId).populate("places");
  } catch (err) {
    return next(
      new HttpError("Could not find places. Please try again later.", 500),
    );
  }
  if (!user) {
    return next(
      new HttpError("No user was found for the provided user id.", 404),
    );
  }
  res.json({ places: user.places.map((p) => p.toObject({ getters: true })) });
};

export const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed. Please check your data.", 422),
    );
  }

  const { title, address, description } = req.body;

  let coordinates;
  try {
    coordinates = await getCoorsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const newPlace = new Place({
    title,
    description,
    address,
    coordinates,
    image: req.file.path,
    creatorId: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(
      new HttpError("Failed to create place. Please try again later.", 500),
    );
  }

  if (!user) {
    return next(new HttpError("Could not find user for the provided id.", 404));
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await newPlace.save({ session });
    user.places.push(newPlace);
    await user.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    return next(
      new HttpError("Failed to create place. Please try again later.", 500),
    );
  }

  // Main flow ends here — identical to v1
  res.status(201).json({ place: newPlace });

  // Colorwalk: run color analysis and text embedding in parallel after response is sent.
  //
  // Why setImmediate: pushes execution to the next event loop tick, guaranteeing
  // res.json() has fully flushed before the pipeline starts. The user never waits
  // for this work.
  //
  // Why Promise.allSettled over Promise.all: allSettled lets both tasks run to
  // completion independently. If OpenAI times out, color data still gets written,
  // and vice versa. Promise.all would short-circuit on the first failure.
  setImmediate(async () => {
    const [colorResult, embeddingResult] = await Promise.allSettled([
      analyzeImageColor(newPlace.image),
      generateTextEmbedding({
        title: newPlace.title,
        description: newPlace.description,
        address: newPlace.address,
      }),
    ]);

    // Collect only successful results — never overwrite existing fields with null
    const updates = {};

    if (colorResult.status === "fulfilled" && colorResult.value) {
      const { colorPalette, colorVector, isColorful, colorAnalyzedAt } =
        colorResult.value;
      Object.assign(updates, {
        colorPalette,
        colorVector,
        isColorful,
        colorAnalyzedAt,
      });
      console.log(
        `[colorwalk] Color OK for place ${newPlace._id}: ` +
          `isColorful=${isColorful}, palette=${colorPalette.map((s) => s.hex).join(", ")}`,
      );
    } else {
      console.log(
        `[colorwalk] Color SKIP for place ${newPlace._id}: ` +
          (colorResult.reason?.message ?? "no data returned"),
      );
    }

    if (embeddingResult.status === "fulfilled" && embeddingResult.value) {
      updates.textEmbedding = embeddingResult.value;
      console.log(
        `[colorwalk] Embedding OK for place ${newPlace._id}: dims=${embeddingResult.value.length}`,
      );
    } else {
      console.log(
        `[colorwalk] Embedding SKIP for place ${newPlace._id}: ` +
          (embeddingResult.reason?.message ?? "no data returned"),
      );
    }

    // Only write to DB if at least one pipeline succeeded
    if (Object.keys(updates).length > 0) {
      try {
        await Place.findByIdAndUpdate(newPlace._id, updates);
        console.log(
          `[colorwalk] DB update complete for place ${newPlace._id}. ` +
            `fields=${Object.keys(updates).join(", ")}`,
        );
      } catch (dbErr) {
        console.error(
          `[colorwalk] DB update failed for place ${newPlace._id}:`,
          dbErr.message,
        );
      }
    }
  });
};

export const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    throw new HttpError("Invalid inputs passed. Please check your data.", 422);
  }
  const placeId = req.params.placeId;
  const { title, description } = req.body;

  let updatedPlace;
  try {
    updatedPlace = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Could not find place. Please try again later.", 500),
    );
  }

  if (updatedPlace.creatorId.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  updatedPlace.title = title;
  updatedPlace.description = description;

  try {
    await updatedPlace.save();
  } catch (err) {
    return next(
      new HttpError("Could not update place. Please try again later.", 500),
    );
  }

  res.status(200).json({ place: updatedPlace.toObject({ getters: true }) });
};

export const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.placeId;
  let place;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    place = await Place.findById(placeId)
      .populate("creatorId")
      .session(session);
  } catch (err) {
    return next(
      new HttpError("Could not delete the place. Please try again later.", 500),
    );
  }

  if (!place) {
    return next(
      new HttpError("Could not find place with the provided id.", 404),
    );
  }

  if (place.creatorId.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401),
    );
  }

  try {
    await place.deleteOne({ session });
    place.creatorId.places.pull(place);
    await place.creatorId.save({ session });
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    return next(
      new HttpError("Could not delete the place. Please try again later.", 500),
    );
  }

  res.status(200).json({ message: "Place deleted" });
};

// ── Colorwalk: Phase 3 ────────────────────────────────────────────

/**
 * POST /api/places/search/color
 *
 * Accepts an uploaded image and returns places ranked by hybrid similarity:
 *   score = colorWeight * cosine(colorVector) + textWeight * cosine(textEmbedding)
 *
 * Weights are determined adaptively by the query image's isColorful flag:
 *   - colorful image  → 0.6 color + 0.4 text
 *   - muted image     → 0.2 color + 0.8 text
 *   - no color data   → 0.0 color + 1.0 text
 *
 * Query parameters:
 *   - userId (optional): restrict results to a specific user's places
 *   - threshold (optional): minimum score to include in results (default 0.4)
 *   - limit (optional): max results to return (default 10)
 */
export const searchByColor = async (req, res, next) => {
  const { userId, threshold = 0.4, limit = 10 } = req.query;

  // Step 1: analyze the query image — same pipeline as createPlace
  // We don't persist this data; it's used only for the query vector
  const [colorResult, embeddingResult] = await Promise.allSettled([
    analyzeImageColor(req.file.path),
    // For query-time we have no description text, so pass only what we have
    // from the optional body field `queryText`
    req.body.queryText
      ? generateTextEmbedding({
          title: req.body.queryText,
          description: "",
          address: "",
        })
      : Promise.resolve(null),
  ]);

  const queryColorData =
    colorResult.status === "fulfilled" ? colorResult.value : null;
  const queryTextEmbedding =
    embeddingResult.status === "fulfilled" ? embeddingResult.value : null;

  // If both pipelines failed we have nothing to search with
  if (!queryColorData && !queryTextEmbedding) {
    return next(
      new HttpError(
        "Could not extract any features from the uploaded image. Try a clearer photo.",
        422,
      ),
    );
  }

  // Step 2: determine adaptive weights based on query image quality
  const { colorWeight, textWeight } = adaptiveWeights(
    queryColorData?.isColorful ?? null,
  );

  // Step 3: fetch candidate places from MongoDB
  // Only retrieve places that have at least one vector to compare against.
  // Exclude the raw textEmbedding array from the response payload (large field).
  try {
    const filter = {
      $or: [
        { colorVector: { $exists: true, $not: { $size: 0 } } },
        { textEmbedding: { $exists: true, $not: { $size: 0 } } },
      ],
    };
    if (userId) filter.creatorId = userId;

    const candidates = await Place.find(filter).select(
      "title description address image coordinates colorPalette colorVector textEmbedding isColorful creatorId",
    );

    // Step 4: score each candidate
    const scored = candidates
      .map((place) => {
        let score = 0;
        let components = { color: 0, text: 0 };

        // Color similarity component
        if (
          colorWeight > 0 &&
          queryColorData?.colorVector &&
          place.colorVector?.length > 0
        ) {
          components.color = cosineSimilarity(
            queryColorData.colorVector,
            place.colorVector,
          );
          score += colorWeight * components.color;
        }

        // Text embedding similarity component
        if (
          textWeight > 0 &&
          queryTextEmbedding &&
          place.textEmbedding?.length > 0
        ) {
          components.text = cosineSimilarity(
            queryTextEmbedding,
            place.textEmbedding,
          );
          score += textWeight * components.text;
        }

        return { place, score, components };
      })
      .filter(({ score }) => score >= parseFloat(threshold))
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(limit));

    // Step 5: format response — strip textEmbedding and colorVector from output
    const results = scored.map(({ place, score, components }) => {
      const p = place.toObject({ getters: true });
      delete p.textEmbedding;
      delete p.colorVector;
      return {
        ...p,
        similarityScore: Math.round(score * 1000) / 1000,
        // Include score breakdown for transparency / debugging
        scoreBreakdown: {
          color: Math.round(components.color * 1000) / 1000,
          text: Math.round(components.text * 1000) / 1000,
          weights: { colorWeight, textWeight },
        },
      };
    });

    res.json({
      results,
      meta: {
        total: results.length,
        queryIsColorful: queryColorData?.isColorful ?? null,
        weightsUsed: { colorWeight, textWeight },
        queryPalette: queryColorData?.colorPalette?.map((s) => s.hex) ?? [],
      },
    });
  } catch (err) {
    return next(new HttpError("Color search failed. Please try again.", 500));
  }
};
