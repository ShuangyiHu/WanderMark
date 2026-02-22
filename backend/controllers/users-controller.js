import { v4 as uuid } from "uuid";
import { validationResult } from "express-validator";

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
    return next(new HttpError("User does not exist. Please sign up.", 401));
  }

  if (user.password !== password) {
    return next(new HttpError("Password is incorrect. Please try again.", 401));
  }
  res.json({ message: "Logged in!", user: user.toObject({ getters: true }) });
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

  const newUser = new User({
    id: uuid(),
    username,
    email,
    password,
    image: "https://cat-avatars.vercel.app/api/cat?name=niuniu",
    places: [],
  });
  try {
    await newUser.save();
  } catch (err) {
    return next(
      new HttpError("Failed to create user. Please try again later.", 500),
    );
  }

  res.status(201).json({ user: newUser.toObject({ getters: true }) });
};
