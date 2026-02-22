import { Schema, model } from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const userSchema = new Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6 },
  image: { type: String, required: true }, //url
  places: { type: String, required: true },
});

userSchema.plugin(uniqueValidator);

export default model("User", userSchema);
