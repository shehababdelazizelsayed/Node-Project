const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

//importing models
const User = require("./models/User")
const Book = require("./models/Book")
const Review = require("./models/Review")
const Order = require("./models/Order")
const Cart = require("./models/Cart")

//initializing app and dotenv
const app = express();
dotenv.config();

//using middleware to parse json data
app.use(express.json());

// connect to db
const connectDB = async() => {
    try {
       await mongoose.connect(process.env.MONGO_URI, {
      
       }) 
       console.log("connected successfully");



       
    } catch (err) {
        console.error("mongo connection failed",err.message);
        process.exit(1);
    }
}
connectDB();



//testing adding user with postman
app.post("/test-user", async(req,res) => {
    try {
        const user = new User({
         name:req.body.name,
         email:req.body.email,
         password:req.body.password
        })
        const saved = await user.save();
        res.status(201).json({message:"user added successfully"});
    } catch (err) {
        res.status(400).json({error:err.message});
    }
})

//testing adding book with postman
app.post("/test-book", async(req,res) => {
    try {
        const book = new Book({
         title:req.body.title,
         author:req.body.author,
         price:req.body.price,
        description:req.body.description,
        })
        const saved = await book.save();
        res.status(201).json({message:"Book added successfully"});
    } catch (err) {
        res.status(400).json({error:err.message});
    }
})

//server listening
app.listen(5000 , () => {
    console.log(`app is running on port 5000`);
})

