const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const {UserLogin ,UserRegister,UserUpdate}=require("./Controllers/Users.Controller")
const {AddBook , GetBooks, UpdateBooks, DeleteBook}= require("./Controllers/Books.Controller")
const {AddToCart, GetCart,RemoveFromCart}=require("./Controllers/Carts.Controller")
const {CreateOrder, GetOrders}= require("./Controllers/Orders.Controller")
const {CreateReview, GetBookReviews,EditReview,DeleteReview}=require("./Controllers/Review.Controller")

dotenv.config();

const app = express()
const port=3000

app.listen(port,()=>{
    console.log("server is running on port 3000")
})
mongoose.connect(process.env.Mongo_URL)
  .then(() => console.log('Connected!'))
  .catch(()=>{
    console.log("Connected Failed ")
  })

  app.use(express.json());



app.post("/api/Users/Register",UserRegister)





app.post("/api/Users/Login",UserLogin)


app.put("/api/Users/Profile" , UserUpdate)


app.post("/api/Books",AddBook)
app.get("/api/Books",GetBooks)
app.put("/api/Books/:id",UpdateBooks)
app.delete("/api/Books/:id", DeleteBook)

app.post("/api/Cart",AddToCart)
app.get("/api/Cart", GetCart)
app.delete("/api/Cart/:id",RemoveFromCart)

app.post("/api/Orders",CreateOrder)
app.get("/api/Orders", GetOrders)


app.post("/api/Reviews",CreateReview)
app.get("/api/Reviews/:id" , GetBookReviews)
app.put("/api/Review/:id",EditReview)
app.delete("/api/Review/:id",DeleteReview)