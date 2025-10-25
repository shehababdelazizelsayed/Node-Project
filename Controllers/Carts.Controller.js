/**
 * @swagger
 * components:
 *   schemas:
 *     CartItem:
 *       type: object
 *       properties:
 *         Book:
 *           type: string
 *           description: Book ID
 *         Quantity:
 *           type: integer
 *           minimum: 1
 *           description: Quantity of the book
 *       required:
 *         - Book
 *         - Quantity
 *     Cart:
 *       type: object
 *       properties:
 *         User:
 *           type: string
 *           description: User ID
 *         Items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const Cart = require("../models/Cart");
const Book = require("../models/Book");
const {
  CheckForUser
} = require("../Helpers/Login.Helper");
const Joi = require('joi');
const logger = require("../utils/logger");

/**
 * @swagger
 * /api/Cart:
 *   post:
 *     summary: Add book to cart
 *     tags: [Carts]
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
 *             properties:
 *               BookId:
 *                 type: string
 *                 description: Book ID to add to cart
 *               Qty:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 999
 *                 default: 1
 *                 description: Quantity to add
 *     responses:
 *       201:
 *         description: Book added to cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Cart:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       405:
 *         description: Out of stock
 *       500:
 *         description: Internal server error
 */
async function AddToCart(req, res) {
  try {
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;

    const schema = Joi.object({
      BookId: Joi.string()
        .trim()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'BookId must be a valid ObjectId'
        }),
      Qty: Joi.number().integer().min(1).max(999).default(1),
    });

    const emptySchema = Joi.object({}).unknown(false);

    ////////////////////////////////////////////////////////
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      logger.warn(`Validation error in AddToCart: ${error.details.map(d => d.message).join(', ')}`);
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message.replace(/"/g, '')),
      });
    }

    const { BookId, Qty } = value;
    ////////////////////////////////////////////////////////

    const GetBook = await Book.findById(BookId);
    if (!GetBook) {
      logger.warn(`AddToCart failed: Book not found | BookId=${BookId}`);
      return res.status(404).json({ message: "Book not found" });
    }

    let QtyNum = Qty;
    if (Qty === undefined || Qty === null) {
      QtyNum = 1;
    } else {
      QtyNum = Number(Qty);
    }

    if (GetBook.Stock < QtyNum) {
      logger.warn(`AddToCart failed: Out of Stock | Book=${GetBook.Title}, Stock=${GetBook.Stock}, Requested=${QtyNum}`);
      return res.status(405).json({ message: "Out of Stock" });
    }

    let SelectCart = await Cart.findOne({ User: req.user.userId });
    if (!SelectCart) {
      SelectCart = await Cart.create({
        User: req.user.userId,
        Items: [{ Book: GetBook._id, Quantity: QtyNum }],
      });

      const Result = await Cart.findById(SelectCart._id)
        .populate({
          path: "Items.Book",
          select: "Title Stock Price Image Category"
        });

      logger.info(`New cart created for user=${req.user.userId}, Book=${GetBook.Title}, Qty=${QtyNum}`);
      return res.status(201).json({ message: "Added to cart", Cart: Result });
    }

    const item = SelectCart.Items.find((Item) => Item.Book.equals(GetBook._id));
    if (item) {
      const newQty = item.Quantity + QtyNum;
      if (newQty > GetBook.Stock) {
        logger.warn(`AddToCart failed: Out of Stock after update | Book=${GetBook.Title}, Stock=${GetBook.Stock}, Requested=${newQty}`);
        return res.status(405).json({ message: "Out of Stock" });
      }

      item.Quantity = newQty;
      logger.info(`Cart updated: Increased quantity | User=${req.user.userId}, Book=${GetBook.Title}, NewQty=${newQty}`);
    } else {
      if (QtyNum > GetBook.Stock) {
        logger.warn(`AddToCart failed: Out of Stock | Book=${GetBook.Title}, Stock=${GetBook.Stock}, Requested=${QtyNum}`);
        return res.status(405).json({ message: "Out of Stock" });
      }

      SelectCart.Items.push({ Book: GetBook._id, Quantity: QtyNum });
      logger.info(`Book added to existing cart | User=${req.user.userId}, Book=${GetBook.Title}, Qty=${QtyNum}`);
    }

    await SelectCart.save();

    const Result = await Cart.findById(SelectCart._id)
      .populate({
        path: "Items.Book",
        select: "Title Stock Price Image Category"
      });

    logger.info(`AddToCart success | User=${req.user.userId}, Book=${GetBook.Title}, Qty=${QtyNum}`);
    console.log(Result);

    return res.status(201).json({
      message: "Added to cart",
      Cart: Result
    });
  } catch (error) {
    logger.error(`AddToCart Error: ${error.message}`, { stack: error.stack });
    console.error("AddToCart:", error);
    res.status(500).json({
      message: error.message
    });
  }
}

