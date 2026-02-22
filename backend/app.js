import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

import placesRoutes from "./routes/places-routes.js";
import usersRoutes from "./routes/users-routes.js";
import HttpError from "./models/http-error.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/places", placesRoutes);
app.use("/api/users", usersRoutes);

// 404 handler
app.use((req, res, next) => {
  return next(new HttpError("Could not find this route.", 404));
});

// error handler
app.use((error, req, res, next) => {
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
