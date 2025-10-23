require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000;

// Helpers & Routes
const upload = require("./Helpers/upload");
const uploadRoute = require("./routes/uploadRoute");

// Import payment controller functions directly
const {
  createPaymentIntent,
  processPayment,
  confirmPayment,
  getPaymentStatus,
  handleWebhook,
  refundPayment,
} = require("./Controllers/payment.Controller");

// Middleware & Controllers
const {
  verifyToken: authMiddleware,
  authorizeRoles,
} = require("./middlewares/auth");

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

// ------------------------ MIDDLEWARE ------------------------ //
// Stripe webhook must come **before express.json()**
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// JSON parsing for all other routes
app.use(express.json());

// Static folders
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ------------------------ MONGO ------------------------ //
mongoose
  .connect(process.env.Mongo_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

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

// ------------------------ AI ROUTE ------------------------ //
app.post("/api/ai", authMiddleware, queryBooksWithAI);

// ------------------------ PAYMENT ROUTES ------------------------ //
// Create payment intent
app.post(
  "/api/payment/create-payment-intent",
  authMiddleware,
  createPaymentIntent
);

// Confirm payment and create order
app.post("/api/payment/confirm-payment", authMiddleware, confirmPayment);

// Get payment status
app.get(
  "/api/payment/status/:paymentIntentId",
  authMiddleware,
  getPaymentStatus
);

// Refund payment (Admin only)
app.post(
  "/api/payment/refund",
  authMiddleware,
  authorizeRoles("Admin", "Owner"),
  refundPayment
);
app.post("/api/payment/process-payment", authMiddleware, processPayment);

// ------------------------ UPLOAD ROUTE ------------------------ //
app.use("/api", uploadRoute);

// ------------------------ ERROR HANDLER ------------------------ //
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ------------------------ 404 HANDLER ------------------------ //
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});

// ------------------------ SERVER ------------------------ //
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
