import HttpError from "../models/http-error.js";

const DUMMY_PLACES = [
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
    creatorId: "u2",
  },
];

export const getPlaceById = (req, res, next) => {
  const placeId = req.params.placeId;
  const place = DUMMY_PLACES.find((p) => p.id === placeId);
  if (!place) {
    throw new HttpError("No place was found for the provided place id.", 404);
  }
  res.json({ place });
};

export const getPlacesByUserId = (req, res, next) => {
  const userId = req.params.userId;
  const places = DUMMY_PLACES.filter((p) => p.creatorId === userId);
  if (places.length === 0) {
    return next(
      new HttpError("No place was found for the provided user id.", 404),
    );
  }
  res.json({ places });
};
