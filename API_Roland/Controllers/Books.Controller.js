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
    });

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

    if (req.user.Role !== "Admin" && GetThisBook.Owner.toString() !== req.user.userId) {
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

    if (req.user.Role !== "Admin" && GetThisBook.Owner.toString() !== req.user.userId) {
      return res.status(403).json({
        message: "You are not allowed to delete this book"
      });
    }
    const Deleted = await Book.findByIdAndDelete(id);
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
        errors: error.details.map(d => d.message.replace(/"/g, ''))
      });
    }

    const query = value;
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
    const books = await Book.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)


    return res.status(200).json({
      message: "Books retrieved successfully",
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      books: books,
    });
  } catch (error) {
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
