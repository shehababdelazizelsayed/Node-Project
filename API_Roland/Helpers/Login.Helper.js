const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

async function generateToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.Email, Role: user.Role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRATION }
  );
}

async function CheckForUser(req, res) {
  const Email = req.body.Email || req.body.email;
  const Password = req.body.Password || req.body.password;

  if (!Email) {
    res.status(401).json({ message: "Email is required" });
    return null;
  }
  if (!Password) {
    res.status(401).json({ message: "Password is required" });
    return null;
  }

  const user = await User.findOne({ Email });
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return null;
  }

  const isValidPassword = await bcrypt.compare(Password, user.Password);
  if (!isValidPassword) {
    res.status(401).json({ message: "Invalid credentials" });
    return null;
  }

  const token = await generateToken(user);
  return { user, token };
}

module.exports = { CheckForUser };
