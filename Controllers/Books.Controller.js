const Book = require("../models/Book");
const Joi = require('joi');
const cloudinary = require("../Helpers/cloudinary");
const fs = require('fs');
const Review = require("../models/Review")
const mongoose = require('mongoose');
const userColl = mongoose.model('User').collection.name;
const { getCache, setCache, deleteCache } = require("../utils/redis");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// Normalization function: lowercase, remove non-alphanumeric except spaces, then remove spaces
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '');
}

// Add
async function AddBook(req, res) {
  try {

    const schema = Joi.object({
      Title: Joi.string().trim().min(1).required(),
      Author: Joi.string().trim().min(1).required(),
      Price: Joi.number().min(0).required(),
      Description: Joi.string().trim().min(1).required(),
      Stock: Joi.number().integer().min(0).default(0),
      Image: Joi.string().trim().uri().allow('', null),
      Category: Joi.string().trim().min(1).required(),
      Pdf: Joi.string().trim().uri().allow('', null),
    });

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
        errors: error.details.map(d => d.message.replace(/"/g, ''))
      });
    }
    const {
      Title,
      Author,
      Price,
      Description,
      Stock,
      Image,
      Category,
      Pdf
    } = value;

    // Normalize for uniqueness checks
    const normalizedTitle = normalizeString(Title);
    const normalizedImage = normalizeString(Image);
    const normalizedPdf = normalizeString(Pdf);

    // Check uniqueness only for provided fields
    let orConditions = [];
    if (normalizedTitle) {
      orConditions.push({ Title: { $regex: new RegExp(`^${normalizedTitle}$`, 'i') } });
    }
    if (normalizedImage) {
      orConditions.push({ Image: { $regex: new RegExp(`^${normalizedImage}$`, 'i') } });
    }
    if (normalizedPdf) {
      orConditions.push({ Pdf: { $regex: new RegExp(`^${normalizedPdf}$`, 'i') } });
    }

    if (orConditions.length > 0) {
      const existingBook = await Book.findOne({ $or: orConditions });
      if (existingBook) {
        return res.status(400).json({
          message: 'Book with similar Title, Image, or Pdf already exists'
        });
      }
    }

    let pdfUrl = Pdf;
    let imageUrl = Image;

    if (req.files && req.files.pdf && req.files.pdf[0]) {
      console.log("req.files.pdf:", req.files.pdf[0]);
      try {
        const result = await cloudinary.uploader.upload(req.files.pdf[0].path, {
          resource_type: "auto",
          folder: "books/pdfs"
        });
        pdfUrl = result.secure_url;
        fs.unlinkSync(req.files.pdf[0].path); // Remove local file after upload
      } catch (uploadError) {
        console.error("Cloudinary PDF upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload PDF to Cloudinary",
          error: uploadError.message
        });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      console.log("req.files.image:", req.files.image[0]);
      try {
        const result = await cloudinary.uploader.upload(req.files.image[0].path, {
          resource_type: "auto",
          folder: "books/images"
        });
        imageUrl = result.secure_url;
        fs.unlinkSync(req.files.image[0].path); // Remove local file after upload
      } catch (uploadError) {
        console.error("Cloudinary image upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message
        });
      }
    }


    // if (!Title || !Author || !Price || !Description || !Category) {
    //   return res.status(400).json({
    //     message: "Title, Author, Price , Description , Category are required",
    //   });
    // }


    // if (Number(Price) < 0) {
    //   return res.status(400).json({
    //     message: "Price must be >= 0"
    //   });
    // }

    // if (Number(Stock) < 0) {
    //   return res.status(400).json({
    //     message: "Stock must be >= 0"
    //   });
    // }


    const CreateBook = await Book.create({
      Title,
      Author,
      Price,
      Stock,
      Category,
      Description,
      Image: imageUrl,
      Pdf: pdfUrl,
      Owner: req.user.userId,
      Status: "Pending", // Default is Pending, but explicit
    });

    // Invalidate cache for books list
    await deleteCache('books:*');

    // Notify all admins
    const admins = await User.find({ Role: "Admin" });
    for (const admin of admins) {
      await sendEmail(
        admin.Email,
        "New Book Added for Approval",
        `Hello ${admin.Name},\n\nA new book has been added by ${req.user.name || 'a user'} and is pending approval.\n\nBook Details:\nTitle: ${Title}\nAuthor: ${Author}\nCategory: ${Category}\n\nPlease review and approve/reject the book.\n\nThanks!`
      );
    }

    return res.status(201).json({
      message: "Book created successfully",
      Book: CreateBook
    });

  } catch (error) {
    console.error("addBook:", error);
    return res.status(500).json({
      message: error.message
    });
  }
};


