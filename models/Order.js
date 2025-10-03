const mongoose = require("mongoose");
const schema = mongoose.Schema;

const orderSchema = new schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
    books:[{
        bookId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Book"
        },
        quantity:{
            type:Number,
            default:1
        }
    }],

    totalPrice: {
        type:Number,
        required:true
    },
    status:{
        type:String,
        enum:["pending" , "completed"],default:"pending"
    }
});

module.exports = mongoose.model("Order",orderSchema);