/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - Name
 *         - Email
 *         - Password
 *         - Role
 *       properties:
 *         Name:
 *           type: string
 *           description: User's full name
 *         Email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         Password:
 *           type: string
 *           description: User's password
 *         Role:
 *           type: string
 *           enum: [User, Owner, Admin]
 *           description: User's role
 *         isVerified:
 *           type: boolean
 *           description: Email verification status
 *       example:
 *         Name: Mohamed Magdy
 *         Email: Mohamed@example.com
 *         Password: password123
 *         Role: User
 *         isVerified: false
 */
const User = require("../models/User");
const bcrypt = require("bcrypt");
const crypto = require('crypto');
const sendEmail = require("../utils/sendEmail");
const {
  CheckForUser
} = require("../Helpers/Login.Helper");
const Joi = require('joi');
/**
 * @swagger
 * /api/Users/Register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Name
 *               - Email
 *               - Password
 *             properties:
 *               Name:
 *                 type: string
 *                 description: User's full name
 *               Email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               Password:
 *                 type: string
 *                 description: User's password
 *               Role:
 *                 type: string
 *                 enum: [User, Admin]
 *                 default: User
 *                 description: User's role
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or email already registered
 *       500:
 *         description: Internal server error
 */
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
/**
 * @swagger
 * /api/Users/Login:
 *   post:
 *     summary: Login a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Email
 *               - Password
 *             properties:
 *               Email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               Password:
 *                 type: string
 *                 description: User's password
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
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT token
 *       400:
 *         description: Invalid credentials
 *       403:
 *         description: Email not verified
 *       500:
 *         description: Internal server error
 */
const UserLogin = async (req, res) => {
  try {
    const result = await CheckForUser(req, res);
    if (!result) return;

    const {
      user,
      token
    } = result;

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
/**
 * @swagger
 * /api/Users/Update:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Name:
 *                 type: string
 *                 description: User's full name
 *               Email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               NewPassword:
 *                 type: string
 *                 description: New password (requires CurrentPassword)
 *               CurrentPassword:
 *                 type: string
 *                 description: Current password (required if changing password)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error or no fields to update
 *       401:
 *         description: Unauthorized or incorrect current password
 *       500:
 *         description: Internal server error
 */
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

    if(value.Name == user.Name){
      return res.status(402).json(
      {massage:"you must add New Name "}
      )
    }
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

/**
 * @swagger
 * /api/Users/verify/{token}:
 *   get:
 *     summary: Verify user email
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/Users/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Email
 *             properties:
 *               Email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *     responses:
 *       200:
 *         description: Reset password email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: No user found with this email
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/Users/reset-password/{token}:
 *   post:
 *     summary: Reset user password
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset password token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password has been reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
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