// Update
async function UpdateBooks(req, res) {
  try {

    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true
    });
    if (vParams.error) return res.status(400).json({
      message: 'Invalid id'
    });

    const {
      id
    } = vParams.value;

    const GetThisBook = await Book.findById(id);

    // if (req.body == null) {
    //   return res.status(400).json({
    //     message: "No fields to update"
    //   });
    // }

    if (!GetThisBook) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to edit this book"
      });
    }

    const bodySchema = Joi.object({
      Title: Joi.string().trim().min(1),
      Author: Joi.string().trim().min(1),
      Price: Joi.number().min(0),
      Stock: Joi.number().integer().min(0),
      Category: Joi.string().trim().min(1),
      Description: Joi.string().trim().min(1),
      Image: Joi.string().trim().uri().allow(''),
      Pdf: Joi.string().trim().uri().allow(''),
    }).min(1);

    const vBody = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (vBody.error) {
      return res.status(400).json({
        message: 'No fields to update',
        errors: vBody.error.details.map(d => d.message.replace(/"/g, ''))
      });
    }


    // const allowed = [
    //   "Title",
    //   "Author",
    //   "Price",
    //   "Stock",
    //   "Category",
    //   "Description",
    //   "Image",
    //   "Pdf",
    // ];

    const Update = {
      ...vBody.value
    };
    // for (const key of allowed) {
    //   if (req.body[key] != null) Update[key] = req.body[key];
    // }

    // if (Update.Price != null) {
    //   Update.Price = Number(Update.Price);
    //   if (Update.Price < 0)
    //     return res.status(400).json({
    //       message: "Price must be >= 0"
    //     });
    // }

    // if (Update.Stock != null) {
    //   Update.Stock = Number(Update.Stock);
    //   if (Update.Stock < 0)
    //     return res.status(400).json({
    //       message: "Stock must be >= 0"
    //     });
    // }

    const updatedBook = await Book.findByIdAndUpdate(id, Update, {
      new: true,
      runValidators: true

    });

    // Invalidate cache for books list
    await deleteCache('books:*');

    return res.status(200).json({
      message: "Book updated successfully",
      Book: updatedBook
    });

  } catch (error) {
    console.error("UpdateBook", error);

    return res.status(500).json({
      message: error.message
    });
  }
}


// Delete
async function DeleteBook(req, res) {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true
    });
    if (vParams.error) return res.status(400).json({
      message: 'Invalid id'
    });
    const {
      id
    } = vParams.value;


    // const Deleted = await Book.findByIdAndDelete(id);

    // if (!Deleted) {
    //   return res.status(404).json({
    //     message: "Book not found"
    //   });
    // }

    // if (req.user.Role !== "Admin" && CreateBook.Owner.toString() !== req.user.userId) {
    const GetThisBook = await Book.findById(id);
    if (!GetThisBook) {

      return res.status(404).json({
        message: "Book not found"
      });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this book"
      });
    }
    const Deleted = await Book.findByIdAndDelete(id);

    // Invalidate cache for books list
    await deleteCache('books:*');

    return res.status(200).json({
      message: "Book deleted successfully",
      Book: Deleted
    });

  } catch (error) {
    console.error("DeleteBook:", error);
    return res.status(500).json({
      message: error.message
    });
  }
}

