const Review = require("../models/Review")
const Joi = require('joi');
const Book = require("../models/Book");
const {
  CheckForUser
} = require("../Helpers/Login.Helper");


async function CreateReview(req, res) {
  try {

    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
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
      User: CheckUser._id,
      Book: BookId
    });
    if (exists) {
      return res.status(409).json({
        message: "You have already reviewed this book"
      });
    }


    const created = await Review.create({
      User: CheckUser._id,
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

async function GetBookReviews(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
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
async function EditReview(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const vParams = paramsSchema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });
    if (vParams.error) {
      return res.status(400).json({
        message: 'Review id is required'
      });
    }
    const ReviewData = vParams.value.id;

    if (!ReviewData) {
      return res.status(400).json({
        message: "Review id is required"
      });
    }
    const bodySchema = Joi.object({
      Rating: Joi.number().integer().min(1).max(10),
      Review: Joi.string().trim().max(1000),
    }).or('Rating', 'Review');

    const vBody = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (vBody.error) {
      return res.status(400).json({
        message: 'Nothing to update (provide Rating and/or Review)'
      });
    }

    const UpdateRating = vBody.value.Rating;
    const UpdateReview = vBody.value.Review;

    const HasRating = UpdateRating !== undefined && UpdateRating !== null;
    const HasText = UpdateReview !== undefined && UpdateReview !== null;

    if (!HasRating && !HasText) {
      return res.status(400).json({
        message: "Nothing to update (provide Rating and/or Review)"
      });
    }

    const CheckId = await Review.findById(ReviewData);
    if (!CheckId) {
      return res.status(404).json({
        message: "Review not found"
      });
    }

    if (String(CheckId.User) !== String(CheckUser._id)) {
      return res.status(403).json({
        message: "Not allowed to update this review"
      });
    }

    if (HasRating) {
      const RatingNum = Number(UpdateRating);
      if (!Number.isInteger(RatingNum) || RatingNum < 1 || RatingNum > 10) {
        return res.status(400).json({
          message: "Rating must be an integer between 1 and 10"
        });
      }
      CheckId.Rating = RatingNum;
    }

    if (HasText) {
      let ReviewText = String(UpdateReview).trim();
      if (ReviewText.length > 1000) {
        return res.status(400).json({
          message: "Review must be at most 1000 characters"
        });
      }
      CheckId.Review = ReviewText;
    }

    await CheckId.save();

    return res.status(200).json({
      message: "Review updated successfully",
      reviewId: CheckId._id,
      rating: CheckId.Rating,
      review: CheckId.Review
    });
  } catch (error) {
    console.error("EditReview:", error);
    return res.status(500).json({
      message: error.message
    });
  }
}

async function DeleteReview(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
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

    if (String(CheckId.User) !== String(CheckUser._id)) {
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
