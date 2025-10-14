const User = require("../models/User");
const bcrypt = require("bcrypt");
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
    });

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

module.exports = {
  UserLogin,
  UserRegister,
  UserUpdate,
};
