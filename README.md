# 🗺️ WanderMark -- Location Sharing Platform

WanderMark is a full-stack location-based social sharing web application
built using the MERN stack.\
It allows users to share places they have visited by uploading images,
descriptions, and geolocation data.

Users can explore posts shared by others and discover new locations
through an interactive interface.

---

## 🚀 Tech Stack

- MongoDB
- Express.js
- React.js
- Node.js
- RESTful APIs
- JavaScript (ES6+)

---

## ✨ Features

- 📍 Share visited places with:
  - Location name
  - Latitude & Longitude
  - Description
  - Image upload
- 🌐 Browse locations shared by other users
- 🔄 Full CRUD functionality for location posts
- 🔗 Frontend-backend integration via REST APIs
- ⚙️ Proxy-based routing for local development

---

## 🧱 Project Structure

WanderMark │ ├── frontend \# React client ├── backend \#
Express server └── README.md

---

## 🛠️ Setup Instructions

### 1️⃣ Clone the repository

git clone [https://github.com/ShuangyiHu/WanderMark.git](https://github.com/ShuangyiHu/WanderMark.git) cd WanderMark

---

### 2️⃣ Backend Setup

cd backend npm install npm start

Backend will run on:

http://localhost:5001

---

### 3️⃣ Frontend Setup

cd frontend npm install npm start

Frontend will run on:

http://localhost:3000

---

## 📌 API Example

Example request to create a location post:

POST /api/places

Request Body:

{ "name": "Golden Gate Bridge", "description": "Beautiful landmark in
San Francisco", "latitude": 37.8199, "longitude": -122.4783, "imageUrl":
"image-link" }

---

## 🧠 Future Improvements

- User authentication
- Map-based visualization
- Comments & likes
- Filtering by region
- Cloud image storage

---

## 📄 License

This project is for educational and portfolio purposes.
