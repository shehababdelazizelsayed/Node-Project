const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const path = require('path');
const mongoose = require("mongoose");
const app = express();
const port = 5000;

const {
  verifyToken,
  authorizeRoles
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
const { log } = require("console");






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

app.patch("/api/Users/Profile", verifyToken, UserUpdate);

// Books Routes
app.get("/api/Books", GetBooks);
app.post(
  "/api/Books",
  verifyToken,
  authorizeRoles("Owner", "Admin"),
  AddBook
);
app.put(
  "/api/Books/:id",
  verifyToken,
  authorizeRoles("Owner", "Admin"),
  UpdateBooks
);
app.delete(
  "/api/Books/:id",
  verifyToken,
  authorizeRoles("Owner", "Admin"),
  DeleteBook
);

// Cart Routes
app.post("/api/Cart", verifyToken, AddToCart);
app.get("/api/Cart", verifyToken, GetCart);
app.delete("/api/Cart/:id", verifyToken, RemoveFromCart);

//  Orders Routes
app.post("/api/Orders", verifyToken, CreateOrder);
app.get("/api/Orders", verifyToken, GetOrders);

//  Reviews Routes
app.post("/api/Reviews", verifyToken, CreateReview);
app.get("/api/Reviews/:id", GetBookReviews);
app.put("/api/Review/:id", verifyToken, EditReview);
app.delete("/api/Review/:id", verifyToken, DeleteReview);

//  BookUsers Routes
app.get("/api/BookUsers", verifyToken, getAllBookUsers);

//uploads
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
  console.log("server is running on port " + port);
});