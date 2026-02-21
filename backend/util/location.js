import dotenv from "dotenv";
import axios from "axios";
import HttpError from "../models/http-error.js";

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

async function getCoorsForAddress(address) {
  const response = await axios.get(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`,
  );
  const data = response.data;

  if (!data || data.status === "ZERO_RESULTS") {
    throw new HttpError(
      "Could not find location for the specified address",
      404,
    );
  }

  const coors = data.results[0].geometry.location;
  return coors;
}

export default getCoorsForAddress;
