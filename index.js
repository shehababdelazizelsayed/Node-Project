
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const http = require("http");
const app = express();
const port = 5000;
const { swaggerUi, specs } = require("./swagger");
const { connectRedis } = require("./utils/redis");
const { requestLogger } = require("./utils/loggingMiddleware");

const server = http.createServer(app);
const cors = require("cors");
const SocketManager = require("./SocketManager");
try {
  SocketManager.init(server);
  console.log("Websocket success");
} catch (err) {
  console.error("Websocket failed cause", err);
  process.exit(1);
}
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

// Initialize Redis
connectRedis();

// Add logging middleware
app.use(requestLogger);

const uploadRoute = require("./routes/uploadRoute");
app.use("/api", uploadRoute);

const upload = require("./Helpers/upload");

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
const { log } = require("console");
const { queryBooksWithAI } = require("./Controllers/ai.controller");

mongoose
  .connect(process.env.Mongo_URL)
  .then(() => console.log("Connected!"))
  .catch(() => {
    console.log("Connected Failed ");
  });

// Make Redis client available app-wide
const { getClient } = require("./utils/redis");
app.set("redis", getClient());


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
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]),
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

// Payment routes
const paymentRoutes = require("./routes/payment");
app.use("/api/payment", paymentRoutes);

/**
 * @swagger
 * /api/notify:
 *   post:
 *     summary: Send WebSocket notification to all connected clients
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *                 description: Type of notification
 *               message:
 *                 type: string
 *                 description: Notification message
 *               data:
 *                 type: object
 *                 description: Additional data for the notification
 *             example:
 *               type: "info"
 *               message: "New book added"
 *               data: { bookId: "123" }
 *     responses:
 *       200:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

// WebSocket notification routes
app.post("/api/notify", authMiddleware, (req, res) => {
  try {
    const { type, message, data } = req.body;
    if (!type || !message) {
      return res.status(400).json({ error: "Type and message are required" });
    }

    // Broadcast to all connected clients
    SocketManager.broadcast("notification", {
      type,
      message,
      data,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Websocket failed cause", error);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

//uploads
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

server.listen(port, () => {
  console.log("server is running on port " + port);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
app.post("/api/ai", authMiddleware, queryBooksWithAI);
