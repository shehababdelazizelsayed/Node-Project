const mongoose = require("mongoose");
const schema = mongoose.Schema;

const bookSchema = new schema({
    title:{
        type:String,
        required:true
    },
     author:{
        type:String,
        required:true
    },
     price:{
        type:Number,
        required:true
    },
     description:{
        type:String,
        required:true
    },
     stock:{
        type:Number,
        
        min:0,
        default:0

    },
    image:{
        type:String
    },
    reviews:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Review"
    }]
})

module.exports = mongoose.model("Book", bookSchema);