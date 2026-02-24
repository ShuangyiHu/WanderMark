import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "wander_mark",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const fileUpload = multer({ storage });

export default fileUpload;
