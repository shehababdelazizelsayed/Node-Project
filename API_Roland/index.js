const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const app = express();
const port = 5000;
const { swaggerUi, specs } = require('./swagger');


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

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

//uploads
app.use("/static", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(port, () => {
  console.log("server is running on port " + port);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
app.post("/api/ai", authMiddleware, queryBooksWithAI);
