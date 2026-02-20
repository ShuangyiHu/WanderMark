import express from "express";
import HttpError from "../models/http-error.js";
import {
  getPlaceById,
  getPlacesByUserId,
} from "../controllers/places-controller.js";

const router = express.Router();

router.get("/", (req, res, next) => {
  console.log("GET request in Places");
  res.json({ message: "It works!" });
});

router.get("/:placeId", getPlaceById);

router.get("/user/:userId", getPlacesByUserId);

export default router;
