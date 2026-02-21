import express from "express";
import { getUsers, login, signup } from "../controllers/users-controller.js";

const router = express.Router();

router.get("/", getUsers);
router.post("/login", login);
router.post("/signup", signup);

export default router;
