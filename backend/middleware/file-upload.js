import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../util/cloudinary.js";

// ── Cloudinary storage (used for user avatar uploads) ──────────────────────
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "wander_mark",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

// ── Memory storage (used for place image uploads) ──────────────────────────
// Keeps the file as a Buffer in req.file.buffer so we can:
// 1. Respond to the client immediately
// 2. Upload to Cloudinary asynchronously in the background
const memoryStorage = multer.memoryStorage();

const fileUpload = multer({ storage: cloudinaryStorage });
export const memoryUpload = multer({ storage: memoryStorage });

export default fileUpload;