// Get
async function GetBooks(req, res) {
  try {
    // const books = await Book.find();
    // return res.status(200).json({
    //   message: "Books retrieved successfully",
    //   books: books,
    // });

    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(2).max(100).default(2),
      sort: Joi.string().valid('Title', 'Price', 'Stock', 'createdAt').default('createdAt'),
      order: Joi.string().valid('asc', 'desc').default('desc'),
      search: Joi.string().trim().allow(''),
      Category: Joi.string().trim().allow(''),
      priceMin: Joi.number().min(0),
      priceMax: Joi.number().min(0),
      inStock: Joi.boolean(),
        withReviews: Joi.boolean().default(false),
  reviewLimit: Joi.number().integer().min(1).max(50).default(3),
  withStats: Joi.boolean().default(false),
  withLastReview: Joi.boolean().default(true)
    }).unknown(false);

    const {
      error,
      value
    } = schema.validate(req.query, {
      stripUnknown: true
    });
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(val => val.message.replace(/"/g, ''))
      });
    }

    const query = value;

    // Generate cache key based on query params
    const cacheKey = `books:${JSON.stringify(query)}`;

    // Check cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log('Cache hit for books');
      return res.status(200).json(cachedData);
    }
    console.log('Cache miss for books');
    const limit = query.limit;
    const page = query.page;
    const skip = (page - 1) * limit;
    if (query.priceMin != null && query.priceMax != null && query.priceMin > query.priceMax) {

      return res.status(400).json({
        message: 'priceMin cannot be greater than priceMax'
      });
    }
    //  filter
    const filter = {};
    if (query.search) {
      filter.$or = [{
          Title: {
            $regex: query.search,
            $options: 'i'
          }
        },
        {
          Author: {
            $regex: query.search,
            $options: 'i'
          }
        },
      ];
    }
    if (query.Category) filter.Category = query.Category;
    if (query.priceMin != null || query.priceMax != null) {
      filter.Price = {};
      if (query.priceMin != null) filter.Price.$gte = query.priceMin;
      if (query.priceMax != null) filter.Price.$lte = query.priceMax;
    }
    if (query.inStock === true) filter.Stock = {
      $gt: 0
    };

    // sort
    const sortDir = query.order === 'asc' ? 1 : -1;
    const sortObj = {
      [query.sort]: sortDir
    };

    const total = await Book.countDocuments(filter);
      let booksQuery = Book.find(filter, value.withReviews ? undefined : { Reviews: 0 })
      .sort(sortObj)
      .skip(skip)
      .limit(limit);
    if (value.withReviews) {
  booksQuery = booksQuery.populate({
    path: 'Reviews',
    select: 'User Rating Review createdAt',
    options: { sort: { createdAt: -1 }, limit: value.reviewLimit },
    populate: { path: 'User', select: 'Name', options: { lean: true } },
  });
}

let books = await booksQuery.lean();

function formatReviewForClient(reviewDoc) {
  return {
    User: { Name: reviewDoc?.User?.Name ?? null },
    Rating: reviewDoc.Rating,
    Review: reviewDoc.Review,
    createdAt: reviewDoc.createdAt,
  };
}

function normalizeBookReviews(book) {
  if (!Array.isArray(book.Reviews) || book.Reviews.length === 0) {
    delete book.Reviews;
    return book;
  }
  book.Reviews = book.Reviews.map(formatReviewForClient);
  return book;
}

