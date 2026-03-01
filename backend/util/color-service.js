/**
 * color-service.js
 *
 * Colorwalk 色彩分析核心 pipeline：
 *  1. 从 Cloudinary URL 提取调色板（node-vibrant）
 *  2. RGB → CIELAB 色彩空间转换（感知均匀，适合相似度计算）
 *  3. 构建 15 维归一化 Lab 向量
 *  4. 判断图片色彩是否足够显著（isColorful）
 *  5. 生成描述文字的语义 embedding（OpenAI text-embedding-3-small）
 *
 * 设计原则：所有函数静默失败，返回 null 而不是抛错，
 * 确保颜色分析失败不会影响 createPlace 主流程。
 */

import OpenAI from "openai";
import { Vibrant } from "node-vibrant/node";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── 1. 调色板提取 ────────────────────────────────────────────────

/**
 * 从图片 URL 提取最多 5 个主色。
 * node-vibrant 内置 6 个色块槽位（Vibrant / DarkVibrant / LightVibrant /
 * Muted / DarkMuted / LightMuted），过滤掉 null 后按 population 降序排序。
 *
 * @param {string} imageUrl - Cloudinary 图片 URL
 * @returns {Array|null} swatches 数组，或提取失败时返回 null
 */
export async function extractPalette(imageUrl) {
  try {
    const palette = await Vibrant.from(imageUrl)
      .maxColorCount(64) // 量化精度，数值越大越准但越慢
      .getPalette();

    const slots = [
      "Vibrant",
      "DarkVibrant",
      "LightVibrant",
      "Muted",
      "DarkMuted",
      "LightMuted",
    ];

    const swatches = slots
      .map((key) => palette[key])
      .filter((s) => s != null)
      .sort((a, b) => b.population - a.population)
      .slice(0, 5)
      .map((s) => ({
        hex: s.hex,
        rgb: s.rgb.map(Math.round),
        population: s.population,
      }));

    return swatches.length > 0 ? swatches : null;
  } catch (err) {
    console.error("[color-service] extractPalette failed:", err.message);
    return null;
  }
}

// ─── 2. RGB → CIELAB 转换 ─────────────────────────────────────────

/**
 * RGB → CIELAB（D65 光源，2° 观察者）
 *
 * 为什么用 Lab 而不是 RGB：
 * CIELAB 是感知均匀色彩空间，两点间的欧氏距离直接对应
 * 人眼感知到的色差（ΔE）。RGB 空间里数学距离和感知距离不对应，
 * 用 RGB 做相似度搜索会产生违反直觉的结果。
 *
 * 转换流程：RGB(0-255) → 线性化 → XYZ → Lab
 *
 * @param {number} r - 0-255
 * @param {number} g - 0-255
 * @param {number} b - 0-255
 * @returns {[number, number, number]} [L, a, b]
 *   L: 0-100（明度）
 *   a: -128 ~ 127（绿-红轴）
 *   b: -128 ~ 127（蓝-黄轴）
 */
export function rgbToLab(r, g, b) {
  // Step 1: 归一化到 [0, 1] 并做 gamma 校正（sRGB → 线性光）
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;

  rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
  gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
  bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

  // Step 2: 线性 RGB → XYZ（D65 标准光源矩阵）
  let x = rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375;
  let y = rr * 0.2126729 + gg * 0.7151522 + bb * 0.072175;
  let z = rr * 0.0193339 + gg * 0.119192 + bb * 0.9503041;

  // Step 3: XYZ → Lab（相对于 D65 白点归一化）
  // D65 白点：Xn=0.95047, Yn=1.00000, Zn=1.08883
  x /= 0.95047;
  y /= 1.0;
  z /= 1.08883;

  const f = (t) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = Math.round((116 * fy - 16) * 100) / 100;
  const a = Math.round(500 * (fx - fy) * 100) / 100;
  const bVal = Math.round(200 * (fy - fz) * 100) / 100;

  return [L, a, bVal];
}

// ─── 3. 向量构建 ──────────────────────────────────────────────────

/**
 * 把调色板转换为 15 维归一化 Lab 向量。
 *
 * 向量结构：[L1,a1,b1, L2,a2,b2, L3,a3,b3, L4,a4,b4, L5,a5,b5]
 * 不足 5 个色时用 [50, 0, 0]（Lab 灰色中点）补齐，保证向量维度固定。
 *
 * 归一化范围：
 *   L: [0, 100] → [0, 1]
 *   a: [-128, 127] → [0, 1]
 *   b: [-128, 127] → [0, 1]
 *
 * @param {Array} swatches - extractPalette 返回的数组
 * @returns {number[]} 15 维向量，所有值在 [0, 1]
 */
export function buildColorVector(swatches) {
  const VECTOR_SIZE = 5; // 5 个色 × 3 维 = 15 维
  const GRAY_LAB = [50, 0, 0]; // 补位用的中性灰

  const labValues = swatches.map(({ rgb: [r, g, b] }) => rgbToLab(r, g, b));

  // 补齐到 5 个
  while (labValues.length < VECTOR_SIZE) {
    labValues.push(GRAY_LAB);
  }

  // 归一化展平
  return labValues.slice(0, VECTOR_SIZE).flatMap(([L, a, b]) => [
    L / 100, // L: 0-100 → 0-1
    (a + 128) / 255, // a: -128~127 → 0-1
    (b + 128) / 255, // b: -128~127 → 0-1
  ]);
}

