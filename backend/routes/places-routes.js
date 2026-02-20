import express from "express";
import {
  getPlaceById,
  getPlacesByUserId,
  createPlace,
  updatePlaceById,
  deletePlaceById,
} from "../controllers/places-controller.js";

const router = express.Router();

router.get("/", (req, res, next) => {
  console.log("GET request in Places");
  res.json({ message: "It works!" });
});

router.get("/:placeId", getPlaceById);

router.get("/user/:userId", getPlacesByUserId);

router.post("/", createPlace);

router.patch("/:placeId", updatePlaceById);

router.delete("/:placeId", deletePlaceById);

export default router;
