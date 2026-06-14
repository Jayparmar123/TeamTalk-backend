# 🚀 TeamTalk Backend – Real-Time Chat API & Socket Server

A scalable backend service built with **Node.js**, **Express.js**, **MongoDB**, and **Socket.IO** that powers the TeamTalk real-time communication platform.

The backend handles authentication, authorization, real-time messaging, user management, online presence tracking, token refresh mechanisms, and administrative controls.

## 🚀 Features

* 🔐 JWT Authentication
* 🍪 Secure Refresh Token Cookies
* 👥 User Management
* 💬 Real-Time Messaging
* ⚡ Typing Indicators
* 🟢 Online / Offline Presence Tracking
* 🛡️ Role-Based Authorization
* 📌 Conversation Management
* 🔄 Automatic Token Refresh
* 🌐 RESTful API Architecture
* 🔗 Socket.IO Integration

## 📸 Production API

Base URL:

```text
https://teamtalk-backend-tb7m.onrender.com/api
```

## 🛠️ Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=nodejs,express,mongodb,git,github,vscode" alt="Backend Tech Stack" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
</p>

## 📂 Project Structure

```bash
src/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── sockets/
├── utils/
└── server.js
```

## 🔐 Authentication Flow

1. User logs in with credentials.
2. Backend validates user information.
3. Access Token is generated.
4. Refresh Token is stored in a secure HTTP-only cookie.
5. Frontend automatically refreshes expired access tokens.
6. Socket.IO connections are authenticated using JWT.

## ⚙️ Environment Variables

Create a `.env` file:

```env
NODE_ENV=development

PORT=5000

MONGODB_URI=your_mongodb_connection

JWT_SECRET=your_jwt_secret

JWT_REFRESH_SECRET=your_refresh_secret

JWT_EXPIRE=15m

JWT_REFRESH_EXPIRE=7d

COOKIE_EXPIRE=7

CLIENT_URL=http://localhost:5173
```

## 🚀 Installation

```bash
git clone <repository-url>

cd teamtalk-backend

npm install

npm run dev
```

## 🔌 API Modules

### Authentication

```text
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
```

### Users

```text
GET    /api/users
GET    /api/users/:id
PATCH  /api/users/:id
```

### Conversations

```text
GET    /api/conversations
POST   /api/conversations
```

### Messages

```text
GET    /api/messages
POST   /api/messages
PATCH  /api/messages/:id
DELETE /api/messages/:id
```

## ⚡ Socket.IO Events

### Client → Server

```text
message:send
message:edit
message:delete
typing:start
typing:stop
```

### Server → Client

```text
message:receive
message:edit
message:delete
typing:status
user:online
user:offline
member:join
member:leave
member:update
auth:logout
```

## 👨‍💻 Author

### Jay Parmar

GitHub: https://github.com/Jayparmar123

LinkedIn: https://www.linkedin.com/in/jay-parmar-10465a2b3/