// ─── 4. isColorful 判断 ───────────────────────────────────────────

/**
 * 判断图片是否具有足够显著的色彩特征。
 *
 * 策略：
 *  - swatches 数量 < 2：颜色太少，判定为不显著
 *  - 最大 population < 500：整体颜色分布过于零散
 *  - Lab 向量的标准差 < 0.08：所有颜色过于相近（接近纯白/纯黑/单色调）
 *
 * isColorful = false 时，hybrid scoring 会自动提高文字 embedding 的权重。
 *
 * @param {Array} swatches
 * @param {number[]} colorVector
 * @returns {boolean}
 */
export function checkIsColorful(swatches, colorVector) {
  if (!swatches || swatches.length < 2) return false;
  if (swatches[0].population < 10) return false;

  // 计算向量标准差
  const mean = colorVector.reduce((s, v) => s + v, 0) / colorVector.length;
  const variance =
    colorVector.reduce((s, v) => s + Math.pow(v - mean, 2), 0) /
    colorVector.length;
  const stdDev = Math.sqrt(variance);

  return stdDev >= 0.08;
}

// ─── 5. 主入口函数 ────────────────────────────────────────────────

/**
 * 完整的色彩分析 pipeline 入口。
 * 被 places-controller.js 异步调用，失败时返回 null 不抛错。
 *
 * @param {string} imageUrl - Cloudinary 图片 URL
 * @returns {Object|null} 分析结果，或失败时返回 null
 */
export async function analyzeImageColor(imageUrl) {
  try {
    // 提取调色板
    const swatches = await extractPalette(imageUrl);
    if (!swatches) {
      console.log("[color-service] No swatches extracted, skipping.");
      return null;
    }

    // 转换为 Lab 并附加到 palette 数据
    const paletteWithLab = swatches.map((s) => ({
      ...s,
      lab: rgbToLab(...s.rgb),
    }));

    // 构建 15 维向量
    const colorVector = buildColorVector(swatches);

    // 判断显著性
    const isColorful = checkIsColorful(swatches, colorVector);

    return {
      colorPalette: paletteWithLab,
      colorVector,
      isColorful,
      colorAnalyzedAt: new Date(),
    };
  } catch (err) {
    console.error("[color-service] analyzeImageColor failed:", err.message);
    return null;
  }
}

// ─── 6. 余弦相似度（供 searchByColor 使用）────────────────────────

/**
 * 计算两个向量的余弦相似度。
 * 返回值范围 [-1, 1]，越接近 1 越相似。
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

/**
 * 根据 isColorful 计算自适应权重，返回 { colorWeight, textWeight }。
 *
 * isColorful = true  → 色彩信号可信，色彩主导 60/40
 * isColorful = false → 色彩信号不可信，文字主导 20/80
 * isColorful = null  → 尚未分析或提取失败，纯文字 0/100
 *
 * @param {boolean|null} isColorful
 * @returns {{ colorWeight: number, textWeight: number }}
 */
export function adaptiveWeights(isColorful) {
  if (isColorful === true) return { colorWeight: 0.6, textWeight: 0.4 };
  if (isColorful === false) return { colorWeight: 0.2, textWeight: 0.8 };
  return { colorWeight: 0.0, textWeight: 1.0 };
}

// ─── 7. Text Embedding（Phase 2）─────────────────────────────────

/**
 * 把 place 的文字信息转换为 1536 维语义向量。
 *
 * 为什么要做文字 embedding：
 *  - 色彩向量是 pixel-level 特征，无法区分"东京霓虹街道"和"拉斯维加斯赌场"
 *    （两者 RGB 调色板可能几乎相同）
 *  - 文字 embedding 捕捉 scene、object、atmosphere 等高层语义
 *  - 两者结合（hybrid scoring）才能真正做到"视觉氛围"相似度匹配
 *
 * 输入文本构造策略：
 *  拼接 title + address + description，给 address 一定权重是因为
 *  地理信息（"Tokyo neon alley"）本身就携带视觉语义。
 *
 * 模型选择：text-embedding-3-small（1536 维）
 *  - 比 ada-002 更准确，成本更低
 *  - 1536 维对于 cosine similarity 来说精度足够
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} params.address
 * @returns {number[]|null} 1536 维向量，失败时返回 null
 */
export async function generateTextEmbedding({ title, description, address }) {
  // 构造语义密度高的输入文本
  // 格式："{title} located at {address}. {description}"
  const inputText = [title, address ? `located at ${address}` : "", description]
    .filter(Boolean)
    .join(". ")
    .trim();

  if (!inputText) {
    console.log(
      "[color-service] generateTextEmbedding: empty input, skipping.",
    );
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputText,
      encoding_format: "float",
    });

    const vector = response.data[0].embedding;

    console.log(
      `[color-service] Text embedding generated. ` +
        `dims=${vector.length}, input="${inputText.slice(0, 60)}..."`,
    );

    return vector;
  } catch (err) {
    // API 限流或网络错误：静默失败，不阻塞主流程
    console.error("[color-service] generateTextEmbedding failed:", err.message);
    return null;
  }
}
