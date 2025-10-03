const mongoose = require("mongoose");
const schema = mongoose.Schema;

const reviewSchema = new schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
    },
    book:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Book",
    },
    rating:{
        type:Number,
        min:1,
        max:10
    },
    review:{
        type:String,
        maxlength: 1000
    },
    createdAt:{
        type:Date,
        default:Date.now()
    }

});


module.exports = mongoose.model("Review", reviewSchema);