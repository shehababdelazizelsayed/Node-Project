const jwt = require("jsonwebtoken");
const User = require("../models/User");
const bcrypt = require("bcrypt");


const login = async(req,res)=> {
    try{
    const {Email , Password} = req.body
    // check if user is in database
    const user = await User.findOne({Email});
    if(!user){
        return res.status(401).json({message:"Invalid credentials"});
    }
    // check password matching
    const isValidPassword = await bcrypt.compare(Password,user.Password);
    if(!isValidPassword){
        return res.status(401).json({message:"Invalid credentials"})
    }
    const token = jwt.sign(
        {id:user._id , Role:user.Role},
        process.env.JWT_SECRET,
        {expiresIn: process.env.JWT_EXPIRATION || "1d"}
    );
    res.json({message: "Login Successful" , token,
        user:{
            id:user._id,
              name: user.Name,
            email: user.Email,
            role: user.Role,
        }
    });

}catch(error){
      console.error(error);
    res.status(500).json({ message: "Server error" });
}
}

module.exports = {login};