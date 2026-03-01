import { validationResult } from "express-validator";
import mongoose from "mongoose";

import HttpError from "../models/http-error.js";
import getCoorsForAddress from "../util/location.js";
import Place from "../models/place.js";
import User from "../models/user.js";

// ── Colorwalk: 引入色彩分析（只新增这一行 import）─────────────────
import { analyzeImageColor } from "../util/color-service.js";

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

  // ── 主流程到此结束，和原来完全一样 ──────────────────────────────
  res.status(201).json({ place: newPlace });

  // ── Colorwalk: 异步色彩分析，在响应发出之后触发 ──────────────────
  // 使用 setImmediate 确保在当前事件循环 tick 之后执行，
  // 即使分析失败也不会影响已发出的 201 响应。
  setImmediate(() => {
    analyzeImageColor(newPlace.image)
      .then(async (colorData) => {
        if (!colorData) {
          console.log(
            `[colorwalk] No color data for place ${newPlace._id}, skipping update.`,
          );
          return;
        }
        try {
          await Place.findByIdAndUpdate(newPlace._id, {
            colorPalette: colorData.colorPalette,
            colorVector: colorData.colorVector,
            isColorful: colorData.isColorful,
            colorAnalyzedAt: colorData.colorAnalyzedAt,
          });
          console.log(
            `[colorwalk] Color analysis complete for place ${newPlace._id}. ` +
              `isColorful=${colorData.isColorful}, ` +
              `palette=${colorData.colorPalette.map((s) => s.hex).join(", ")}`,
          );
        } catch (dbErr) {
          // DB 写入失败只记录日志，不影响任何用户操作
          console.error(
            `[colorwalk] Failed to save color data for place ${newPlace._id}:`,
            dbErr.message,
          );
        }
      })
      .catch((err) => {
        console.error(
          `[colorwalk] analyzeImageColor threw for place ${newPlace._id}:`,
          err.message,
        );
      });
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
