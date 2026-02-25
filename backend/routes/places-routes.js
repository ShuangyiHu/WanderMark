import express from "express";
import { check } from "express-validator";

import {
  getPlaceById,
  getPlacesByUserId,
  createPlace,
  updatePlaceById,
  deletePlaceById,
} from "../controllers/places-controller.js";
import { memoryUpload } from "../middleware/file-upload.js";
import checkAuth from "../middleware/check-auth.js";

const router = express.Router();

router.get("/user/:userId", getPlacesByUserId);
router.get("/:placeId", getPlaceById);

// auth middleware
router.use(checkAuth);

router.post(
  "/",
  // Memory storage: file lands in req.file.buffer (not yet on Cloudinary)
  // Controller will upload to Cloudinary async after responding
  memoryUpload.single("image"),
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
