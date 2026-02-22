import { validationResult } from "express-validator";
import mongoose from "mongoose";

import HttpError from "../models/http-error.js";
import getCoorsForAddress from "../util/location.js";
import Place from "../models/place.js";
import User from "../models/user.js";

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
  // convert mongoose object to js object
  // change _id to id
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
  if (!user || user.places.length === 0) {
    return next(
      new HttpError("No place was found for the provided user id.", 404),
    );
  }
  res.json({ places: user.places.map((p) => p.toObject({ getters: true })) });
};

export const createPlace = async (req, res, next) => {
  //   validate user inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed. Please check your data.", 422),
    );
  }

  const { title, address, description, creatorId } = req.body;
  //   convert address to coordinates
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
    image: "https://cat-avatars.vercel.app/api/cat?name=niuniu",
    creatorId,
  });

  let user;
  try {
    user = await User.findById(creatorId);
  } catch (err) {
    const error = new HttpError(
      "Failed to create place. Please try again later.",
      500,
    );
    return next(error);
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

  res.status(201).json({ place: newPlace });
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
