const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const app = express();
const http = require("http");
const port = process.env.PORT || 5000;

// Create HTTP server early
const server = http.createServer(app);

// Initialize socket.io before routes
const SocketManager = require("./SocketManager");
try {
  SocketManager.init(server);
  console.log("[WebSocket] Socket.IO initialized successfully");
} catch (err) {
  console.error("[WebSocket] Failed to initialize Socket.IO:", err);
  process.exit(1);
}

const uploadRoute = require("./routes/uploadRoute");
app.use("/api", uploadRoute);

const upload = require("./Helpers/upload");

const {
  authMiddleware,
  authorizeRoles
} = require("./Helpers/auth.middleware");
const {
  UserLogin,
  UserRegister,
  UserUpdate,
  VerifyEmail,
  ForgotPassword,
  ResetPassword,
} = require("./Controllers/Users.Controller");
const {
  AddBook,
  GetBooks,
  UpdateBooks,
  DeleteBook,
} = require("./Controllers/Books.Controller");
const {
  AddToCart,
  GetCart,
  RemoveFromCart,
} = require("./Controllers/Carts.Controller");
const {
  CreateOrder,
  GetOrders
} = require("./Controllers/Orders.Controller");
const {
  CreateReview,
  GetBookReviews,
  EditReview,
  DeleteReview,
} = require("./Controllers/Review.Controller");
const {
  getAllBookUsers
} = require("./Controllers/BookUsers.Controller");
const {
  log
} = require("console");
const {
  queryBooksWithAI
} = require("./Controllers/ai.controller");

mongoose
  .connect(process.env.Mongo_URL)
  .then(() => console.log("Connected!"))
  .catch(() => {
    console.log("Connected Failed ");
  });
console.log(process.env.Mongo_URL);

app.use(express.json());

//  Users Routes
app.post("/api/Users/Register", UserRegister);
app.post("/api/Users/Login", UserLogin);
app.get("/api/Users/verify/:token", VerifyEmail);
app.post("/api/Users/forgot-password", ForgotPassword);
app.post("/api/Users/reset-password/:token", ResetPassword);

app.patch("/api/Users/Profile", authMiddleware, UserUpdate);

// Books Routes
app.get("/api/Books", GetBooks);
app.post(
  "/api/Books",
  authMiddleware,
  authorizeRoles("Owner", "Admin"),
  upload.single("pdf"),
  AddBook
);
app.put(
  "/api/Books/:id",
  authMiddleware,
  authorizeRoles("Owner", "Admin"),
  UpdateBooks
);
app.delete(
  "/api/Books/:id",
  authMiddleware,
  authorizeRoles("Owner", "Admin"),
  DeleteBook
);

// Cart Routes
app.post("/api/Cart", authMiddleware, AddToCart);
app.get("/api/Cart", authMiddleware, GetCart);
app.delete("/api/Cart/:id", authMiddleware, RemoveFromCart);

//  Orders Routes
app.post("/api/Orders", authMiddleware, CreateOrder);
app.get("/api/Orders", authMiddleware, GetOrders);

//  Reviews Routes
app.post("/api/Reviews", authMiddleware, CreateReview);
app.get("/api/Reviews/:id", GetBookReviews);
app.put("/api/Review/:id", authMiddleware, EditReview);
app.delete("/api/Review/:id", authMiddleware, DeleteReview);

//  BookUsers Routes
app.get("/api/BookUsers", authMiddleware, getAllBookUsers);

// Login activity logs endpoint (admin only)
app.get("/api/auth/logs", authMiddleware, authorizeRoles("Admin", "Owner"), async (req, res) => {
  try {
    const { getRecentLoginLogs } = require("./utils/logger");
    const logs = await getRecentLoginLogs(100); // Last 100 login activities
    return res.status(200).json({ logs });
  } catch (error) {
    console.error("Error fetching login logs:", error);
    return res.status(500).json({ message: "Failed to fetch login logs" });
  }
});

//uploads
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// WebSocket notification endpoints
// broadcast to all connected clients
app.post("/api/notify", (req, res) => {
  const { event = "notification", payload = {} } = req.body || {};
  SocketManager.broadcast(event, payload);
  return res.status(200).json({ ok: true, broadcast: true });
});

// notify a specific user by userId
app.post("/api/notify/:userId", (req, res) => {
  const { userId } = req.params;
  const { event = "notification", payload = {} } = req.body || {};
  const sent = SocketManager.notifyUser(userId, event, payload);
  if (!sent) return res.status(404).json({ ok: false, message: "user not connected" });
  return res.status(200).json({ ok: true, to: userId });
});

// debug route to inspect connected socket users (development only)
app.get("/api/socket-debug", (req, res) => {
  try {
    const debug = SocketManager._debug && SocketManager._debug();
    return res.status(200).json({ ok: true, debug });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

server.listen(port, () => {
  console.log("server is running on port " + port);
});
app.post("/api/ai", authMiddleware, queryBooksWithAI);
