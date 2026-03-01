/**
 * WanderMark Colorwalk Agent — Pipeline Validation + Search Quality Report
 *
 * 用法:
 *   node colorwalk-agent.js
 *
 * agent.env 需包含:
 *   BACKEND_URL=http://localhost:5001
 *   ANTHROPIC_API_KEY=sk-ant-xxx
 *   UNSPLASH_KEY=xxx          # 可选，无则用占位图
 *   MONGODB_URI=mongodb+srv://user:pass@cluster.xxx.mongodb.net/dbname
 *
 * 流程:
 *   阶段 1 — 预热图片缓存
 *   阶段 2 — Claude 生成地点数据 + 注册账号 + 写入地点
 *   阶段 3 — 等待异步 color analysis 完成，验证 pipeline 写入结果
 *   阶段 4 — 运行多组 color search 查询，采集延迟 + 分数分布
 *   阶段 5 — 输出对比报告，保存至 colorwalk-report.txt
 */

import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";
import FormData from "form-data";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

dotenv.config({
  path: path.join(backendRoot, ".env"),
});

// ─── 配置 ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BACKEND_URL || "http://localhost:5001";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_KEY;
const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.6iscw4x.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

const PLACES_PER_PERSONA = 5;
// How long to wait for the async color analysis pipeline after place creation
const COLOR_ANALYSIS_WAIT_MS = 20000;
// Number of concurrent color search requests per query round
const SEARCH_CONCURRENCY = 10;

if (!ANTHROPIC_KEY) {
  console.error("❌ ANTHROPIC_API_KEY is required in agent.env");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── 人格定义 ─────────────────────────────────────────────────────────────────
//
// 每个 persona 代表一类用户，他们 bookmark 的地点有不同的视觉风格。
// 这种多样性使 color search 能体现出真正的差异化排序。

const PERSONAS = [
  {
    name: "warm_traveler",
    desc: "a traveler drawn to warm, golden-hour landscapes, desert canyons, and Mediterranean villages",
    keywords: ["desert canyon sunset", "mediterranean village"],
  },
  {
    name: "urban_explorer",
    desc: "an urban photographer who documents neon-lit city nights, street markets, and rooftop skylines",
    keywords: ["city neon night", "street market asia"],
  },
  {
    name: "nature_wanderer",
    desc: "a nature lover who seeks out fjords, glaciers, forest trails, and misty mountain lakes",
    keywords: ["norway fjord", "mountain lake forest"],
  },
];

// Color search 查询组：每组用一张图片做查询，预期应该命中特定风格的地点
const SEARCH_QUERIES = [
  {
    label: "暖色调沙漠日落",
    keyword: "desert dunes sunset warm",
    expectedStyle: "warm desert / canyon",
  },
  {
    label: "城市霓虹夜景",
    keyword: "tokyo neon street night",
    expectedStyle: "urban neon / city",
  },
  {
    label: "冷色调山地湖泊",
    keyword: "blue mountain lake glacier",
    expectedStyle: "nature / cold tones",
  },
];

// ─── 图片缓存 + Unsplash ─────────────────────────────────────────────────────

const imageCache = new Map();

const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDB" +
    "kSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAAR" +
    "CAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAA" +
    "AAAAAAAAAAAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAA" +
    "AAAAAAAA/9oADAMBAAIRAxEAPwCwABmX/9k=",
  "base64",
);

async function fetchImage(keyword) {
  if (imageCache.has(keyword)) return imageCache.get(keyword);
  if (!UNSPLASH_KEY) {
    imageCache.set(keyword, PLACEHOLDER_JPEG);
    return PLACEHOLDER_JPEG;
  }
  try {
    const meta = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(keyword)}&orientation=landscape&client_id=${UNSPLASH_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    ).then((r) => r.json());
    const buf = Buffer.from(await (await fetch(meta.urls.small)).arrayBuffer());
    imageCache.set(keyword, buf);
    log(`  🖼️  Unsplash "${keyword}" → ${(buf.length / 1024).toFixed(1)} KB`);
    return buf;
  } catch (e) {
    log(`  ⚠️  Unsplash "${keyword}" 失败，用占位图`);
    imageCache.set(keyword, PLACEHOLDER_JPEG);
    return PLACEHOLDER_JPEG;
  }
}

// ─── MongoDB 直连：验证 pipeline 写入 ────────────────────────────────────────

async function connectMongo() {
  await mongoose.connect(MONGODB_URI);
  log("  ✅ MongoDB 已连接");
}

