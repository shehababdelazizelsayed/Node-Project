const User = require("../models/User");

async function CheckForUser(req, res) {
  const Email = req.header("UserEmail");
  const Password = req.header("UserPassword");

  if (!Email) { res.status(401).json({ message: "Email is required" }); return null; }

  const user = await User.findOne({ Email });
  if (!user) { res.status(401).json({ message: "Invalid Email" }); return null; }

  if (Password != null && user.Password !== Password) {
    res.status(401).json({ message: "Invalid password" }); return null;
  }

 
  // if (user.IsVerified !== true) { res.status(401).json({ message: "You must verify first" }); return null; }

  return user;
}

module.exports = { CheckForUser };