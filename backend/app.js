import express from "express";
import placesRoutes from "./routes/places-routes.js";
import HttpError from "./models/http-error.js";

const app = express();

app.use(express.json());

app.use("/api/places", placesRoutes);

// invalid routes handling
app.use((req, res, next) => {
  const error = new HttpError("Could not find this route.", 404);
  throw error;
});

// error handling middleware
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  res
    .status(error.code || 500)
    .json({ message: error.message || "An unknown error occurred." });
});

app.listen(5001, () => {
  console.log("Server running on port 5001");
});
