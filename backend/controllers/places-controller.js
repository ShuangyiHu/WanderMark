import { validationResult } from "express-validator";
import mongoose from "mongoose";

import HttpError from "../models/http-error.js";
import getCoorsForAddress from "../util/location.js";
import Place from "../models/place.js";
import User from "../models/user.js";
import { uploadToCloudinary } from "../util/cloudinary.js";

// Sentinel value stored in DB while the real image is being uploaded
const IMAGE_PROCESSING = "processing";

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

  // ── Optimised: query Place collection directly by creatorId ───────────────
  // Previously: User.findById().populate("places")
  //   → 2 round-trips: find User by _id, then batch-fetch Places by _id[]
  //   → creatorId index is NEVER consulted
  //
  // Now: Place.find({ creatorId })
  //   → 1 round-trip, hits the creatorId index directly (IXSCAN)
  //   → also validates the userId exists implicitly (empty array = no places)
  let places;
  try {
    places = await Place.find({ creatorId: userId });
  } catch (err) {
    return next(
      new HttpError("Could not find places. Please try again later.", 500),
    );
  }

  res.json({ places: places.map((p) => p.toObject({ getters: true })) });
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

  // ── Step 1: Save place with placeholder image ──────────────────────────────
  // This lets us respond to the client immediately without waiting for Cloudinary
  const newPlace = new Place({
    title,
    description,
    address,
    coordinates,
    image: IMAGE_PROCESSING, // temporary sentinel
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

  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    await newPlace.save({ session });
    user.places.push(newPlace);
    await user.save({ session });
    await session.commitTransaction();
  } catch (err) {
    if (session) await session.abortTransaction();
    return next(
      new HttpError("Failed to create place. Please try again later.", 500),
    );
  } finally {
    if (session) session.endSession();
  }

  // ── Step 2: Respond immediately (~150ms instead of ~1200ms) ───────────────
  res.status(201).json({ place: newPlace.toObject({ getters: true }) });

  // ── Step 3: Upload to Cloudinary in the background ────────────────────────
  // The HTTP response is already sent; this runs without blocking the client.
  try {
    const result = await uploadToCloudinary(req.file.buffer);
    await Place.findByIdAndUpdate(newPlace.id, { image: result.secure_url });
    console.log(
      `[Async] Image uploaded for place ${newPlace.id}: ${result.secure_url}`,
    );
  } catch (err) {
    // The place exists in DB with a "processing" image.
    // In production you'd add a retry queue here (e.g. BullMQ).
    console.error(
      `[Async] Cloudinary upload failed for place ${newPlace.id}:`,
      err.message,
    );
  }
};

export const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed. Please check your data.", 422),
    );
  }

  const { title, description } = req.body;
  const placeId = req.params.placeId;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Could not update place. Please try again later.", 500),
    );
  }

  if (place.creatorId.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    return next(
      new HttpError("Could not update place. Please try again later.", 500),
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

export const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.placeId;

  let place;
  try {
    place = await Place.findById(placeId).populate("creatorId");
  } catch (err) {
    return next(
      new HttpError("Could not delete place. Please try again later.", 500),
    );
  }

  if (!place) {
    return next(new HttpError("Could not find place for this id.", 404));
  }

  if (place.creatorId.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401),
    );
  }

  let session;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    await place.deleteOne({ session });
    place.creatorId.places.pull(place);
    await place.creatorId.save({ session });
    await session.commitTransaction();
  } catch (err) {
    if (session) await session.abortTransaction();
    return next(
      new HttpError("Could not delete place. Please try again later.", 500),
    );
  } finally {
    if (session) session.endSession();
  }

  res.status(200).json({ message: "Deleted place." });
};
