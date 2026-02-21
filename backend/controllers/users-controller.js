import HttpError from "../models/http-error.js";
import { v4 as uuid } from "uuid";

let USERS = [
  {
    id: "u1",
    username: "maru",
    email: "test1@test.com",
    password: "123456",
  },
  {
    id: "u2",
    username: "may",
    email: "test2@test.com",
    password: "123456",
  },
  {
    id: "u3",
    username: "cookie",
    email: "test3@test.com",
    password: "123456",
  },
];

export const getUsers = (req, res, next) => {
  res.json({ users: USERS });
};

export const login = (req, res, next) => {
  const { email, password } = req.body;
  const user = USERS.find((user) => user.email === email);
  if (!user || password !== user.password) {
    throw new HttpError("Could not identify user.", 401);
  }

  res.json({ message: "Logged in!" });
};

export const signup = (req, res, next) => {
  const { username, email, password } = req.body;

  const hasUser = USERS.find((user) => user.email === email);

  if (hasUser) {
    throw new HttpError("User already exists.", 422);
  }

  const newUser = {
    id: uuid(),
    username,
    email,
    password,
  };
  USERS.push(newUser);

  res.status(201).json({ user: newUser });
};