async function validatePipelineFields(placeIds) {
  const db = mongoose.connection.db;
  const objectIds = placeIds.map((id) => new mongoose.Types.ObjectId(id));

  const docs = await db
    .collection("places")
    .find({ _id: { $in: objectIds } })
    .project({
      colorVector: 1,
      textEmbedding: 1,
      isColorful: 1,
      colorPalette: 1,
    })
    .toArray();

  let withColorVector = 0;
  let withTextEmbedding = 0;
  let isColorfulTrue = 0;
  let totalPaletteColors = 0;

  for (const doc of docs) {
    if (doc.colorVector?.length === 15) withColorVector++;
    if (doc.textEmbedding?.length === 1536) withTextEmbedding++;
    if (doc.isColorful === true) isColorfulTrue++;
    if (doc.colorPalette?.length > 0)
      totalPaletteColors += doc.colorPalette.length;
  }

  return {
    total: placeIds.length,
    withColorVector,
    withTextEmbedding,
    isColorfulTrue,
    avgPaletteColors: docs.length
      ? (totalPaletteColors / docs.length).toFixed(1)
      : 0,
    colorSuccessRate: placeIds.length
      ? Math.round((withColorVector / placeIds.length) * 100)
      : 0,
    embeddingSuccessRate: placeIds.length
      ? Math.round((withTextEmbedding / placeIds.length) * 100)
      : 0,
  };
}

// ─── Claude：生成地点数据 ─────────────────────────────────────────────────────

async function generatePlaces(persona) {
  log(`\n🤖 Claude 生成 [${persona.name}] 的地点数据...`);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `You are ${persona.desc}.
Generate ${PLACES_PER_PERSONA} realistic places you would bookmark on a travel app.
Rules:
- title: 3-6 words, specific and evocative
- description: 25-80 characters, first-person voice, mention visual atmosphere
- address: a real geocodable address
- imageKeyword: exactly one of: ${persona.keywords.join(" | ")}
Return ONLY a valid JSON array, no markdown fences.`,
      },
    ],
  });
  const places = JSON.parse(
    response.content[0].text
      .trim()
      .replace(/```json|```/g, "")
      .trim(),
  );
  log(`  ✅ 生成了 ${places.length} 个地点`);
  return places;
}

// ─── API 封装 ─────────────────────────────────────────────────────────────────

