const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const mongoose = require("mongoose");
const {
  authMiddleware,
  authorizeRoles,
} = require("./Helpers/auth.middleware");
const {
  UserLogin,
  UserRegister,
  UserUpdate,
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

const app = express();
const port = 3000;

app.listen(port, () => {
  console.log("server is running on port 3000");
});
mongoose
  .connect(process.env.Mongo_URL)
  .then(() => console.log("Connected!"))
  .catch(() => {
    console.log("Connected Failed ");
  });

app.use(express.json());

app.post("/api/Users/Register", UserRegister);
app.post("/api/Users/Login", UserLogin);

app.patch("/api/Users/Profile", authMiddleware, UserUpdate);

app.get("/api/Books", GetBooks);
app.post("/api/Books", authMiddleware, authorizeRoles("Owner", "Admin"), AddBook);
app.put("/api/Books/:id", authMiddleware, authorizeRoles("Owner", "Admin"), UpdateBooks);
app.delete("/api/Books/:id", authMiddleware, authorizeRoles("Owner", "Admin"), DeleteBook);

app.post("/api/Cart", authMiddleware, AddToCart);
app.get("/api/Cart", authMiddleware, GetCart);
app.delete("/api/Cart/:id", authMiddleware, RemoveFromCart);

app.post("/api/Orders", authMiddleware, CreateOrder);
app.get("/api/Orders", authMiddleware, GetOrders);

app.post("/api/Reviews", authMiddleware, CreateReview);
app.get("/api/Reviews/:id", GetBookReviews);
app.put("/api/Review/:id", authMiddleware, EditReview);
app.delete("/api/Review/:id", authMiddleware, DeleteReview);

app.get("/api/BookUsers", authMiddleware, getAllBookUsers);