/**
 * @swagger
 * /api/Cart:
 *   get:
 *     summary: Get user's cart
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Cart:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 */

async function GetCart(req, res) {
  try {
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;

    const emptyBodySchema = Joi.object({}).unknown(false);
    const emptyQuerySchema = Joi.object({}).unknown(false);
    const bodyCheck = emptyBodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    const queryCheck = emptyQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (bodyCheck.error || queryCheck.error) {
      const errors = []
        .concat(bodyCheck.error ? bodyCheck.error.details : [])
        .concat(queryCheck.error ? queryCheck.error.details : [])
        .map(d => d.message.replace(/"/g, ''));
      logger.warn("Validation error in GetCart", { errors });
      return res.status(400).json({
        message: 'Validation error',
        errors
      });
    }

    let SelectCart = await Cart.findOne({
        User: req.user.userId
      })
      .populate({
        path: "Items.Book",
        select: "Title Price Stock Image Category"
      })
    if (!SelectCart) {
      logger.info(`Cart not found for user: ${req.user.userId}`);
      return res.status(404).json({
        message: "Cart not Found"
      });
    }

    logger.info(`Cart fetched successfully for user: ${req.user.userId}`);
    return res.status(200).json({
      message: "Cart is Found ",
      Cart: SelectCart
    });

  } catch (error) {
    logger.error("GetCart:", { message: error.message, stack: error.stack });
    res.status(500).json({
      message: error.message
    });
  }
}


/**
 * @swagger
 * /api/Carts/{id}:
 *   delete:
 *     summary: Remove book from cart
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID to remove from cart
 *     responses:
 *       200:
 *         description: Book removed from cart successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 Cart:
 *                   $ref: '#/components/schemas/Cart'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Cart or book not found
 *       500:
 *         description: Internal server error
 */


async function RemoveFromCart(req, res) {
  try {
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required()
    });

    const { error, value } = schema.validate(req.params, {
      stripUnknown: true
    });

    if (error) {
      logger.warn("Validation error in RemoveFromCart", {
        details: error.details.map(d => d.message)
      });
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message)
      });
    }

    const { id: BookId } = value;

    const SelectCart = await Cart.findOne({
      User: req.user.userId
    });

    if (!SelectCart) {
      logger.info(`Cart not found for user: ${req.user.userId}`);
      return res.status(404).json({
        message: "Cart not found"
      });
    }

    const index = SelectCart.Items.findIndex(item => item.Book.equals(BookId));

    if (index === -1) {
      logger.info(`Book ${BookId} not found in user ${req.user.userId}'s cart`);
      return res.status(404).json({
        message: "Book not found in cart"
      });
    }

    SelectCart.Items.splice(index, 1);
    await SelectCart.save();

    const Result = await Cart.findById(SelectCart._id)
      .populate({
        path: "Items.Book",
        select: "Title Price Stock Image Category"
      });

    logger.info(`Book ${BookId} removed from cart for user: ${req.user.userId}`);

    return res.status(200).json({
      message: "Removed from cart",
      Cart: Result
    });
  } catch (error) {
    logger.error("RemoveFromCart:", { message: error.message, stack: error.stack });
    return res.status(500).json({
      message: error.message
    });
  }
}

module.exports = {
  AddToCart,
  GetCart,
  RemoveFromCart
};