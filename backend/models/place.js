import mongoose, { Schema, model } from "mongoose";

const placeSchema = new Schema({
  // ── 现有字段（完全不动）──────────────────────────────────────
  title: { type: String, required: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  image: { type: String, required: true }, // Cloudinary URL
  creatorId: { type: mongoose.Types.ObjectId, required: true, ref: "User" },

  // ── Colorwalk 新增字段（全部 optional，旧数据不受影响）────────
  colorPalette: [
    {
      hex: String, // e.g. "#FF6B35"
      lab: [Number], // [L, a, b] in CIELAB space
      population: Number, // 该色在图片中的占比权重
    },
  ],
  // 15维向量：5个主色 × [L, a, b]，归一化后用于余弦相似度计算
  colorVector: [Number],

  // 描述文字的 embedding（1536维，text-embedding-3-small）
  textEmbedding: [Number],

  // 图片色彩是否足够显著，用于 adaptive weighting
  isColorful: { type: Boolean, default: null },

  // pipeline 执行时间戳，便于 debug 和 monitoring
  colorAnalyzedAt: { type: Date, default: null },
});

export default model("Place", placeSchema);
