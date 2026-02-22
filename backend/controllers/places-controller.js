import HttpError from "../models/http-error.js";
import { v4 as uuid } from "uuid";
import { validationResult } from "express-validator";
import getCoorsForAddress from "../util/location.js";
import Place from "../models/place.js";

let DUMMY_PLACES = [
  {
    id: "p1",
    title: "Space Needle",
    description:
      "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
    image:
      "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
    address: "400 Broad St, Seattle, WA 98109",
    coordinates: {
      lat: 47.6205063,
      lng: -122.3518523,
    },
    creatorId: "u1",
  },
  {
    id: "p2",
    title: "Space Needle",
    description:
      "Iconic, 605-ft-tall spire at the Seattle Center, with an observation deck & a rotating restaurant.",
    image:
      "https://insightpestnorthwest.com/wp-content/uploads/2021/04/andrea-leopardi-QfhbK2pY0Ao-unsplash-1-1024x683.jpg",
    address: "400 Broad St, Seattle, WA 98109",
    coordinates: {
      lat: 47.6205063,
      lng: -122.3518523,
    },
    creatorId: "u1",
  },
];

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
  let places;
  try {
    places = await Place.find({ creatorId: userId });
  } catch (err) {
    return next(
      new HttpError("Could not find places. Please try again later.", 500),
    );
  }
  if (!places || places.length === 0) {
    return next(
      new HttpError("No place was found for the provided user id.", 404),
    );
  }
  res.json({ places: places.map((p) => p.toObject({ getters: true })) });
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

  try {
    await newPlace.save();
  } catch (err) {
    const error = new HttpError(
      "Faild to create place. Please try again.",
      500,
    );
    return next(error);
  }

  res.status(201).json({ place: newPlace });
};

export const updatePlaceById = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    throw new HttpError("Invalid inputs passed. Please check your data.", 422);
  }
  const placeId = req.params.placeId;
  const { title, description } = req.body;

  //   create a copy of the place object
  const updatedPlace = { ...DUMMY_PLACES.find((p) => p.id === placeId) };
  const index = DUMMY_PLACES.findIndex((p) => p.id === placeId);

  updatedPlace.title = title;
  updatedPlace.description = description;

  DUMMY_PLACES[index] = updatedPlace;
  res.status(200).json({ place: updatedPlace });
};

export const deletePlaceById = (req, res, next) => {
  const placeId = req.params.placeId;
  if (!DUMMY_PLACES.find((p) => p.id === placeId)) {
    throw new HttpError("No place was found for the provided place id.", 404);
  }

  DUMMY_PLACES = DUMMY_PLACES.filter((p) => p.id !== placeId);
  res.status(200).json({ message: "Place deleted" });
};
