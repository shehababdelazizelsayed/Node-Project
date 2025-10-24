/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       required:
 *         - User
 *         - Book
 *         - Rating
 *       properties:
 *         User:
 *           type: string
 *           description: User ID
 *         Book:
 *           type: string
 *           description: Book ID
 *         Rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           description: Rating from 1 to 10
 *         Review:
 *           type: string
 *           maxLength: 1000
 *           description: Review text
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
const Review = require("../models/Review")
const Joi = require('joi');
const Book = require("../models/Book");
const logger = require("../utils/logger");
const {
  CheckForUser
} = require("../Helpers/Login.Helper");

/**
 * @swagger
 * /api/Reviews:
 *   post:
 *     summary: Create a new review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - BookId
 *               - Rating
 *             properties:
 *               BookId:
 *                 type: string
 *                 description: Book ID to review
 *               Rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Rating from 1 to 10
 *               Review:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Review text (optional)
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reviewId:
 *                   type: string
 *                 bookId:
 *                   type: string
 *                 rating:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       409:
 *         description: Review already exists
 *       500:
 *         description: Internal server error
 */


async function CreateReview(req, res) {
  try {
    const schema = Joi.object({
      BookId: Joi.string().hex().length(24).required().messages({
        "string.length": "BookId must be 24 hex chars",
      }),
      Rating: Joi.number().integer().min(1).max(10).required().messages({
        "number.base": "Rating must be a number",
        "number.integer": "Rating must be an integer",
      }),
      Review: Joi.string().trim().max(1000).allow("", null).default(""),
    });

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn(
        `Validation error in CreateReview: ${error.details
          .map((d) => d.message)
          .join(", ")}`
      );
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { BookId, Rating, Review: ReviewTextFromBody } = value;

    if (BookId === undefined || BookId === null) {
      logger.warn("BookId missing in CreateReview");
      return res.status(400).json({ message: "BookId is required" });
    }

    if (Rating === undefined || Rating === null) {
      logger.warn("Rating missing in CreateReview");
      return res.status(400).json({ message: "Rating is required" });
    }

    const RatingNum = Number(Rating);
    if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
      logger.warn(`Invalid rating value: ${RatingNum}`);
      return res
        .status(400)
        .json({ message: "Rating must be an integer between 1 and 10" });
    }

    let ReviewText = "";

    if (ReviewTextFromBody !== undefined && ReviewTextFromBody !== null) {
      ReviewText = String(ReviewTextFromBody).trim();

      if (ReviewText.length > 1000) {
        logger.warn("Review text exceeds 1000 characters");
        return res
          .status(400)
          .json({ message: "Review must be at most 1000 characters" });
      }
    }

    const foundBook = await Book.findById(BookId).select({ _id: 1 });
    if (!foundBook) {
      logger.warn(`Book not found for ID: ${BookId}`);
      return res.status(404).json({ message: "Book not found" });
    }

    const exists = await Review.findOne({
      User: req.user.userId,
      Book: BookId,
    });
    if (exists) {
      logger.warn(
        `Duplicate review attempt by user ${req.user.userId} for book ${BookId}`
      );
      return res
        .status(409)
        .json({ message: "You have already reviewed this book" });
    }

    const created = await Review.create({
      User: req.user.userId,
      Book: BookId,
      Rating: RatingNum,
      Review: ReviewText,
    });

    logger.info(
      `Review created successfully  | User: ${req.user.userId} | Book: ${BookId} | Rating: ${RatingNum}`
    );

    return res.status(201).json({
      message: "Review added successfully",
      reviewId: created._id,
      bookId: String(BookId),
      rating: created.Rating,
    });
  } catch (error) {
    logger.error(`CreateReview error: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
}
/**
 * @swagger
 * /api/Reviews/{id}:
 *   get:
 *     summary: Get reviews for a book
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */


async function GetBookReviews(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn(`GetBookReviews validation failed`, { params: req.params });
      return res.status(400).json({ message: "Book id is required" });
    }

    const BookId = value.id;
    if (!BookId) {
      logger.warn("Book id missing in GetBookReviews");
      return res.status(400).json({ message: "Book id is required" });
    }

    const reviews = await Review.find({ Book: BookId });

    logger.info(`Fetched ${reviews.length} review(s) for Book: ${BookId}`);

    return res.status(200).json(reviews);
  } catch (error) {
    logger.error(`GetBookReviews error: ${error.message}`, { stack: error.stack });
    res.status(500).json({ message: error.message });
  }
}
/**
 * @swagger
 * /api/Reviews/{id}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: Updated rating
 *               Review:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Updated review text
 *             oneOf:
 *               - required: [Rating]
 *               - required: [Review]
 *     responses:
 *       200:
 *         description: Review updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 reviewId:
 *                   type: string
 *                 rating:
 *                   type: integer
 *                 review:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Review not found
 *       500:
 *         description: Internal server error
 */

async function EditReview(req, res) {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });
    const vParams = paramsSchema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (vParams.error) {
      logger.warn("EditReview validation failed for params", { params: req.params });
      return res.status(400).json({ message: "Review id is required" });
    }

    const ReviewData = vParams.value.id;

    if (!ReviewData) {
      logger.warn("EditReview missing Review id");
      return res.status(400).json({ message: "Review id is required" });
    }

    const bodySchema = Joi.object({
      Rating: Joi.number().integer().min(1).max(10),
      Review: Joi.string().trim().max(1000),
    }).or("Rating", "Review");

    const vBody = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (vBody.error) {
      logger.warn("EditReview validation failed for body", { body: req.body });
      return res.status(400).json({
        message: "Nothing to update (provide Rating and/or Review)",
      });
    }

    const UpdateRating = vBody.value.Rating;
    const UpdateReview = vBody.value.Review;

    const HasRating = UpdateRating !== undefined && UpdateRating !== null;
    const HasText = UpdateReview !== undefined && UpdateReview !== null;

    if (!HasRating && !HasText) {
      logger.warn("EditReview called with no update fields", { userId: req.user.userId });
      return res.status(400).json({
        message: "Nothing to update (provide Rating and/or Review)",
      });
    }

    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      logger.warn("EditReview review not found", { reviewId: ReviewData });
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(CheckId.User) !== String(req.user.userId)) {
      logger.warn("EditReview unauthorized attempt", { userId: req.user.userId, reviewId: ReviewData });
      return res.status(403).json({ message: "Not allowed to update this review" });
    }

    if (HasRating) {
      const RatingNum = Number(UpdateRating);
      if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
        logger.warn("EditReview invalid rating", { rating: UpdateRating });
        return res.status(400).json({
          message: "Rating must be an integer between 1 and 10",
        });
      }
      CheckId.Rating = RatingNum;
    }

    if (HasText) {
      let ReviewText = String(UpdateReview).trim();
      if (ReviewText.length > 1000) {
        logger.warn("EditReview review text too long", { length: ReviewText.length });
        return res.status(400).json({
          message: "Review must be at most 1000 characters",
        });
      }
      CheckId.Review = ReviewText;
    }

    await CheckId.save();

    logger.info("Review updated successfully", { userId: req.user.userId, reviewId: ReviewData });

    return res.status(200).json({
      message: "Review updated successfully",
      reviewId: CheckId._id,
      rating: CheckId.Rating,
      review: CheckId.Review,
    });
  } catch (error) {
    logger.error("EditReview error", { error: error.message, stack: error.stack });
    return res.status(500).json({ message: error.message });
  }
}


/**
 * @swagger
 * /api/Reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Review not found
 *       500:
 *         description: Internal server error
 */


async function DeleteReview(req, res) {
  try {
    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      logger.warn("DeleteReview validation failed for params", { params: req.params });
      return res.status(400).json({ message: "Review id is required" });
    }

    const ReviewData = value.id;
    if (!ReviewData) {
      logger.warn("DeleteReview missing Review id");
      return res.status(400).json({ message: "Review id is required" });
    }

    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      logger.warn("DeleteReview review not found", { reviewId: ReviewData });
      return res.status(404).json({ message: "Review not found" });
    }

    if (String(CheckId.User) !== String(req.user.userId) && req.user.Role !== "Admin") {
      logger.warn("DeleteReview unauthorized attempt", { userId: req.user.userId, reviewId: ReviewData });
      return res.status(403).json({ message: "Not allowed to delete this review" });
    }

    const Deleted = await Review.findByIdAndDelete(ReviewData);
    if (!Deleted) {
      logger.warn("DeleteReview not found during deletion", { reviewId: ReviewData });
      return res.status(404).json({ message: "Review not found" });
    }

    logger.info("Review deleted successfully", { userId: req.user.userId, reviewId: ReviewData });

    return res.status(200).json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    logger.error("DeleteReview error", { error: error.message, stack: error.stack });
    return res.status(500).json({ message: error.message });
  }
}

module.exports = {
  CreateReview,
  GetBookReviews,
  EditReview,
  DeleteReview,
};