async function computeStatsForBooks(bookIds, usersCollectionName, ReviewModel) {
  const aggregationRows = await ReviewModel.aggregate([
    { $match: { Book: { $in: bookIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$Book',
        avgRating: { $avg: '$Rating' },
        reviewsCount: { $sum: 1 },
        lastReview: { $first: '$$ROOT' },
      },
    },
    {
      $lookup: {
        from: usersCollectionName,
        localField: 'lastReview.User',
        foreignField: '_id',
        as: 'lastUser',
        pipeline: [{ $project: { _id: 0, Name: 1 } }],
      },
    },
    {
      $project: {
        avgRating: 1,
        reviewsCount: 1,
        lastReview: {
          rating: '$lastReview.Rating',
          review: '$lastReview.Review',
          createdAt: '$lastReview.createdAt',
          userName: { $ifNull: [{ $arrayElemAt: ['$lastUser.Name', 0] }, null] },
        },
      },
    },
  ]);

  const statsByIdMap = {};
  for (const row of aggregationRows) statsByIdMap[String(row._id)] = row;
  return statsByIdMap;
}

function attachStats(booksList, statsByIdMap, { withStats, withLastReview }) {
  const DEFAULT_AVG = 3;
  return booksList.map((book) => {
    const stat = statsByIdMap[String(book._id)];
    if (withStats) {
      const avg = stat ? Number((stat.avgRating ?? 0).toFixed(2)) : DEFAULT_AVG;
      book.stats = {
        avgRating: avg,
        reviewsCount: stat ? stat.reviewsCount : 0,
        isDefaultAvg: !stat,
      };
    }
    if (withLastReview) {
      book.lastReview = stat ? stat.lastReview : null;
    }
    return book;
  });
}

if (value.withReviews) {
  books = books.map(normalizeBookReviews);
}

const needStats = books.length && (value.withStats || value.withLastReview);
if (needStats) {
  const bookIds = books.map((book) => book._id);
  const statsById = await computeStatsForBooks(bookIds, userColl, Review);
  books = attachStats(books, statsById, {
    withStats: value.withStats,
    withLastReview: value.withLastReview,
  });
}


    const response = {
      message: "Books retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      },
      books: books,
    };

    // Cache the response
    await setCache(cacheKey, response, 300); // TTL 5 minutes

    return res.status(200).json(response);
  } catch (error) {
    console.error("GetBooks:", error);
    return res.status(500).json({
      message: error.message
    });
  }
}

// Approve/Reject Book (Admin only)
async function ApproveRejectBook(req, res) {
  try {
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true
    });
    if (vParams.error) return res.status(400).json({
      message: 'Invalid id'
    });

    const { id } = vParams.value;

    const bodySchema = Joi.object({
      status: Joi.string().valid("Approved", "Rejected").required()
    });
    const vBody = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    if (vBody.error) {
      return res.status(400).json({
        message: 'Validation error',
        errors: vBody.error.details.map(d => d.message.replace(/"/g, ''))
      });
    }

    const { status } = vBody.value;

    const book = await Book.findById(id).populate('Owner', 'Name Email');
    if (!book) {
      return res.status(404).json({
        message: "Book not found"
      });
    }

    if (book.Status !== "Pending") {
      return res.status(400).json({
        message: "Book is not pending approval"
      });
    }

    book.Status = status;
    await book.save();

    // Invalidate cache for books list
    await deleteCache('books:*');

    // Notify the book owner
    await sendEmail(
      book.Owner.Email,
      `Book ${status.toLowerCase()}`,
      `Hello ${book.Owner.Name},\n\nYour book "${book.Title}" has been ${status.toLowerCase()} by an admin.\n\nThanks!`
    );

    return res.status(200).json({
      message: `Book ${status.toLowerCase()} successfully`,
      book: {
        _id: book._id,
        Title: book.Title,
        Status: book.Status
      }
    });

  } catch (error) {
    console.error("ApproveRejectBook:", error);
    return res.status(500).json({
      message: error.message
    });
  }
}

module.exports = {
  AddBook,
  GetBooks,
  UpdateBooks,
  DeleteBook,
  ApproveRejectBook
};
