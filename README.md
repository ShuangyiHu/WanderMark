# 🗺️ WanderMark — Location Bookmarking Platform with Visual Discovery

WanderMark is a full-stack MERN application for saving and sharing places you want to visit. It combines a production-ready CRUD platform with an AI-powered color analysis pipeline that enables visual mood-based discovery — finding locations not by keyword, but by the way they look and feel.

---

## 🏗️ Architecture Overview

```
Frontend (React)
    ↓  REST API
Backend (Express + Node.js)
    ↓  Mongoose ODM
MongoDB Atlas
    ↑
Cloudinary (image storage)
    ↑
Color Analysis Pipeline (node-vibrant + OpenAI Embeddings)
```

---

## 🚀 Tech Stack

### Core

- **MongoDB Atlas** — document storage with optional vector fields for color data
- **Express.js** — RESTful API server
- **React.js** — SPA frontend with hooks and context
- **Node.js** — runtime

### Performance & Infrastructure (v1 Optimizations)

- **Cloudinary** — async image upload with optimistic UI
- **MongoDB indexing** — strategic compound indexes reducing query latency
- **Async image processing** — non-blocking upload pipeline with shimmer animations

### AI & Visual Discovery (Colorwalk)

- **node-vibrant** — palette extraction from uploaded images
- **CIELAB color space** — perceptually uniform color representation (vs RGB)
- **15-dimensional color vectors** — normalized Lab vectors for cosine similarity search
- **OpenAI text-embedding-3-small** — 1536-dim semantic embeddings from place descriptions
- **Hybrid similarity scoring** — adaptive weighting between color and text signals

---

## ✨ Features

### Core Platform

- 📍 Bookmark places with name, address, description, and image
- 🗺️ Map-based visualization with Google Maps
- 🔐 JWT-based user authentication
- 🔄 Full CRUD for location posts
- 🌐 Browse places shared by other users

### Colorwalk — Visual Discovery

- 🎨 **Automatic color analysis** — every uploaded image is analyzed asynchronously; the main API response is never blocked
- 🔬 **CIELAB color extraction** — 5 dominant colors converted from RGB to perceptually-uniform Lab space, stored as a 15-dim normalized vector
- 🧠 **Text embedding** — place title + description encoded into a 1536-dim semantic vector
- 🔍 **Hybrid similarity search** — find places by uploading a photo; similarity score combines color vector and text embedding with adaptive weights based on image quality
- 🗺️ **Color-coded map pins** — markers rendered in each place's dominant hex color

---

## 🧬 Colorwalk Technical Design

### Why CIELAB instead of RGB?

RGB Euclidean distance does not correspond to human-perceived color difference. CIELAB is specifically designed so that equal distances in the color space correspond to equal perceived differences (ΔE). This means similarity search results match what users actually see.

```
RGB space:  pure red [255,0,0] vs deep red [200,0,0]  → distance = 55
            pure red [255,0,0] vs orange-red [255,69,0] → distance = 69
            (mathematically farther, but looks closer to human eye)

CIELAB:     ΔE accurately reflects perceived difference in both cases
```

### Adaptive Hybrid Scoring

When a user queries by image, the system calculates:

```
score = α × cosine(colorVector) + β × cosine(textEmbedding)
```

The weights α and β adapt based on image quality:

| Image quality              | α (color) | β (text) |
| -------------------------- | --------- | -------- |
| Colorful, distinct palette | 0.6       | 0.4      |
| Low color variance / muted | 0.2       | 0.8      |
| Color analysis unavailable | 0.0       | 1.0      |

This means a poorly-lit or low-saturation photo gracefully falls back to text-based retrieval rather than returning meaningless results.

### Async Pipeline Design

```
POST /api/places
    ↓
Save place to MongoDB          ← immediate
res.status(201).json()         ← user gets response here, no waiting
    ↓ setImmediate()
analyzeImageColor(imageUrl)    ← non-blocking, runs after response
    ↓
node-vibrant palette extraction
    ↓
RGB → CIELAB conversion
    ↓
Build 15-dim normalized vector
    ↓
isColorful check (std dev threshold)
    ↓
OpenAI text-embedding-3-small
    ↓
Place.findByIdAndUpdate()      ← writes color fields back to document
```

