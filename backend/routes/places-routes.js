import express from "express";
import { check } from "express-validator";

import {
  getPlaceById,
  getPlacesByUserId,
  createPlace,
  updatePlaceById,
  deletePlaceById,
  searchByColor, // Colorwalk: Phase 3
} from "../controllers/places-controller.js";
import fileUpload from "../middleware/file-upload.js";
import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/user/:userId", getPlacesByUserId);

// Colorwalk: must be registered before /:placeId — Express matches routes in
// order, so "search" would otherwise be captured as a placeId string.
router.post("/search/color", fileUpload.single("image"), searchByColor);

router.get("/:placeId", getPlaceById);

// All routes below require a valid JWT
router.use(checkAuth);

router.post(
  "/",
  fileUpload.single("image"),
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
