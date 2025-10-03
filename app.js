const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

 const User = require("./models/User")
const Book = require("./models/Book")


const app = express();
dotenv.config();
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





app.listen(5000 , () => {
    console.log(`app is run on port 5000`);
    
})
