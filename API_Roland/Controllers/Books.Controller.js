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
const Joi = require('joi');
const cloudinary = require("../Helpers/cloudinary");
const fs = require('fs');
const Review = require("../models/Review")
const mongoose = require('mongoose');
const userColl = mongoose.model('User').collection.name;
const { getCache, setCache, deleteCache } = require("../utils/redis");
const logger = require("../utils/logger");
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
 *               Image:
 *                 type: string
 *                 format: uri
 *                 description: Book image URL
 *               Category:
 *                 type: string
 *                 description: Book category
 *               Pdf:
 *                 type: string
 *                 format: uri
 *                 description: Book PDF URL (optional if file is uploaded)
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

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn("Validation error while adding a book", {
        details: error.details.map((d) => d.message),
      });
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
      logger.info(`Uploading PDF for book "${Title}" to Cloudinary...`);
      console.log("req.files.pdf:", req.files.pdf[0]);
      try {
        const result = await cloudinary.uploader.upload(req.files.pdf[0].path, {
          resource_type: "auto",
          folder: "books/pdfs",
        });
        pdfUrl = result.secure_url;
        fs.unlinkSync(req.files.pdf[0].path); // Remove local file after upload
        logger.info(`PDF uploaded successfully for "${Title}"`);
      } catch (uploadError) {
        logger.error(`Cloudinary PDF upload error for "${Title}": ${uploadError.message}`, {
          stack: uploadError.stack,
        });
        console.error("Cloudinary PDF upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload PDF to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      logger.info(`Uploading image for book "${Title}" to Cloudinary...`);
      console.log("req.files.image:", req.files.image[0]);
      try {
        const result = await cloudinary.uploader.upload(req.files.image[0].path, {
          resource_type: "auto",
          folder: "books/images",
        });
        imageUrl = result.secure_url;
        fs.unlinkSync(req.files.image[0].path); // Remove local file after upload
        logger.info(`Image uploaded successfully for "${Title}"`);
      } catch (uploadError) {
        logger.error(`Cloudinary image upload error for "${Title}": ${uploadError.message}`, {
          stack: uploadError.stack,
        });
        console.error("Cloudinary image upload error:", uploadError);
        return res.status(500).json({
          message: "Failed to upload image to Cloudinary",
          error: uploadError.message,
        });
      }
    }

    logger.info(`Book "${Title}" added successfully to the database.`);
    
  } catch (error) {
    logger.error(`AddBook Error: ${error.message}`, { stack: error.stack });
    console.error(error);
    res.status(500).json({ message: "Server error" });
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
 *               Image:
 *                 type: string
 *                 format: uri
 *                 description: Book image URL
 *               Category:
 *                 type: string
 *                 description: Book category
 *               Pdf:
 *                 type: string
 *                 format: uri
 *                 description: Book PDF URL
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

    const vParams = paramsSchema.validate(req.params, { stripUnknown: true });

    if (vParams.error) {
      logger.warn("Invalid book ID provided for update", {
        details: vParams.error.details,
      });
      return res.status(400).json({ message: "Invalid id" });
    }

    const { id } = vParams.value;
    const GetThisBook = await Book.findById(id);

    if (!GetThisBook) {
      logger.warn(`Book not found for update. ID: ${id}`);
      return res.status(404).json({ message: "Book not found" });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      logger.warn(
        `Unauthorized update attempt by user ${req.user.userId} for book ${id}`
      );
      return res
        .status(403)
        .json({ message: "You are not allowed to edit this book" });
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
      logger.warn("Invalid update fields for book", {
        errors: vBody.error.details.map((d) => d.message),
      });
      return res.status(400).json({
        message: "No fields to update",
        errors: vBody.error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const Update = {
      ...vBody.value,
    };

    const updatedBook = await Book.findByIdAndUpdate(id, Update, {
      new: true,
      runValidators: true,
    });

    // Invalidate cache for books list
    await deleteCache("books:*");
    logger.info(`Book updated successfully. ID: ${id}`);

    return res.status(200).json({
      message: "Book updated successfully",
      Book: updatedBook,
    });
  } catch (error) {
    logger.error(`UpdateBooks Error: ${error.message}`, { stack: error.stack });
    console.error("UpdateBook", error);
    return res.status(500).json({ message: error.message });
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
      id: Joi.string().hex().length(24).required()
    });
    const vParams = paramsSchema.validate(req.params, {
      stripUnknown: true
    });
    if (vParams.error) return res.status(400).json({
      message: 'Invalid id'
    });
    const { id } = vParams.value;

    const GetThisBook = await Book.findById(id);
    if (!GetThisBook) {
      logger.error(`Book not found with ID: ${id}`);
      return res.status(404).json({
        message: "Book not found"
      });
    }

    if (req.user.Role !== "Admin" && GetThisBook.Owner !== req.user.userId) {
      logger.warn(`Unauthorized delete attempt by user ${req.user.userId} for book ${id}`);
      return res.status(403).json({
        message: "You are not allowed to delete this book"
      });
    }

    const Deleted = await Book.findByIdAndDelete(id);

    // Invalidate cache for books list
    await deleteCache('books:*');

    logger.info(`Book deleted successfully by ${req.user.userId} | Book ID: ${id}`);

    return res.status(200).json({
      message: "Book deleted successfully",
      Book: Deleted
    });

  } catch (error) {
    logger.error(`DeleteBook Error: ${error.message}`, { stack: error.stack });
    console.error("DeleteBook:", error);
    return res.status(500).json({
      message: error.message
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

    const { error, value } = schema.validate(req.query, { stripUnknown: true });
    if (error) {
      logger.warn(`Validation error in GetBooks: ${error.details.map(val => val.message).join(", ")}`);
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(val => val.message.replace(/"/g, ''))
      });
    }

    const query = value;
    const cacheKey = `books:${JSON.stringify(query)}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      logger.info(`Cache hit for books | query: ${JSON.stringify(query)}`);
      return res.status(200).json(cachedData);
    }

    logger.info(`Cache miss for books | query: ${JSON.stringify(query)}`);

    const limit = query.limit;
    const page = query.page;
    const skip = (page - 1) * limit;

    if (query.priceMin != null && query.priceMax != null && query.priceMin > query.priceMax) {
      logger.warn(`Invalid price range: min(${query.priceMin}) > max(${query.priceMax})`);
      return res.status(400).json({
        message: 'priceMin cannot be greater than priceMax'
      });
    }

    // filter
    const filter = {};
    if (query.search) {
      filter.$or = [
        { Title: { $regex: query.search, $options: 'i' } },
        { Author: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.Category) filter.Category = query.Category;
    if (query.priceMin != null || query.priceMax != null) {
      filter.Price = {};
      if (query.priceMin != null) filter.Price.$gte = query.priceMin;
      if (query.priceMax != null) filter.Price.$lte = query.priceMax;
    }
    if (query.inStock === true) filter.Stock = { $gt: 0 };

    // sort
    const sortDir = query.order === 'asc' ? 1 : -1;
    const sortObj = { [query.sort]: sortDir };

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

    await setCache(cacheKey, response, 300);
    logger.info(`Books retrieved successfully | total: ${total}, page: ${page}`);

    return res.status(200).json(response);
  } catch (error) {
    logger.error(`GetBooks Error: ${error.message}`, { stack: error.stack });
    console.error("GetBooks:", error);
    return res.status(500).json({
      message: error.message
    });
  }
}

module.exports = {
  AddBook,
  GetBooks,
  UpdateBooks,
  DeleteBook
};
