const jwt = require("jsonwebtoken");
const User = require("../models/User");
const bcrypt = require("bcrypt");
const logger = require("../utils/logger"); 

const login = async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      logger.warn("Login attempt with missing email or password");
      return res.status(400).json({ message: "Email and Password are required" });
    }

    
    const user = await User.findOne({ Email });
    if (!user) {
      logger.warn(`Login failed - User not found: ${Email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    
    const isValidPassword = await bcrypt.compare(Password, user.Password);
    if (!isValidPassword) {
      logger.warn(`Login failed - Invalid password for: ${Email}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

   
    const token = jwt.sign(
      { id: user._id, Role: user.Role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || "1d" }
    );

    
    logger.info(`User logged in successfully: ${user.Email} (Role: ${user.Role})`);

    res.json({
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        name: user.Name,
        email: user.Email,
        role: user.Role,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login };
