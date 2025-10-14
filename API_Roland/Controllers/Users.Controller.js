const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const sendEmail = require("../utils/sendEmail");
const { CheckForUser } = require("../Helpers/Login.Helper");

const UserRegister = async (req, res) => {
  try {
    const { Name, Email, Password, Role } = req.body;

    if (!Name || !Email || !Password) {
      return res.status(400).json({
        message: "Name, Email and Password are required",
      });
    }

    const existingUser = await User.findOne({ Email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(Password, salt);

    const user = await User.create({
      Name,
      Email,
      Password: hashedPassword,
      Role: Role || "User",
      IsVerified: false
    });

    const verificationToken = crypto.randomBytes(32).toString("hex");
    user.verificationToken = verificationToken;
    user.verificationExpires = Date.now() + 1000 * 60 * 60 * 24;
    await user.save();

    const verifyLink = `${process.env.BASE_URL}/api/Users/verify/${verificationToken}`;
    await sendEmail(
      user.Email,
      "Verify your email",
      `Hello ${user.Name},\n\nPlease verify your email by clicking the link below:\n${verifyLink}\n\nThanks!`
    );

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        Name: user.Name,
        Email: user.Email,
        Role: user.Role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

const UserLogin = async (req, res) => {
  try {
    const result = await CheckForUser(req, res);
    if (!result) return;

    const { user, token } = result;

    if (!user.IsVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: user._id,
        Name: user.Name,
        Email: user.Email,
        Role: user.Role,
        IsVerified: user.IsVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

const UserUpdate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const updates = {};

    // Handle name update
    if (req.body.Name) {
      updates.Name = req.body.Name;
    }

    if (req.body.Email) {
      const emailExists = await User.findOne({
        Email: req.body.Email.toLowerCase().trim(),
        _id: { $ne: userId },
      });

      if (emailExists) {
        return res.status(400).json({
          message: "Email already in use",
        });
      }
      updates.Email = req.body.Email.toLowerCase().trim();
    }

    if (req.body.NewPassword) {
      // Require current password for security
      if (!req.body.CurrentPassword) {
        return res.status(400).json({
          message: "Current password is required to change password",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        req.body.CurrentPassword,
        user.Password
      );
      if (!isValidPassword) {
        return res.status(401).json({
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      updates.Password = await bcrypt.hash(req.body.NewPassword, salt);
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No fields to update",
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        Name: updatedUser.Name,
        Email: updatedUser.Email,
        Role: updatedUser.Role,
      },
    });
  } catch (error) {
    console.error("UserUpdate:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};


// Verify Email
const VerifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link." });
    }

    user.IsVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("VerifyEmail error:", error);
    return res.status(500).json({ message: error.message });
  }
};


// Forgot Password
const ForgotPassword = async (req, res) => {
  try {
    const { Email } = req.body;

    const user = await User.findOne({ Email });
    if (!user) {
      return res.status(404).json({ message: "No user found with this email." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 60;
    await user.save();

    const resetLink = `${process.env.BASE_URL}/api/Users/reset-password/${resetToken}`;
    await sendEmail(
      user.Email,
      "Reset your password",
      `Hi ${user.Name},\n\nClick the link below to reset your password:\n${resetLink}\n\nIf you didn’t request this, ignore the email.`
    );
    res.status(200).json({ message: "Reset password email sent successfully." });
  } catch (error) {
    console.error("ForgotPassword error:", error);
    res.status(500).json({ message: error.message });
  }
};


// Reset Password
const ResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const salt = await bcrypt.genSalt(10);
    user.Password = await bcrypt.hash(newPassword, salt);


    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("ResetPassword error:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  UserLogin,
  UserRegister,
  UserUpdate,
  VerifyEmail,
  ForgotPassword,
  ResetPassword
};
