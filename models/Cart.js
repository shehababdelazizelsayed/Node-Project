const mongoose = require("mongoose");
const schema = mongoose.Schema;

const cartSchema = new schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },
  
    items:[{
       book:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Book",
        required:true
       } ,
       quantity:{
        type:Number,
        default:1,
        min:1
       }
    }]
});

module.exports = mongoose.model("Cart",cartSchema);