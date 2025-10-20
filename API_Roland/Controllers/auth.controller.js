/**
 * @swagger
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       required:
 *         - Email
 *         - Password
 *       properties:
 *         Email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         Password:
 *           type: string
 *           description: User's password
 *       example:
 *         Email: user@example.com
 *         Password: password123
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const bcrypt = require("bcrypt");

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user and return JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthUser'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
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