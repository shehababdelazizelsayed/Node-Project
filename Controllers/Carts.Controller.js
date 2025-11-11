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
const { CheckForUser } = require("../Helpers/Login.Helper");
const Joi = require("joi");

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
          "string.pattern.base": "BookId must be a valid ObjectId",
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
      return res.status(400).json({
        message: "Validation error",
        errors: error.details.map((d) => d.message.replace(/"/g, "")),
      });
    }

    const { BookId, Qty } = value;
    ////////////////////////////////////////////////////////

    const GetBook = await Book.findById(BookId);
    if (!GetBook) {
      return res.status(404).json({
        message: "Book not found",
      });
    }

    let QtyNum = Qty;
    if (Qty === undefined || Qty === null) {
      QtyNum = 1;
    } else {
      QtyNum = Number(Qty);
    }
    if (GetBook.Stock < QtyNum) {
      return res.status(405).json({
        message: "Out of Stock",
      });
    }
    let SelectCart = await Cart.findOne({
      User: req.user.userId,
    });
    if (!SelectCart) {
      SelectCart = await Cart.create({
        User: req.user.userId,
        Items: [
          {
            Book: GetBook._id,
            Quantity: QtyNum,
          },
        ],
      });
      /////
      const Result = await Cart.findById(SelectCart._id).populate({
        path: "Items.Book",
        select: "Title Stock Price Image Category",
      });

      return res.status(201).json({
        message: "Added to cart",
        Cart: Result,
      });
    }

    const item = SelectCart.Items.find((Item) => Item.Book.equals(GetBook._id));
    if (item) {
      const newQty = item.Quantity + QtyNum;
      if (newQty > GetBook.Stock) {
        return res.status(405).json({
          message: "Out of Stock",
        });
      }

      item.Quantity = newQty;
    } else {
      if (QtyNum > GetBook.Stock) {
        return res.status(405).json({
          message: "Out of Stock",
        });
      }

      SelectCart.Items.push({
        Book: GetBook._id,
        Quantity: QtyNum,
      });
    }

    await SelectCart.save();

    const Result = await Cart.findById(SelectCart._id).populate({
      path: "Items.Book",
      select: "Title Stock Price Image Category",
    });
    console.log(Result);
    return res.status(201).json({
      message: "Added to cart",
      Cart: Result,
    });
  } catch (error) {
    console.error("AddToCart:", error);
    res.status(500).json({
      message: error.message,
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
        .map((d) => d.message.replace(/"/g, ""));
      return res.status(400).json({
        message: "Validation error",
        errors,
      });
    }

    let SelectCart = await Cart.findOne({
      User: req.user.userId,
    }).populate({
      path: "Items.Book",
      select: "Title Price Stock Image Category",
    });
    if (!SelectCart) {
      return res.status(404).json({
        message: "Cart not Found",
      });
    }
    return res.status(200).json({
      message: "Cart is Found ",
      Cart: SelectCart,
    });
  } catch (error) {
    console.error("GetCart:", error);
    res.status(500).json({
      message: error.message,
    });
  }
}
/**
 * @swagger
 * /api/Cart/{id}:
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
const RemoveFromCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id: BookId } = req.params;

    if (!BookId) {
      return res.status(400).json({ message: "BookId is required" });
    }

    const cart = await Cart.findOne({ User: req.user.userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const index = cart.Items.findIndex(
      (item) => item.Book.toString() === BookId
    );
    if (index === -1) {
      return res.status(404).json({ message: "Book not found in cart" });
    }

    cart.Items.splice(index, 1);
    await cart.save();

    const result = await Cart.findById(cart._id).populate({
      path: "Items.Book",
      select: "Title Price Stock Image Category",
    });

    res.status(200).json({
      message: "Removed from cart",
      Cart: result,
    });
  } catch (error) {
    console.error("RemoveFromCart error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/**
 * @swagger
 * /api/Cart/{id}:
 *   put:
 *     summary: Update quantity of a book in the cart
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Book ID in the cart
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Quantity
 *             properties:
 *               Quantity:
 *                 type: integer
 *                 minimum: 1
 */
const UpdateCartItem = async (req, res) => {
  try {
    const userId = req.user.userId; // must match your other functions
    const { BookId, Quantity } = req.body;

    if (!BookId) return res.status(400).json({ message: "BookId is required" });
    if (!Quantity || Quantity < 1)
      return res.status(400).json({ message: "Quantity must be >= 1" });

    const cart = await Cart.findOne({ User: userId }).populate(
      "Items.Book",
      "Title Price Stock"
    );
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.Items.find((i) => i.Book._id.toString() === BookId);
    if (!item) return res.status(404).json({ message: "Book not in cart" });

    if (item.Book.Stock < Quantity) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    item.Quantity = Quantity;
    await cart.save();

    res.json({ message: "Cart updated", Cart: cart });
  } catch (err) {
    console.error("UpdateCartItem error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  AddToCart,
  GetCart,
  RemoveFromCart,
  UpdateCartItem,
};
