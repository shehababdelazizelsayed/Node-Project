const PendingBook = require("../models/PendingBook");
const Book = require("../models/Book");
const Joi = require("joi");
const { getCache, setCache, deleteCache } = require("../utils/redis");

/**
 * @swagger
 * /api/pending-books:
 *   get:
 *     summary: Get all pending books (Admin only)
 *     tags: [Admin - Pending Books]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending books retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
async function getPendingBooks(req, res) {
  try {
    const pendingBooks = await PendingBook.find({ Status: "pending" })
      .sort({ createdAt: -1 })
      .populate("Owner", "Name Email")
      .lean();

    return res.status(200).json({
      message: "Pending books retrieved successfully",
      books: pendingBooks,
      count: pendingBooks.length,
    });
  } catch (error) {
    console.error("getPendingBooks:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/pending-books/{id}/approve:
 *   post:
 *     summary: Approve a pending book (Admin only)
 *     tags: [Admin - Pending Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pending book ID
 *     responses:
 *       200:
 *         description: Book approved and transferred to main collection
 *       400:
 *         description: Invalid book ID
 *       404:
 *         description: Pending book not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
async function approvePendingBook(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().required(),
    });

    const { error, value } = schema.validate(
      { id: req.params.id },
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { id } = value;

    const pendingBook = await PendingBook.findById(id);

    if (!pendingBook) {
      return res.status(404).json({
        message: "Pending book not found",
      });
    }

    // Create the book in the main Book collection
    const approvedBook = await Book.create({
      Title: pendingBook.Title,
      Author: pendingBook.Author,
      Price: pendingBook.Price,
      Stock: pendingBook.Stock,
      Category: pendingBook.Category,
      Description: pendingBook.Description,
      Image: pendingBook.Image,
      Pdf: pendingBook.Pdf,
      Owner: pendingBook.Owner,
    });

    // Update the PendingBook status
    pendingBook.Status = "approved";
    await pendingBook.save();

    // Invalidate cache
    await deleteCache("books:*");

    return res.status(200).json({
      message: "Book approved and transferred to main collection successfully",
      book: approvedBook,
    });
  } catch (error) {
    console.error("approvePendingBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/pending-books/{id}/reject:
 *   post:
 *     summary: Reject a pending book (Admin only)
 *     tags: [Admin - Pending Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pending book ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Book rejected successfully
 *       400:
 *         description: Invalid book ID or missing reason
 *       404:
 *         description: Pending book not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
async function rejectPendingBook(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().required(),
    });

    const bodySchema = Joi.object({
      reason: Joi.string().trim().min(1).required(),
    });

    const { error, value } = schema.validate(
      { id: req.params.id },
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { error: bodyError, value: bodyValue } = bodySchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (bodyError) {
      return res.status(400).json({
        message: "Validation error",
        errors: bodyError.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { id } = value;
    const { reason } = bodyValue;

    const pendingBook = await PendingBook.findById(id);

    if (!pendingBook) {
      return res.status(404).json({
        message: "Pending book not found",
      });
    }

    // Update the PendingBook status and add rejection reason
    pendingBook.Status = "rejected";
    pendingBook.RejectionReason = reason;
    await pendingBook.save();

    // Invalidate cache
    await deleteCache("books:*");

    return res.status(200).json({
      message: "Book rejected successfully",
      book: pendingBook,
    });
  } catch (error) {
    console.error("rejectPendingBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/pending-books/user/{userId}:
 *   get:
 *     summary: Get pending books for a specific user
 *     tags: [Admin - Pending Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User's pending books retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
async function getUserPendingBooks(req, res) {
  try {
    const schema = Joi.object({
      userId: Joi.string().required(),
    });

    const { error, value } = schema.validate(
      { userId: req.params.userId },
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { userId } = value;

    const userPendingBooks = await PendingBook.find({ Owner: userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "User's pending books retrieved successfully",
      books: userPendingBooks,
      count: userPendingBooks.length,
    });
  } catch (error) {
    console.error("getUserPendingBooks:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  getPendingBooks,
  approvePendingBook,
  rejectPendingBook,
  getUserPendingBooks,
};
