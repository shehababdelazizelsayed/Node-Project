// ------------------------ CONFIG & IMPORTS ------------------------ //
require("dotenv").config();
const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const http = require("http");

const app = express();
const port = process.env.PORT || 5000;

// ------------------------ SOCKET.IO SETUP ------------------------ //
const server = http.createServer(app);
const SocketManager = require("./SocketManager");
try {
  SocketManager.init(server);
  console.log("[WebSocket] Socket.IO initialized successfully");
} catch (err) {
  console.error("[WebSocket] Failed to initialize Socket.IO:", err);
  process.exit(1);
}

// ------------------------ HELPERS & ROUTES ------------------------ //
const upload = require("./Helpers/upload");
const uploadRoute = require("./routes/uploadRoute");
const paymentRoutes = require("./routes/payment");

// Middleware & Controllers
const { authMiddleware, authorizeRoles } = require("./Helpers/auth.middleware");

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

const { CreateOrder, GetOrders } = require("./Controllers/Orders.Controller");

const {
  CreateReview,
  GetBookReviews,
  EditReview,
  DeleteReview,
} = require("./Controllers/Review.Controller");

const { getAllBookUsers } = require("./Controllers/BookUsers.Controller");

const { queryBooksWithAI } = require("./Controllers/ai.controller");

// ------------------------ DATABASE ------------------------ //
mongoose
  .connect(process.env.Mongo_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// ------------------------ MIDDLEWARE ------------------------ //
app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------------ USERS ROUTES ------------------------ //
app.post("/api/Users/Register", UserRegister);
app.post("/api/Users/Login", UserLogin);
app.get("/api/Users/verify/:token", VerifyEmail);
app.post("/api/Users/forgot-password", ForgotPassword);
app.post("/api/Users/reset-password/:token", ResetPassword);
app.patch("/api/Users/Profile", authMiddleware, UserUpdate);

// ------------------------ BOOKS ROUTES ------------------------ //
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

// ------------------------ CART ROUTES ------------------------ //
app.post("/api/Cart", authMiddleware, AddToCart);
app.get("/api/Cart", authMiddleware, GetCart);
app.delete("/api/Cart/:id", authMiddleware, RemoveFromCart);

// ------------------------ ORDERS ROUTES ------------------------ //
app.post("/api/Orders", authMiddleware, CreateOrder);
app.get("/api/Orders", authMiddleware, GetOrders);

// ------------------------ REVIEWS ROUTES ------------------------ //
app.post("/api/Reviews", authMiddleware, CreateReview);
app.get("/api/Reviews/:id", GetBookReviews);
app.put("/api/Review/:id", authMiddleware, EditReview);
app.delete("/api/Review/:id", authMiddleware, DeleteReview);

// ------------------------ BOOKUSERS ROUTES ------------------------ //
app.get("/api/BookUsers", authMiddleware, getAllBookUsers);

// ------------------------ LOGIN LOGS (ADMIN ONLY) ------------------------ //
app.get(
  "/api/auth/logs",
  authMiddleware,
  authorizeRoles("Admin", "Owner"),
  async (req, res) => {
    try {
      const { getRecentLoginLogs } = require("./utils/logger");
      const logs = await getRecentLoginLogs(100);
      return res.status(200).json({ logs });
    } catch (error) {
      console.error("Error fetching login logs:", error);
      return res.status(500).json({ message: "Failed to fetch login logs" });
    }
  }
);

// ------------------------ AI ROUTE ------------------------ //
app.post("/api/ai", authMiddleware, queryBooksWithAI);

// ------------------------ PAYMENT ROUTES ------------------------ //
app.use("/api/payment", paymentRoutes);

// ------------------------ UPLOAD ROUTE ------------------------ //
app.use("/api", uploadRoute);

// ------------------------ WEBSOCKET NOTIFICATION ROUTES ------------------------ //
// Broadcast to all connected clients
app.post("/api/notify", (req, res) => {
  const { event = "notification", payload = {} } = req.body || {};
  SocketManager.broadcast(event, payload);
  return res.status(200).json({ ok: true, broadcast: true });
});

// Notify a specific user by userId
app.post("/api/notify/:userId", (req, res) => {
  const { userId } = req.params;
  const { event = "notification", payload = {} } = req.body || {};
  const sent = SocketManager.notifyUser(userId, event, payload);
  if (!sent)
    return res.status(404).json({ ok: false, message: "user not connected" });
  return res.status(200).json({ ok: true, to: userId });
});

// Debug route for sockets
app.get("/api/socket-debug", (req, res) => {
  try {
    const debug = SocketManager._debug && SocketManager._debug();
    return res.status(200).json({ ok: true, debug });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ------------------------ ERROR HANDLERS ------------------------ //
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ------------------------ SERVER ------------------------ //
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