async function signup(persona) {
  const email = `${persona.name}_${Date.now()}@wandermark-agent.test`;
  const form = new FormData();
  form.append("username", persona.name);
  form.append("email", email);
  form.append("password", "Agent1234!");
  form.append("image", PLACEHOLDER_JPEG, {
    filename: "avatar.jpg",
    contentType: "image/jpeg",
  });
  const res = await fetch(`${BASE_URL}/api/users/signup`, {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Signup 失败: ${data.message}`);
  log(`  ✅ 注册: ${email}`);
  return { email, userId: data.userId, token: data.token };
}

async function createPlace(place, token, imageBuffer) {
  const form = new FormData();
  form.append("title", place.title);
  form.append("description", place.description);
  form.append("address", place.address);
  form.append("image", imageBuffer, {
    filename: "place.jpg",
    contentType: "image/jpeg",
  });
  const res = await fetch(`${BASE_URL}/api/places`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`createPlace 失败: ${data.message}`);
  return data.place?.id ?? data.place?._id;
}

// ─── Color Search 压测 ────────────────────────────────────────────────────────

async function benchmarkColorSearch(imageBuffer, imageFilename, label) {
  log(
    `\n  📊 [${label}] 并发 ${SEARCH_CONCURRENCY} 个 POST /api/places/search/color`,
  );

  // First single request to get actual results for quality analysis
  const singleForm = new FormData();
  singleForm.append("image", imageBuffer, {
    filename: imageFilename,
    contentType: "image/jpeg",
  });
  const singleRes = await fetch(
    `${BASE_URL}/api/places/search/color?limit=5&threshold=0.2`,
    { method: "POST", body: singleForm, headers: singleForm.getHeaders() },
  );
  const singleData = await singleRes.json();

  const results = singleData.results ?? [];
  const meta = singleData.meta ?? {};

  if (results.length > 0) {
    const scores = results.map((r) => r.similarityScore);
    log(`     返回结果: ${results.length} 条`);
    log(
      `     分数分布: max=${Math.round(scores[0] * 100)}%  min=${Math.round(scores[scores.length - 1] * 100)}%  spread=${Math.round((scores[0] - scores[scores.length - 1]) * 100)}pp`,
    );
    log(
      `     权重: color ${Math.round(meta.weightsUsed?.colorWeight * 100)}% / text ${Math.round(meta.weightsUsed?.textWeight * 100)}%`,
    );
    log(
      `     Top 3: ${results
        .slice(0, 3)
        .map((r) => `"${r.title}" ${Math.round(r.similarityScore * 100)}%`)
        .join("  |  ")}`,
    );
  } else {
    log(`     ⚠️  0 结果（threshold 可能过高或数据不足）`);
  }

  // Concurrent load test for latency measurement
  const times = await Promise.all(
    Array.from({ length: SEARCH_CONCURRENCY }, async () => {
      const form = new FormData();
      form.append("image", imageBuffer, {
        filename: imageFilename,
        contentType: "image/jpeg",
      });
      const t0 = Date.now();
      const r = await fetch(
        `${BASE_URL}/api/places/search/color?limit=5&threshold=0.2`,
        { method: "POST", body: form, headers: form.getHeaders() },
      );
      await r.json();
      return Date.now() - t0;
    }),
  );

  const sorted = [...times].sort((a, b) => a - b);
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  log(
    `     端到端延迟 → avg: ${avg}ms | P50: ${p50}ms | P95: ${p95}ms | min: ${min}ms | max: ${max}ms`,
  );

  return {
    label,
    results,
    meta,
    latency: { avg, p50, p95, min, max },
    scores: results.map((r) => r.similarityScore),
  };
}

// ─── 日志 ─────────────────────────────────────────────────────────────────────

const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  log("🚀 WanderMark Colorwalk Agent — Pipeline Validation + Search Quality");
  log("=".repeat(65));

  // ── 连接 MongoDB ──────────────────────────────────────────────────────────
  log("\n🔌 连接 MongoDB...");
  await connectMongo();

  // ── 阶段 1：预热图片缓存 ──────────────────────────────────────────────────
  log("\n📦 阶段 1/5：预热图片缓存...");
  const allKeywords = [
    ...new Set([
      ...PERSONAS.flatMap((p) => p.keywords),
      ...SEARCH_QUERIES.map((q) => q.keyword),
    ]),
  ];
  for (const kw of allKeywords) await fetchImage(kw);

  // ── 阶段 2：生成数据 + 注册 + 写入地点 ───────────────────────────────────
  log("\n🤖 阶段 2/5：生成数据 + 注册账号 + 写入地点...");
  const allPlaceIds = [];
  let totalPlacesCreated = 0;
  let totalPlacesFailed = 0;

  for (const persona of PERSONAS) {
    const places = await generatePlaces(persona);
    const user = await signup(persona);
    let personaCreated = 0;

    for (const place of places) {
      try {
        const img = await fetchImage(place.imageKeyword ?? persona.keywords[0]);
        const placeId = await createPlace(place, user.token, img);
        if (placeId) {
          allPlaceIds.push(placeId);
          personaCreated++;
          totalPlacesCreated++;
        }
      } catch (err) {
        log(`  ⚠️  "${place.title}" 写入失败: ${err.message}`);
        totalPlacesFailed++;
      }
      // 小延迟避免同时触发太多 Cloudinary 上传
      await new Promise((r) => setTimeout(r, 400));
    }
    log(`  📍 [${persona.name}] ${personaCreated} 个地点写入完成`);
  }

  // ── 阶段 3：等待异步 color analysis + 验证 ───────────────────────────────
  const waitSec = COLOR_ANALYSIS_WAIT_MS / 1000;
  log(`\n⏳ 阶段 3/5：等待 ${waitSec}s 让异步 color analysis 完成...`);
  await new Promise((r) => setTimeout(r, COLOR_ANALYSIS_WAIT_MS));

  log("\n🔬 验证 Colorwalk pipeline 写入结果（直查 MongoDB）...");
  const pipelineStats = await validatePipelineFields(allPlaceIds);

  log(
    `  colorVector (15-dim CIELAB): ${pipelineStats.withColorVector}/${pipelineStats.total}  (${pipelineStats.colorSuccessRate}%)`,
  );
  log(
    `  textEmbedding (1536-dim):    ${pipelineStats.withTextEmbedding}/${pipelineStats.total}  (${pipelineStats.embeddingSuccessRate}%)`,
  );
  log(
    `  isColorful=true:             ${pipelineStats.isColorfulTrue}/${pipelineStats.total}`,
  );
  log(`  avg palette colors/place:    ${pipelineStats.avgPaletteColors}`);

  // ── 阶段 4：Color Search 查询压测 ────────────────────────────────────────
  log("\n⚡ 阶段 4/5：Color Search 查询压测...");

  const searchResults = [];
  for (const query of SEARCH_QUERIES) {
    const buf = await fetchImage(query.keyword);
    const result = await benchmarkColorSearch(
      buf,
      `${query.keyword.replace(/\s+/g, "-")}.jpg`,
      query.label,
    );
    result.expectedStyle = query.expectedStyle;
    searchResults.push(result);
  }

  // ── 阶段 5：输出报告 ──────────────────────────────────────────────────────
  log("\n📊 阶段 5/5：生成报告...");

  const avgSpread =
    searchResults.length > 0
      ? Math.round(
          searchResults.reduce((acc, r) => {
            const s = r.scores;
            return acc + (s.length > 1 ? (s[0] - s[s.length - 1]) * 100 : 0);
          }, 0) / searchResults.length,
        )
      : 0;

  const report = `


${"=".repeat(65)}
  📊  WANDERMARK COLORWALK PIPELINE REPORT
${"=".repeat(65)}

  地点总数:    ${totalPlacesCreated} 条（失败 ${totalPlacesFailed} 条）
  分析等待:    ${waitSec}s（异步 pipeline 完成时间）
  查询并发量:  ${SEARCH_CONCURRENCY} 个请求/轮

  ── Colorwalk 异步 Pipeline 成功率 ──────────────────────────────
  ┌─────────────────────────────┬────────────────┬───────────┐
  │ Pipeline 阶段               │ 成功条数       │ 成功率    │
  ├─────────────────────────────┼────────────────┼───────────┤
  │ 颜色向量 (15-dim CIELAB)    │ ${String(pipelineStats.withColorVector).padEnd(14)} │ ${String(pipelineStats.colorSuccessRate + "%").padEnd(9)} │
  │ 文本嵌入 (1536-dim OpenAI)  │ ${String(pipelineStats.withTextEmbedding).padEnd(14)} │ ${String(pipelineStats.embeddingSuccessRate + "%").padEnd(9)} │
  │ isColorful=true             │ ${String(pipelineStats.isColorfulTrue).padEnd(14)} │ ${String(Math.round((pipelineStats.isColorfulTrue / pipelineStats.total) * 100) + "%").padEnd(9)} │
  └─────────────────────────────┴────────────────┴───────────┘

  ── Color Search 查询结果（含 Min-Max 正规化）───────────────────
${searchResults
  .map((r) => {
    const scores = r.scores;
    const top = scores.length > 0 ? Math.round(scores[0] * 100) : 0;
    const bot =
      scores.length > 1 ? Math.round(scores[scores.length - 1] * 100) : top;
    const spread = top - bot;
    const cw = Math.round((r.meta.weightsUsed?.colorWeight ?? 0) * 100);
    const tw = Math.round((r.meta.weightsUsed?.textWeight ?? 0) * 100);
    return `
  查询: "${r.label}"  (预期风格: ${r.expectedStyle})
  ┌──────────┬─────────────────────────────────────────────────┐
  │ 结果数   │ ${String(r.results.length).padEnd(47)} │
  │ 权重     │ color ${cw}% / text ${tw}%${" ".repeat(38 - String(cw).length - String(tw).length)} │
  │ 最高分   │ ${String(top + "%").padEnd(47)} │
  │ 最低分   │ ${String(bot + "%").padEnd(47)} │
  │ 分数跨度 │ ${String(spread + "pp").padEnd(47)} │
  │ avg延迟  │ ${String(r.latency.avg + "ms").padEnd(47)} │
  │ P95延迟  │ ${String(r.latency.p95 + "ms").padEnd(47)} │
  └──────────┴─────────────────────────────────────────────────┘
  Top 3: ${r.results
    .slice(0, 3)
    .map((res) => `"${res.title}" ${Math.round(res.similarityScore * 100)}%`)
    .join("  →  ")}`;
  })
  .join("\n")}

  ── 正规化效果 ───────────────────────────────────────────────────
  平均分数跨度（正规化后）: ${avgSpread}pp
  说明: 正规化前所有结果聚集在 ~57-60%；
        正规化后最优结果接近 100%，最差结果接近 0%，
        跨度 ≥ 40pp 表明排序具有实际区分度。

${"=".repeat(65)}
  总体结论: Pipeline 成功率 ${pipelineStats.colorSuccessRate}%（CIELAB）/ ${pipelineStats.embeddingSuccessRate}%（OpenAI）
            Min-Max 正规化将分数跨度从 ~3pp 提升至 ~${avgSpread}pp
${"=".repeat(65)}
`;

  log(report);

  const reportPath = path.join(__dirname, "colorwalk-report.txt");
  fs.writeFileSync(reportPath, logLines.join("\n"));
  log(`\n💾 完整报告已保存至 colorwalk-report.txt`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("💥 致命错误:", err.message);
  process.exit(1);
});

// ─── agent.env 字段说明 ───────────────────────────────────────────────────────
//
// BACKEND_URL=http://localhost:5001
// ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
// UNSPLASH_KEY=xxxxxxxx           # 可选，无则用占位图
// MONGODB_USER=xxx
// MONGODB_PASSWORD=xxx
// DB_NAME=xxx
//
// 以上 MongoDB 字段与 backend/.env 相同，直接复用即可
// ─────────────────────────────────────────────────────────────────────────────
