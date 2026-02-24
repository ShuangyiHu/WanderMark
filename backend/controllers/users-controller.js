import { validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import HttpError from "../models/http-error.js";
import User from "../models/user.js";

export const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(
      new HttpError("Failed to fetch users. Please try again later.", 500),
    );
  }

  res.json({ users: users.map((u) => u.toObject({ getters: true })) });
};

export const login = async (req, res, next) => {
  const { email, password } = req.body;
  let user;

  try {
    user = await User.findOne({ email: email });
  } catch (err) {
    return next(
      new HttpError("Failed to log in. Please try again later.", 500),
    );
  }

  if (!user) {
    return next(new HttpError("User does not exist. Please sign up.", 403));
  }

  let isValidPassword;
  try {
    isValidPassword = await bcrypt.compare(password, user.password);
  } catch (err) {
    return next(
      new HttpError("Could not log you in. Please try again later.", 500),
    );
  }

  if (!isValidPassword) {
    return next(new HttpError("Password is incorrect. Please try again.", 403));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: user.id, email: user.email },
      "supersecret_dont_share",
      { expiresIn: "1h" },
    );
  } catch (err) {
    return next(
      new HttpError("Failed to log in. Please try again later.", 500),
    );
  }

  res.json({ userId: user.id, email: user.email, token: token });
};

export const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log(errors);
    throw new HttpError("Invalid inputs passed. Please check your data.", 422);
  }
  const { username, email, password } = req.body;
  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    // unique validator may throw an error
    return next(
      new HttpError("Failed to sign up. Please try again later.", 500),
    );
  }

  if (existingUser) {
    return next(new HttpError("User already exists. Please log in.", 422));
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    return next(
      new HttpError("Could not create user, please try again later.", 500),
    );
  }

  const newUser = new User({
    username,
    email,
    password: hashedPassword,
    image: req.file.path,
    places: [],
  });

  try {
    await newUser.save();
  } catch (err) {
    return next(
      new HttpError("Failed to create user. Please try again later.", 500),
    );
  }

  let token;
  try {
    token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      "supersecret_dont_share",
      { expiresIn: "1h" },
    );
  } catch (err) {
    return next(
      new HttpError("Failed to create user. Please try again later.", 500),
    );
  }

  res
    .status(201)
    .json({ userId: newUser.id, email: newUser.email, token: token });
};
