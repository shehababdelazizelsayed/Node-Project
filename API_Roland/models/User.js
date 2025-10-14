const mongoose = require("mongoose");
const schema = mongoose.Schema;

const userSchema = new schema({
  Name: {
    type: String,
    required: true,
  },
  Email: {
    type: String,
    required: true,
    unique: true,
  },
  Password: {
    type: String,
    required: true,
  },
  Role: {
    type: String,
    enum: ["User", "Admin", "Owner"],
    default: "User",
  },
  IsVerified: {
    type: Boolean,
    default: false,
  },
  verificationToken: String,
  verificationExpires: Data,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

module.exports = mongoose.model("User", userSchema);
