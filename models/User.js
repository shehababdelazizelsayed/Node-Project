const mongoose = require("mongoose");
const schema = mongoose.Schema;

const userSchema = new schema({
    name: {
        type:String,
        required:true
    },
     email: {
        type:String,
        required:true,
        unique:true
    },
     password: {
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["user","admin"],default:"user"
    },
    isVerified:{
        type:Boolean,
        default:false
    }

})

module.exports = mongoose.model("User",userSchema);