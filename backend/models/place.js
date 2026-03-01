import mongoose, { Schema, model } from "mongoose";

const placeSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  image: { type: String, required: true },
  // Index on creatorId speeds up Place.find({ creatorId }) from O(n) scan
  // to O(log n) lookup — critical for getPlacesByUserId at scale
  creatorId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
    index: true,
  },
});

export default model("Place", placeSchema);
