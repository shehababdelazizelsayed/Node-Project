const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const sendEmail = require("../utils/sendEmail");
const { CheckForUser } = require("../Helpers/Login.Helper");
const { logLoginActivity } = require("../utils/logger");
const SocketManager = require("../SocketManager");
const Joi = require('joi');
const UserRegister = async (req, res) => {
  try {
    const {
      Name,
      Email,
      Password,
      Role
    } = req.body;

    // if (!Name || !Email || !Password) {
    //   return res.status(400).json({
    //     message: "Name, Email and Password are required",
    //   });
    // }
    const schema = Joi.object({
        Name: Joi.string()
          .pattern(/^[A-Za-z0-9 ]+$/)
          .min(3)
          .max(30)
          .required()
          .messages({
            'string.pattern.base': 'Name can contain letters, numbers, and spaces only',
          }),
        Password: Joi.string().required()
          .min(8).max(64).pattern(/^\S+$/)
          .messages({
            'string.pattern.base': 'password can contain letters, number,  only',
          }),
        Email: Joi.string().required().lowercase().trim()
          .email({
            minDomainSegments: 2,
            tlds: {
              allow: ['com', 'net']
            }
          }),
        Token: Joi.string(),

        Role: Joi.string()
          .valid('User', 'Admin')
          .empty('')
          .default('User')
          .messages({
            'any.only': 'Role must be User ',
          }),

      })
      .xor('Password', 'Token')
    const {
      error,
      value
    } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message.replace(/"/g, '')),
      });
    }

    const existingUser = await User.findOne({
      Email
    });
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
    if (!result) {
      // Log failed login attempt
      await logLoginActivity({
        type: 'login_failed',
        email: req.body.Email,
        reason: 'Invalid credentials',
        ip: req.ip
      });
      
      // Broadcast failed login attempt to admins
      SocketManager.broadcast('auth_activity', {
        type: 'login_failed',
        email: req.body.Email,
        timestamp: new Date().toISOString()
      });
      
      return;
    }

    const { user, token } = result;

    if (!user.IsVerified) {
      // Log unverified login attempt
      await logLoginActivity({
        type: 'login_failed',
        email: user.Email,
        reason: 'Email not verified',
        userId: user._id,
        ip: req.ip
      });
      
      // Broadcast unverified login attempt
      SocketManager.broadcast('auth_activity', {
        type: 'login_failed',
        reason: 'Email not verified',
        email: user.Email,
        timestamp: new Date().toISOString()
      });
      
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    // Log successful login
    await logLoginActivity({
      type: 'login_success',
      userId: user._id,
      email: user.Email,
      name: user.Name,
      role: user.Role,
      ip: req.ip
    });

    // Broadcast login success (excluding sensitive data)
    SocketManager.broadcast('auth_activity', {
      type: 'login_success',
      userId: user._id,
      name: user.Name,
      role: user.Role,
      timestamp: new Date().toISOString()
    });

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
    
    // Log error
    await logLoginActivity({
      type: 'login_error',
      error: error.message,
      ip: req.ip
    });
    
    return res.status(500).json({
      message: error.message,
    });
  }
};

const UserUpdate = async (req, res) => {
  try {

    const schema = Joi.object({
        Name: Joi.string().trim().min(3).max(30),
        //Email: Joi.string().lowercase().trim().email({
        // tlds: {
        //   allow: false
        // }
        //}),
        NewPassword: Joi.string().min(8).max(64)
          .pattern(/^\S+$/)
          .messages({
            'string.pattern.base': 'NewPassword must be 8–64 chars, no spaces',
            'string.min': 'NewPassword must be at least 8 characters',
            'string.max': 'NewPassword must be at most 64 characters',
          }),
        CurrentPassword: Joi.string().min(6).max(64)
          .pattern(/^\S+$/)
          .messages({
            'string.pattern.base': 'CurrentPassword must be 8–64 chars, no spaces',
            'string.min': 'CurrentPassword must be at least 8 characters',
            'string.max': 'CurrentPassword must be at most 64 characters',
          }),
      })
      .with('NewPassword', 'CurrentPassword')
      .or('Name', 'Email', 'NewPassword');
    const {
      error,
      value
    } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message.replace(/"/g, '')),
      });
    }
    ////////////
    const userId = req.user.userId; /////
    const user = await User.findById(userId);
    if (!userId) {
      return res.status(401).json({
        message: 'Unauthorized'
      });
    }
    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }


    const updates = {};
    ////////
    if (value.Name) { //////
      updates.Name = value.Name; /////
    }

    // if (value.Email && value.Email !== user.Email) {
    //   const emailExists = await User.findOne({
    //     Email: value.Email.toLowerCase().trim(),
    //     _id: {
    //       $ne: userId
    //     },
    //   });

    //   if (emailExists) {
    //     return res.status(400).json({
    //       message: "Email already in use",
    //     });
    //   }
    //   updates.Email = value.Email.toLowerCase().trim();
    // }

    if (value.NewPassword) {
      // Require current password for security
      if (!value.CurrentPassword) {
        return res.status(400).json({
          message: "Current password is required to change password",
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        value.CurrentPassword,
        user.Password
      );
      if (!isValidPassword) {
        return res.status(401).json({
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      updates.Password = await bcrypt.hash(value.NewPassword, salt);
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No fields to update",
      });
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId, {
        $set: updates
      }, {
        new: true,
        runValidators: true
      }
    ).select('_id Name Email Role');

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
    const {
      token
    } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationExpires: {
        $gt: Date.now()
      }
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired verification link."
      });
    }

    user.IsVerified = true;
    user.verificationToken = undefined;
    await user.save();

    return res.status(200).json({
      message: "Email verified successfully!"
    });
  } catch (error) {
    console.error("VerifyEmail error:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};


// Forgot Password
const ForgotPassword = async (req, res) => {
  try {
    const {
      Email
    } = req.body;

    const user = await User.findOne({
      Email
    });
    if (!user) {
      return res.status(404).json({
        message: "No user found with this email."
      });
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
    res.status(200).json({
      message: "Reset password email sent successfully."
    });
  } catch (error) {
    console.error("ForgotPassword error:", error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Reset Password
const ResetPassword = async (req, res) => {
  try {
    const {
      token
    } = req.params;

    const schema = Joi.object({
      newPassword: Joi.string()
        .min(8)
        .max(64)
        .pattern(/^\S+$/)
        .required()
        .messages({
          "string.pattern.base": "NewPassword must be 8–64 chars, no spaces",
          "string.min": "NewPassword must be at least 8 characters",
          "string.max": "NewPassword must be at most 64 characters",
          "any.required": "newPassword is required",
        }),
      confirmPassword: Joi.valid(Joi.ref("newPassword"))
        .required()
        .messages({
          "any.only": "Passwords do not match"
        }),
    });

    const {
      error,
      value
    } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map(d => d.message.replace(/"/g, "")),
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: Date.now()
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token."
      });
    }

    const salt = await bcrypt.genSalt(10);
    user.Password = await bcrypt.hash(value.newPassword, salt);


    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    console.log(user)
    await user.save();

    res.status(200).json({
      message: "Password has been reset successfully."
    });
  } catch (error) {
    console.error("ResetPassword error:", error);
    res.status(500).json({
      message: error.message
    });
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
