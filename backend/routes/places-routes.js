import express from "express";
import { check } from "express-validator";

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

router.post(
  "/",
  [
    check("title").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("address").not().isEmpty(),
  ],
  createPlace,
);

router.patch(
  "/:placeId",
  [check("title").not().isEmpty(), check("description").isLength({ min: 5 })],
  updatePlaceById,
);

router.delete("/:placeId", deletePlaceById);

export default router;
