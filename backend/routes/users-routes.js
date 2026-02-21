import express from "express";
import { getUsers, login, signup } from "../controllers/users-controller.js";
import { check } from "express-validator";

const router = express.Router();

router.get("/", getUsers);
router.post("/login", login);
router.post(
  "/signup",
  [
    check("username").not().isEmpty(),
    check("email").normalizeEmail().isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  signup,
);

export default router;
