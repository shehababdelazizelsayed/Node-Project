require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const port = process.env.PORT || 5000;

// Helpers & Routes
const upload = require("./Helpers/upload");
const uploadRoute = require("./routes/uploadRoute");
const paymentRoutes = require("./routes/payment.js");

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
  paymentRoutes
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
// Payment routes mounted after webhook
app.use("/api/payment", paymentRoutes);

// ------------------------ SERVER ------------------------ //
app.listen(port, () => {
  console.log("Server is running on port " + port);
});
