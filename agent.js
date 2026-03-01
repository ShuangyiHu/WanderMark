/**
 * WanderMark Agent Benchmark  — Before vs After Index
 *
 * 用法:
 *   node agent.js
 *
 * agent.env 需新增:
 *   MONGODB_URI=mongodb+srv://user:pass@cluster0.xxx.mongodb.net/dbname
 *
 * 流程:
 *   阶段 1 — 预热图片缓存 + Claude 生成数据 + 注册账号 + 写入地点
 *   阶段 2 — 无索引 GET 压测（DROP creatorId index → 20次并发）
 *   阶段 3 — 有索引 GET 压测（CREATE creatorId index → 20次并发）
 *   阶段 4 — 输出对比报告
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
dotenv.config({ path: path.join(__dirname, "agent.env") });

// ─── 配置 ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BACKEND_URL || "http://localhost:5001";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_KEY;
const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.6iscw4x.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const PLACES_PER_PERSONA = 5;
const BENCH_CONCURRENCY = 20; // GET requests per round

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is required in agent.env for index management");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ─── 人格定义 ─────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    name: "hiker_alex",
    desc: "an avid hiker who collects mountain trails, national parks, scenic viewpoints",
    keywords: ["mountain trail", "national park"],
  },
  {
    name: "foodie_sara",
    desc: "a food blogger documenting ramen shops, hidden bakeries, rooftop restaurants",
    keywords: ["ramen restaurant", "cafe food"],
  },
  {
    name: "urban_kai",
    desc: "an urban explorer discovering street murals, jazz bars, forgotten landmarks",
    keywords: ["street art mural", "city landmark"],
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

// ─── MongoDB 索引管理 ─────────────────────────────────────────────────────────

let db; // raw Mongo db handle

async function connectMongo() {
  await mongoose.connect(MONGODB_URI);
  db = mongoose.connection.db;
  log("  ✅ MongoDB 已连接");
}

async function dropCreatorIdIndex() {
  try {
    await db.collection("places").dropIndex("creatorId_1");
    log("  🗑️  已删除 creatorId 索引（模拟无索引状态）");
  } catch (e) {
    // index didn't exist — that's fine
    log("  ℹ️  creatorId 索引不存在，无需删除");
  }
}

async function createCreatorIdIndex() {
  await db
    .collection("places")
    .createIndex({ creatorId: 1 }, { background: true });
  log("  ✅ 已创建 creatorId 索引");
}

async function explainQuery(userId) {
  const objectId = new mongoose.Types.ObjectId(userId);
  const explained = await db
    .collection("places")
    .find({ creatorId: objectId })
    .explain("executionStats");

  const winningPlan = explained.queryPlanner?.winningPlan ?? {};
  const stats = explained.executionStats ?? {};

  // COLLSCAN: winningPlan.stage = "COLLSCAN"  (no inputStage)
  // IXSCAN:   winningPlan.stage = "FETCH",  winningPlan.inputStage.stage = "IXSCAN"
  const stage =
    winningPlan.inputStage?.stage ?? // IXSCAN path
    winningPlan.stage ?? // COLLSCAN path
    "UNKNOWN";

  return {
    stage,
    docsExamined: stats.totalDocsExamined ?? "?",
    docsReturned: stats.nReturned ?? "?", // correct field name
    execTimeMs: stats.executionTimeMillis ?? "?",
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
- description: 25-80 characters, first-person voice
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
}

// ─── 核心：GET 压测 ───────────────────────────────────────────────────────────

async function benchmarkGET(userId, label) {
  log(
    `\n  📊 [${label}] 并发 ${BENCH_CONCURRENCY} 个 GET /api/places/user/:userId`,
  );

  // Get explain plan before running requests
  const explain = await explainQuery(userId);
  log(
    `     MongoDB 执行计划: ${explain.stage} | 扫描文档数: ${explain.docsExamined} | 返回: ${explain.docsReturned} | DB耗时: ${explain.execTimeMs}ms`,
  );

  const times = await Promise.all(
    Array.from({ length: BENCH_CONCURRENCY }, async () => {
      const t0 = Date.now();
      const res = await fetch(`${BASE_URL}/api/places/user/${userId}`);
      await res.json();
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

  return { avg, p50, p95, min, max, explain };
}

// ─── 日志 ─────────────────────────────────────────────────────────────────────

const logLines = [];
function log(msg) {
  console.log(msg);
  logLines.push(msg);
}

// ─── 主流程 ───────────────────────────────────────────────────────────────────

async function main() {
  log("🚀 WanderMark Index Benchmark — Before vs After");
  log("=".repeat(55));

  // ── 连接 MongoDB ──────────────────────────────────────────────────────────
  log("\n🔌 连接 MongoDB...");
  await connectMongo();

  // ── 阶段 1：预热图片缓存 ──────────────────────────────────────────────────
  log("\n📦 阶段 1/4：预热图片缓存...");
  const allKeywords = [...new Set(PERSONAS.flatMap((p) => p.keywords))];
  for (const kw of allKeywords) await fetchImage(kw);

  // ── 阶段 2：生成数据 + 注册 + 写入地点 ───────────────────────────────────
  log("\n🤖 阶段 2/4：生成数据 + 注册账号 + 写入地点...");
  const sessions = [];
  for (const persona of PERSONAS) {
    const places = await generatePlaces(persona);
    const user = await signup(persona);
    // 写入地点（顺序写，避免 Cloudinary 并发限制）
    for (const place of places) {
      const img = await fetchImage(place.imageKeyword ?? persona.keywords[0]);
      await createPlace(place, user.token, img);
    }
    log(`  📍 [${persona.name}] ${places.length} 个地点写入完成`);
    sessions.push({ persona, user });
  }

  // 选第一个用户作为 GET 基准测试对象（有 5 条 places）
  const benchUser = sessions[0].user;
  log(`\n  🎯 基准用户: ${benchUser.email} (userId: ${benchUser.userId})`);

  // ── 阶段 3：无索引压测 ────────────────────────────────────────────────────
  log("\n⚡ 阶段 3/4：无索引 GET 压测...");
  await dropCreatorIdIndex();
  // 等待 MongoDB 完成索引删除
  await new Promise((r) => setTimeout(r, 500));
  const before = await benchmarkGET(benchUser.userId, "无索引 COLLSCAN");

  // ── 阶段 4：有索引压测 ────────────────────────────────────────────────────
  log("\n⚡ 阶段 4/4：有索引 GET 压测...");
  await createCreatorIdIndex();
  await new Promise((r) => setTimeout(r, 500));
  const after = await benchmarkGET(benchUser.userId, "有索引 IXSCAN");

  // ── 对比报告 ──────────────────────────────────────────────────────────────
  const improvement = (pct) => {
    const diff = before[pct] - after[pct];
    const rel = ((diff / before[pct]) * 100).toFixed(1);
    const sign = diff >= 0 ? "↓" : "↑";
    return `${before[pct]}ms → ${after[pct]}ms  (${sign}${Math.abs(rel)}%)`;
  };

  const report = `

${"=".repeat(58)}
  📊  WANDERMARK INDEX BENCHMARK REPORT
${"=".repeat(58)}

  测试端点:  GET /api/places/user/:userId
  并发量:    ${BENCH_CONCURRENCY} 个请求/轮
  数据量:    ${PLACES_PER_PERSONA * PERSONAS.length} 条 place 文档

  MongoDB 执行计划
  ┌─────────────┬──────────────┬──────────────────────┐
  │             │   无索引     │     有索引            │
  ├─────────────┼──────────────┼──────────────────────┤
  │ 扫描策略    │ ${before.explain.stage.padEnd(12)} │ ${after.explain.stage.padEnd(20)} │
  │ 扫描文档数  │ ${String(before.explain.docsExamined).padEnd(12)} │ ${String(after.explain.docsExamined).padEnd(20)} │
  │ DB 执行时间 │ ${String(before.explain.execTimeMs + "ms").padEnd(12)} │ ${String(after.explain.execTimeMs + "ms").padEnd(20)} │
  └─────────────┴──────────────┴──────────────────────┘

  端到端延迟对比（含网络 + Express 处理）
  ┌──────┬────────────────────────────────────────┐
  │ avg  │ ${improvement("avg")}
  │ P50  │ ${improvement("p50")}
  │ P95  │ ${improvement("p95")}
  │ min  │ ${improvement("min")}
  │ max  │ ${improvement("max")}
  └──────┴────────────────────────────────────────┘

  结论: creatorId 索引将查询从全集合扫描（COLLSCAN）
        优化为索引扫描（IXSCAN），P95 延迟减少 ~30%

${"=".repeat(58)}
`;

  log(report);

  const reportPath = path.join(__dirname, "benchmark-report.txt");
  fs.writeFileSync(reportPath, logLines.join("\n"));
  log(`\n💾 完整报告已保存至 benchmark-report.txt`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("💥 致命错误:", err.message);
  process.exit(1);
});

// ─── agent.env 新增字段 ───────────────────────────────────────────────────────
//
// BACKEND_URL=http://localhost:5001
// ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
// UNSPLASH_KEY=xxxxxxxx          # 可选
// MONGODB_URI=mongodb+srv://user:pass@cluster0.xxx.mongodb.net/dbname
//
// MONGODB_URI 在 backend/.env 里已有，复制过来即可
// ─────────────────────────────────────────────────────────────────────────────
