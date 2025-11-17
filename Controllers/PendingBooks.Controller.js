const PendingBook = require("../models/PendingBook");
const Book = require("../models/Book");
const Joi = require("joi");
const cloudinary = require("../Helpers/cloudinary");
const fs = require("fs");
const mongoose = require("mongoose");

/**
 * @swagger
 * components:
 *   schemas:
 *     PendingBook:
 *       type: object
 *       required:
 *         - Title
 *         - Author
 *         - Price
 *         - Description
 *         - Category
 *       properties:
 *         Title:
 *           type: string
 *           description: Book title
 *         Author:
 *           type: string
 *           description: Book author
 *         Price:
 *           type: number
 *           description: Book price
 *         Description:
 *           type: string
 *           description: Book description
 *         Stock:
 *           type: integer
 *           description: Book stock quantity
 *         Image:
 *           type: string
 *           format: uri
 *           description: Book image URL
 *         Category:
 *           type: string
 *           description: Book category
 *         Pdf:
 *           type: string
 *           format: uri
 *           description: Book PDF URL
 *         Owner:
 *           type: string
 *           description: Owner user ID
 *         Status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Approval status
 *         AdminComment:
 *           type: string
 *           description: Admin review comment
 *       example:
 *         Title: Sample Book
 *         Author: John Doe
 *         Price: 29.99
 *         Description: A great book
 *         Stock: 10
 *         Category: Fiction
 *         Image: http://example.com/image.jpg
 *         Pdf: http://example.com/pdf.pdf
 *         Owner: userId
 *         Status: pending
 */

// Submit Pending Book
async function SubmitPendingBook(req, res) {
  try {
    const schema = Joi.object({
      Title: Joi.string().trim().min(1).required(),
      Author: Joi.string().trim().min(1).required(),
      Price: Joi.number().min(0).required(),
      Description: Joi.string().trim().min(1).required(),
      Stock: Joi.number().integer().min(0).default(0),
      Image: Joi.string().trim().uri().allow("", null),
      Category: Joi.string().trim().min(1).required(),
      Pdf: Joi.string().trim().uri().allow("", null),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }
    const { Title, Author, Price, Description, Stock, Image, Category, Pdf } =
      value;

    let pdfUrl = Pdf;
    let imageUrl = Image;

    if (req.files && req.files.pdf && req.files.pdf[0]) {
      try {
        const result = await cloudinary.uploader.upload(req.files.pdf[0].path, {
          resource_type: "auto",
          folder: "books/pdfs",
        });
        pdfUrl = result.secure_url;
        fs.unlinkSync(req.files.pdf[0].path);
      } catch (uploadError) {
        console.error("Cloudinary PDF upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload PDF to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      try {
        const result = await cloudinary.uploader.upload(
          req.files.image[0].path,
          {
            resource_type: "auto",
            folder: "books/images",
          }
        );
        imageUrl = result.secure_url;
        fs.unlinkSync(req.files.image[0].path);
      } catch (uploadError) {
        console.error("Cloudinary image upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    const CreatePendingBook = await PendingBook.create({
      Title,
      Author,
      Price,
      Stock,
      Category,
      Description,
      Image: imageUrl,
      Pdf: pdfUrl,
      Owner: req.user.userId,
    });

    return res.status(201).json({
      message: "Book submitted for approval successfully",
      PendingBook: CreatePendingBook,
    });
  } catch (error) {
    console.error("SubmitPendingBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Get Pending Books (Admin only)
async function GetPendingBooks(req, res) {
  try {
    const pendingBooks = await PendingBook.find({ Status: "pending" })
      .populate("Owner", "Name Email")
      .sort({ SubmittedAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Pending books retrieved successfully",
      pendingBooks,
    });
  } catch (error) {
    console.error("GetPendingBooks:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Approve Pending Book
async function ApprovePendingBook(req, res) {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true,
    });
    if (vParams.error)
      return res.status(400).json({
        message: "Invalid id",
      });

    const { id } = vParams.value;

    const bodySchema = Joi.object({
      adminComment: Joi.string().trim().allow(""),
    });
    const vBody = bodySchema.validate(req.body, {
      stripUnknown: true,
    });
    if (vBody.error) {
      return res.status(400).json({
        message: "Validation error",
        errors: vBody.error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { adminComment } = vBody.value;

    const pendingBook = await PendingBook.findById(id);
    if (!pendingBook) {
      return res.status(404).json({
        message: "Pending book not found",
      });
    }

    if (pendingBook.Status !== "pending") {
      return res.status(400).json({
        message: "Book has already been reviewed",
      });
    }

    // Create approved book
    const approvedBook = await Book.create({
      Title: pendingBook.Title,
      Author: pendingBook.Author,
      Price: pendingBook.Price,
      Description: pendingBook.Description,
      Stock: pendingBook.Stock,
      Image: pendingBook.Image,
      Pdf: pendingBook.Pdf,
      Category: pendingBook.Category,
      Owner: pendingBook.Owner,
      Status: "approved",
    });

    // Update pending book status
    await PendingBook.findByIdAndUpdate(id, {
      Status: "approved",
      AdminComment: adminComment,
      ReviewedAt: new Date(),
      ReviewedBy: req.user.userId,
    });

    return res.status(200).json({
      message: "Book approved successfully",
      Book: approvedBook,
    });
  } catch (error) {
    console.error("ApprovePendingBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Reject Pending Book
async function RejectPendingBook(req, res) {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true,
    });
    if (vParams.error)
      return res.status(400).json({
        message: "Invalid id",
      });

    const { id } = vParams.value;

    const bodySchema = Joi.object({
      adminComment: Joi.string().trim().required(),
    });
    const vBody = bodySchema.validate(req.body, {
      stripUnknown: true,
    });
    if (vBody.error) {
      return res.status(400).json({
        message: "Admin comment is required for rejection",
        errors: vBody.error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { adminComment } = vBody.value;

    const pendingBook = await PendingBook.findById(id);
    if (!pendingBook) {
      return res.status(404).json({
        message: "Pending book not found",
      });
    }

    if (pendingBook.Status !== "pending") {
      return res.status(400).json({
        message: "Book has already been reviewed",
      });
    }

    // Update pending book status
    await PendingBook.findByIdAndUpdate(id, {
      Status: "rejected",
      AdminComment: adminComment,
      ReviewedAt: new Date(),
      ReviewedBy: req.user.userId,
    });

    return res.status(200).json({
      message: "Book rejected successfully",
    });
  } catch (error) {
    console.error("RejectPendingBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

// Get User's Pending Books
async function GetUserPendingBooks(req, res) {
  try {
    const pendingBooks = await PendingBook.find({
      Owner: req.user.userId,
    })
      .sort({ SubmittedAt: -1 })
      .lean();

    return res.status(200).json({
      message: "User pending books retrieved successfully",
      pendingBooks,
    });
  } catch (error) {
    console.error("GetUserPendingBooks:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  SubmitPendingBook,
  GetPendingBooks,
  ApprovePendingBook,
  RejectPendingBook,
  GetUserPendingBooks,
};