Failures at any step are caught silently — a color analysis error never affects the user's place creation.

---

## 🧱 Project Structure

```
WanderMark/
├── backend/
│   ├── controllers/
│   │   └── places-controller.js   # CRUD + async color trigger
│   ├── middleware/
│   │   ├── check-auth.js
│   │   ├── file-upload.js         # Cloudinary + multer
│   │   └── file-upload-wrapper.js
│   ├── models/
│   │   ├── place.js               # Extended with color fields
│   │   └── user.js
│   ├── routes/
│   │   ├── places-routes.js
│   │   └── users-routes.js
│   └── util/
│       ├── cloudinary.js
│       ├── color-service.js       # Colorwalk pipeline (NEW)
│       └── location.js
│
└── frontend/
    └── src/
        ├── places/
        │   ├── components/
        │   └── pages/
        ├── shared/
        └── users/
```

---

## 🛠️ Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/ShuangyiHu/WanderMark.git
cd WanderMark
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in `/backend`:

```env
MONGODB_USER=your_user
MONGODB_PASSWORD=your_password
DB_NAME=your_db
JWT_KEY=your_jwt_secret
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_SECRET=your_secret
OPENAI_API_KEY=your_openai_key
```

```bash
npm start
# Backend runs on http://localhost:5001
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
# Frontend runs on http://localhost:3000
```

---

## 📌 API Reference

### Core Endpoints (v1)

| Method | Route                      | Description                  |
| ------ | -------------------------- | ---------------------------- |
| GET    | `/api/places/:placeId`     | Get place by ID              |
| GET    | `/api/places/user/:userId` | Get all places by user       |
| POST   | `/api/places`              | Create place (auth required) |
| PATCH  | `/api/places/:placeId`     | Update place (auth required) |
| DELETE | `/api/places/:placeId`     | Delete place (auth required) |
| GET    | `/api/users`               | Get all users                |
| POST   | `/api/users/login`         | Login                        |
| POST   | `/api/users/signup`        | Signup                       |

### Colorwalk Endpoints (v2)

| Method | Route                      | Description                                  |
| ------ | -------------------------- | -------------------------------------------- |
| POST   | `/api/places/search/color` | Find visually similar places by image upload |
| GET    | `/api/places/filter/color` | Filter places by color mood                  |

### Example: Create a Place

```http
POST /api/places
Content-Type: multipart/form-data
Authorization: Bearer <token>

title=Golden Gate Bridge
description=Iconic bridge with stunning bay views
address=Golden Gate Bridge, San Francisco, CA
image=<file>
```

---

## 🗄️ Data Model

### Place Schema

```js
{
  // Core fields (v1)
  title: String,
  description: String,
  address: String,
  coordinates: { lat: Number, lng: Number },
  image: String,           // Cloudinary URL
  creatorId: ObjectId,

  // Colorwalk fields (v2, all optional)
  colorPalette: [{
    hex: String,           // "#FF6B35"
    lab: [Number],         // [L, a, b] in CIELAB
    population: Number     // relative weight in image
  }],
  colorVector: [Number],   // 15-dim normalized Lab vector
  textEmbedding: [Number], // 1536-dim OpenAI embedding
  isColorful: Boolean,     // drives adaptive weight selection
  colorAnalyzedAt: Date
}
```

---

## 🔮 Roadmap

- [ ] **Phase 2** — Text embedding pipeline (OpenAI `text-embedding-3-small`)
- [ ] **Phase 3** — Hybrid similarity search endpoint with adaptive scoring
- [ ] **Phase 4** — Color-coded map pins + ColorSearch UI
- [ ] MongoDB Atlas Vector Search index for ANN queries at scale
- [ ] Benchmarking agent for color pipeline performance measurement

---

## 📄 License

This project is for educational and portfolio purposes.
