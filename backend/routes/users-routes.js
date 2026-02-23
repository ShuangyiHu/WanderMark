import express from "express";
import { getUsers, login, signup } from "../controllers/users-controller.js";
import { check } from "express-validator";
import fileUpload from "../middleware/file-upload.js";

const router = express.Router();

router.get("/", getUsers);
router.post("/login", login);
router.post(
  "/signup",
  fileUpload.single("image"),
  [
    check("username").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  signup,
);

export default router;
