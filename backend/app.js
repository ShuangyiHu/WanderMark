import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "node:url";

import placesRoutes from "./routes/places-routes.js";
import usersRoutes from "./routes/users-routes.js";
import HttpError from "./models/http-error.js";

dotenv.config();

const app = express();

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  "/uploads/images",
  express.static(path.join(__dirname, "uploads", "images")),
);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  next();
});

app.use("/api/places", placesRoutes);
app.use("/api/users", usersRoutes);

// 404 handler
app.use((req, res, next) => {
  return next(new HttpError("Could not find this route.", 404));
});

// error handler
app.use((error, req, res, next) => {
  // roll back image upload if error occurs
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }
  if (res.headersSent) {
    return next(error);
  }
  res
    .status(error.code || 500)
    .json({ message: error.message || "An unknown error occurred." });
});

const uri = `mongodb+srv://shuangyihu:${process.env.MONGODB_PASSWORD}@cluster0.6iscw4x.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

mongoose
  .connect(uri)
  .then(() => {
    app.listen(5001, () => {
      console.log("Server running on port 5001");
    });
  })
  .catch((err) => {
    console.log(err);
  });
