/**
 * @swagger
 * components:
 *   schemas:
 *     Book:
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
 */
const Book = require("../models/Book");
const Joi = require("joi");
const cloudinary = require("../Helpers/cloudinary");
const fs = require("fs");
const Review = require("../models/Review");
const mongoose = require("mongoose");
const userColl = mongoose.model("User").collection.name;
const { getCache, setCache, deleteCache } = require("../utils/redis");
/**
 * @swagger
 * /api/Books:
 *   post:
 *     summary: Add a new book
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - Title
 *               - Author
 *               - Price
 *               - Description
 *               - Category
 *             properties:
 *               Title:
 *                 type: string
 *                 description: Book title
 *               Author:
 *                 type: string
 *                 description: Book author
 *               Price:
 *                 type: number
 *                 description: Book price
 *               Description:
 *                 type: string
 *                 description: Book description
 *               Stock:
 *                 type: integer
 *                 description: Book stock quantity
 *               Category:
 *                 type: string
 *                 description: Book category
 *               pdf:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to upload
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to upload
 *     responses:
 *       201:
 *         description: Book created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Book:
 *                   $ref: '#/components/schemas/Book'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */

// Add
async function AddBook(req, res) {
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
      console.log("req.files.pdf:", req.files.pdf[0]);
      try {
        const result = await cloudinary.uploader.upload(req.files.pdf[0].path, {
          resource_type: "auto",
          folder: "books/pdfs",
        });
        pdfUrl = result.secure_url;
        fs.unlinkSync(req.files.pdf[0].path); // Remove local file after upload
      } catch (uploadError) {
        console.error("Cloudinary PDF upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload PDF to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      console.log("req.files.image:", req.files.image[0]);
      try {
        const result = await cloudinary.uploader.upload(
          req.files.image[0].path,
          {
            resource_type: "auto",
            folder: "books/images",
          }
        );
        imageUrl = result.secure_url;
        fs.unlinkSync(req.files.image[0].path); // Remove local file after upload
      } catch (uploadError) {
        console.error("Cloudinary image upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
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
    });

    // Invalidate cache for books list
    await deleteCache("books:*");

    return res.status(201).json({
      message: "Book created successfully",
      Book: CreateBook,
    });
  } catch (error) {
    console.error("addBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/Books/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Title:
 *                 type: string
 *                 description: Book title
 *               Author:
 *                 type: string
 *                 description: Book author
 *               Price:
 *                 type: number
 *                 description: Book price
 *               Description:
 *                 type: string
 *                 description: Book description
 *               Stock:
 *                 type: integer
 *                 description: Book stock quantity
 *               Category:
 *                 type: string
 *                 description: Book category
 *     responses:
 *       200:
 *         description: Book updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Book:
 *                   $ref: '#/components/schemas/Book'
 *       400:
 *         description: Validation error or invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */

// Update
async function UpdateBooks(req, res) {
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

    const GetThisBook = await Book.findById(id);

    // if (req.body == null) {
    //   return res.status(400).json({
    //     message: "No fields to update"
    //   });
    // }

    if (!GetThisBook) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to edit this book",
      });
    }

    const bodySchema = Joi.object({
      Title: Joi.string().trim().min(1),
      Author: Joi.string().trim().min(1),
      Price: Joi.number().min(0),
      Stock: Joi.number().integer().min(0),
      Category: Joi.string().trim().min(1),
      Description: Joi.string().trim().min(1),
      Image: Joi.string().trim().uri().allow(""),
      Pdf: Joi.string().trim().uri().allow(""),
    }).min(1);

    const vBody = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (vBody.error) {
      return res.status(400).json({
        message: "No fields to update",
        errors: vBody.error.details.map((d) => d.message.replace(/"/g, "")),
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
      ...vBody.value,
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
      runValidators: true,
    });

    // Invalidate cache for books list
    await deleteCache("books:*");

    return res.status(200).json({
      message: "Book updated successfully",
      Book: updatedBook,
    });
  } catch (error) {
    console.error("UpdateBook", error);

    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/Books/{id}:
 *   delete:
 *     summary: Delete a book
 *     tags: [Books]
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
 *         description: Book deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Book:
 *                   $ref: '#/components/schemas/Book'
 *       400:
 *         description: Invalid ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */

// Delete
async function DeleteBook(req, res) {
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
        message: "Book not found",
      });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this book",
      });
    }
    const Deleted = await Book.findByIdAndDelete(id);

    // Invalidate cache for books list
    await deleteCache("books:*");

    return res.status(200).json({
      message: "Book deleted successfully",
      Book: Deleted,
    });
  } catch (error) {
    console.error("DeleteBook:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}
/**
 * @swagger
 * /api/Books:
 *   get:
 *     summary: Get books with pagination, filters, optional reviews and stats
 *     tags: [Books]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 2, maximum: 100, default: 2 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [Title, Price, Stock, createdAt], default: createdAt }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: Category
 *         schema: { type: string }
 *       - in: query
 *         name: priceMin
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: priceMax
 *         schema: { type: number, minimum: 0 }
 *       - in: query
 *         name: inStock
 *         schema: { type: boolean }
 *         example: true
 *       - in: query
 *         name: withReviews
 *         schema: { type: boolean, default: false }
 *         example: true
 *       - in: query
 *         name: reviewLimit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 3 }
 *       - in: query
 *         name: withStats
 *         schema: { type: boolean, default: false }
 *         example: true
 *       - in: query
 *         name: withLastReview
 *         schema: { type: boolean, default: true }
 *         example: false
 *     responses:
 *       200:
 *         description: Books retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 *                 books:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/BookWithExtras' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { description: Internal server error }
 */

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
      limit: Joi.number().integer().min(2).max(100).default(4),
      sort: Joi.string()
        .valid("Title", "Price", "Stock", "createdAt")
        .default("createdAt"),
      order: Joi.string().valid("asc", "desc").default("desc"),
      search: Joi.string().trim().allow(""),
      Category: Joi.string().trim().allow(""),
      priceMin: Joi.number().min(0),
      priceMax: Joi.number().min(0),
      inStock: Joi.boolean(),
      withReviews: Joi.boolean().default(false),
      reviewLimit: Joi.number().integer().min(1).max(50).default(3),
      withStats: Joi.boolean().default(false),
      withLastReview: Joi.boolean().default(true),
    }).unknown(false);

    const { error, value } = schema.validate(req.query, {
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((val) => val.message.replace(/"/g, "")),
      });
    }

    const query = value;

    // Generate cache key based on query params
    const cacheKey = `books:${JSON.stringify(query)}`;

    // Check cache first
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log("Cache hit for books");
      return res.status(200).json(cachedData);
    }
    console.log("Cache miss for books");
    const limit = query.limit;
    const page = query.page;
    const skip = (page - 1) * limit;
    if (
      query.priceMin != null &&
      query.priceMax != null &&
      query.priceMin > query.priceMax
    ) {
      return res.status(400).json({
        message: "priceMin cannot be greater than priceMax",
      });
    }
    //  filter
    const filter = {};
    if (query.search) {
      filter.$or = [
        {
          Title: {
            $regex: query.search,
            $options: "i",
          },
        },
        {
          Author: {
            $regex: query.search,
            $options: "i",
          },
        },
      ];
    }
    if (query.Category) filter.Category = query.Category;
    if (query.priceMin != null || query.priceMax != null) {
      filter.Price = {};
      if (query.priceMin != null) filter.Price.$gte = query.priceMin;
      if (query.priceMax != null) filter.Price.$lte = query.priceMax;
    }
    if (query.inStock === true)
      filter.Stock = {
        $gt: 0,
      };

    // sort
    const sortDir = query.order === "asc" ? 1 : -1;
    const sortObj = {
      [query.sort]: sortDir,
    };

    const total = await Book.countDocuments(filter);
    let booksQuery = Book.find(
      filter,
      value.withReviews ? undefined : { Reviews: 0 }
    )
      .sort(sortObj)
      .skip(skip)
      .limit(limit);
    if (value.withReviews) {
      booksQuery = booksQuery.populate({
        path: "Reviews",
        select: "User Rating Review createdAt",
        options: { sort: { createdAt: -1 }, limit: value.reviewLimit },
        populate: { path: "User", select: "Name", options: { lean: true } },
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

    async function computeStatsForBooks(
      bookIds,
      usersCollectionName,
      ReviewModel
    ) {
      const aggregationRows = await ReviewModel.aggregate([
        { $match: { Book: { $in: bookIds } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$Book",
            avgRating: { $avg: "$Rating" },
            reviewsCount: { $sum: 1 },
            lastReview: { $first: "$$ROOT" },
          },
        },
        {
          $lookup: {
            from: usersCollectionName,
            localField: "lastReview.User",
            foreignField: "_id",
            as: "lastUser",
            pipeline: [{ $project: { _id: 0, Name: 1 } }],
          },
        },
        {
          $project: {
            avgRating: 1,
            reviewsCount: 1,
            lastReview: {
              rating: "$lastReview.Rating",
              review: "$lastReview.Review",
              createdAt: "$lastReview.createdAt",
              userName: {
                $ifNull: [{ $arrayElemAt: ["$lastUser.Name", 0] }, null],
              },
            },
          },
        },
      ]);

      const statsByIdMap = {};
      for (const row of aggregationRows) statsByIdMap[String(row._id)] = row;
      return statsByIdMap;
    }

    function attachStats(
      booksList,
      statsByIdMap,
      { withStats, withLastReview }
    ) {
      const DEFAULT_AVG = 3;
      return booksList.map((book) => {
        const stat = statsByIdMap[String(book._id)];
        if (withStats) {
          const avg = stat
            ? Number((stat.avgRating ?? 0).toFixed(2))
            : DEFAULT_AVG;
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
        pages: Math.max(1, Math.ceil(total / limit)),
      },
      books: books,
    };

    // Cache the response
    await setCache(cacheKey, response, 300); // TTL 5 minutes

    return res.status(200).json(response);
  } catch (error) {
    console.error("GetBooks:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

/**
 * @swagger
 * /api/Books/{id}:
 *   get:
 *     summary: Get a single book by ID
 *     tags: [Books]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID
 *       - in: query
 *         name: withReviews
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include book reviews
 *       - in: query
 *         name: reviewLimit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 3
 *         description: Number of reviews to include
 *     responses:
 *       200:
 *         description: Book retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 book:
 *                   $ref: '#/components/schemas/Book'
 *       400:
 *         description: Invalid ID
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */
async function GetBookById(req, res) {
  try {
    // Validate params
    const paramsSchema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true,
    });
    if (vParams.error) {
      return res.status(400).json({
        message: "Invalid id",
      });
    }

    // Validate query params
    const querySchema = Joi.object({
      withReviews: Joi.boolean().default(false),
      reviewLimit: Joi.number().integer().min(1).max(50).default(3),
    });
    const vQuery = querySchema.validate(req.query, {
      stripUnknown: true,
    });
    if (vQuery.error) {
      return res.status(400).json({
        message: "Invalid query parameters",
        errors: vQuery.error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { id } = vParams.value;
    const { withReviews, reviewLimit } = vQuery.value;

    // Check cache first
    const cacheKey = `book:${id}:${withReviews}:${reviewLimit}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      console.log("Cache hit for single book");
      return res.status(200).json(cachedData);
    }
    console.log("Cache miss for single book");

    // Build query
    let query = Book.findById(id);

    if (withReviews) {
      query = query.populate({
        path: "Reviews",
        select: "User Rating Review createdAt",
        options: {
          sort: { createdAt: -1 },
          limit: reviewLimit,
        },
        populate: {
          path: "User",
          select: "Name",
        },
      });
    }

    const book = await query.lean();

    if (!book) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    // Format reviews if present
    if (withReviews && Array.isArray(book.Reviews)) {
      book.Reviews = book.Reviews.map((review) => ({
        User: { Name: review?.User?.Name ?? null },
        Rating: review.Rating,
        Review: review.Review,
        createdAt: review.createdAt,
      }));
    }

    const response = {
      message: "Book retrieved successfully",
      book,
    };

    // Cache the response
    await setCache(cacheKey, response, 300); // TTL 5 minutes

    return res.status(200).json(response);
  } catch (error) {
    console.error("GetBookById:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

module.exports = {
  AddBook,
  GetBooks,
  UpdateBooks,
  DeleteBook,
  GetBookById,
};
