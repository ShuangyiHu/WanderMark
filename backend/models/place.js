import { Schema, model } from "mongoose";

const placeSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  image: { type: String, required: true }, //url
  creatorId: { type: String, required: true },
});

export default model("Place", placeSchema);
