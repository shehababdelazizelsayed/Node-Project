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

    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;
    const schema = Joi.object({
      BookId: Joi.string().hex().length(24).required()
        .messages({
          'string.length': 'BookId must be 24 hex chars'
        }),
      Rating: Joi.number().integer().min(1).max(10).required()
        .messages({
          'number.base': 'Rating must be a number',
          'number.integer': 'Rating must be an integer'
        }),
      Review: Joi.string().trim().max(1000).allow('', null).default(''),
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
        message: 'Validation error',
        errors: error.details.map(d => d.message.replace(/"/g, '')),
      });
    }


    const {
      BookId,
      Rating,
      Review: ReviewTextFromBody
    } = value;


    if (BookId === undefined || BookId === null) {
      return res.status(400).json({
        message: "BookId is required"
      });
    }


    if (Rating === undefined || Rating === null) {
      return res.status(400).json({
        message: "Rating is required"
      });
    }
    const RatingNum = Number(Rating);
    if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
      return res.status(400).json({
        message: "Rating must be an integer between 1 and 10"
      });
    }

    let ReviewText = "";

    if (ReviewTextFromBody !== undefined && ReviewTextFromBody !== null) {
      ReviewText = String(ReviewTextFromBody).trim();

      if (ReviewText.length > 1000) {
        return res.status(400).json({
          message: "Review must be at most 1000 characters"
        });
      }
    }


    const foundBook = await Book.findById(BookId).select({
      _id: 1
    });
    if (!foundBook) {
      return res.status(404).json({
        message: "Book not found"
      });
    }


    const exists = await Review.findOne({
      User: req.user.userId,
      Book: BookId
    });
    if (exists) {
      return res.status(409).json({
        message: "You have already reviewed this book"
      });
    }


    const created = await Review.create({
      User: req.user.userId,
      Book: BookId,
      Rating: RatingNum,
      Review: ReviewText

    });


    return res.status(201).json({
      message: "Review added successfully",
      reviewId: created._id,
      bookId: String(BookId),
      rating: created.Rating
    });


  } catch (error) {
    console.error("CreateReview:", error);
    res.status(500).json({
      message: error.message
    });
  }

}
/**
 * @swagger
 * /api/Review/{id}:
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
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;
    const schema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const {
      error,
      value
    } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        message: 'Book id is required'
      });
    }

    const BookId = value.id;
    if (!BookId) {
      return res.status(400).json({
        message: "Book id is required"
      });
    }

    const reviews = await Review.find({
      Book: BookId
    });
    return res.status(200).json(reviews);
  } catch (error) {
    console.error("GetBookReviews:", error);
    res.status(500).json({
      message: error.message
    });
  }


}

/**
 * @swagger
 * /api/Review/{id}:
 *   put:
 *     summary: Update a review
 *     tags: [Reviews]
 *     security:
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
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;

    // === Params validation (Joi) ===
    const paramsSchema = Joi.object({
      id: Joi.string()
        .trim()
        .hex()
        .length(24)
        .required()
        .messages({
          'any.required': 'Review id is required',
          'string.empty': 'Review id is required',
          'string.hex': 'Review id is required',
          'string.length': 'Review id is required',
        }),
    });

    let vParams;
    try {
      vParams = await paramsSchema.validateAsync(req.params || {}, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch {
      return res.status(400).json({ message: 'Review id is required' });
    }

    const ReviewData = vParams.id;
    if (!ReviewData) {
      return res.status(400).json({ message: 'Review id is required' });
    }

    const bodySchema = Joi.object({
      Rating: Joi.number()
        .integer()
        .min(1)
        .max(10)
        .messages({
          'number.base': 'Rating must be an integer between 1 and 10',
          'number.integer': 'Rating must be an integer between 1 and 10',
          'number.min': 'Rating must be an integer between 1 and 10',
          'number.max': 'Rating must be an integer between 1 and 10',
        }),
      Review: Joi.string()
        .trim()
        .max(1000)
        .messages({
          'string.base': 'Review must be at most 1000 characters',
          'string.max': 'Review must be at most 1000 characters',
        }),
    })
      .or('Rating', 'Review')
      .messages({
        'object.missing': 'Nothing to update (provide Rating and/or Review)',
      });
let vBody;
try {
  vBody = await bodySchema.validateAsync(req.body || {}, {
    abortEarly: false,
    stripUnknown: true,
  });
}  catch (err) {
   const details = Array.isArray(err?.details) ? err.details : [];
   const isMissing =
     details.some(d => d.type === 'object.missing') ||
     String(err?.message || '').includes('at least one of [Rating, Review]');
   const msg = isMissing
     ? 'Nothing to update (provide Rating and/or Review)'
     : (details[0]?.message || 'Validation error').replace(/"/g, '');
   return res.status(400).json({ message: msg });
}


    const UpdateRating = vBody.Rating;
    const UpdateReview = vBody.Review;

    const HasRating = UpdateRating !== undefined && UpdateRating !== null;
    const HasText = UpdateReview !== undefined && UpdateReview !== null;

    if (!HasRating && !HasText) {
      return res.status(400).json({
        message: 'Nothing to update (provide Rating and/or Review)',
      });
    }

    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (String(CheckId.User) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'Not allowed to update this review' });
    }

    if (HasRating) {
      const RatingNum = Number(UpdateRating);
      if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
        return res.status(400).json({
          message: 'Rating must be an integer between 1 and 10',
        });
        }
      CheckId.Rating = RatingNum;
    }

    if (HasText) {
      const ReviewText = String(UpdateReview).trim();
      if (ReviewText.length > 1000) {
        return res.status(400).json({
          message: 'Review must be at most 1000 characters',
        });
      }
      CheckId.Review = ReviewText;
    }

    await CheckId.save();

    return res.status(200).json({
      message: 'Review updated successfully',
      reviewId: CheckId._id,
      rating: CheckId.Rating,
      review: CheckId.Review,
    });
  } catch (error) {
    console.error('EditReview:', error);
    return res.status(500).json({ message: error.message });
  }
}

/**
 * @swagger
 * /api//Reviews{id}:
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
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;
    const schema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const {
      error,
      value
    } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({
        message: 'Review id is required'
      });
    }
    const ReviewData = value.id;
    if (!ReviewData) {
      return res.status(400).json({
        message: "Review id is required"
      });
    }
    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      return res.status(404).json({
        message: "Review not found"
      });
    }

    if (String(CheckId.User) !== String(req.user.userId) && req.user.Role !== 'Admin') {
      return res.status(403).json({
        message: "Not allowed to delete this review"
      });
    }
    const Deleted = await Review.findByIdAndDelete(ReviewData)
    if (!Deleted) {
      return res.status(404).json({
        message: "Review not found"
      });
    }
    return res.status(200).json({
      message: "Review deleted successfully"
    });
  } catch (error) {
    console.error("DeleteReview", error)
    return res.status(500).json({
      message: error.message
    });

  }
}


module.exports = {
  CreateReview,
  GetBookReviews,
  EditReview,
  DeleteReview
}
