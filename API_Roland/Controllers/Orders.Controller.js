/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         BookId:
 *           type: string
 *           description: Book ID
 *         Quantity:
 *           type: integer
 *           minimum: 1
 *           description: Quantity ordered
 *       required:
 *         - BookId
 *         - Quantity
 *     Order:
 *       type: object
 *       properties:
 *         User:
 *           type: string
 *           description: User ID
 *         Books:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         TotalPrice:
 *           type: number
 *           description: Total order price
 *         Status:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *           description: Order status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */
const Order = require("../models/Order")
const {
  CheckForUser
} = require("../Helpers/Login.Helper");
const Book = require("../models/Book");
const Cart = require("../models/Cart");
const mongoose = require("mongoose");
const Joi = require("joi");



const createOrderSchema = Joi.object({
  Books: Joi.array().items(
    Joi.object({
      BookId: Joi.string().trim().required(),
      Quantity: Joi.number().integer().min(1).required(),
    })
  ).min(1).required(),
});

/**
 * @swagger
 * /api/Orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - Books
 *             properties:
 *               Books:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - BookId
 *                     - Quantity
 *                   properties:
 *                     BookId:
 *                       type: string
 *                       description: Book ID
 *                     Quantity:
 *                       type: integer
 *                       minimum: 1
 *                       description: Quantity to order
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                 total:
 *                   type: number
 *       400:
 *         description: Validation error or insufficient stock
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Book not found
 *       500:
 *         description: Internal server error
 */
async function CreateOrder(req, res) {



  try {
    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;
    const CheckCart = await Cart.findOne({ User: req.user.userId });
    if (!CheckCart) {
      return res.status(400).json({ message: "Cart is empty" });

    }
    const body = req.body;
    if (!body || !Array.isArray(body.Books) || body.Books.length === 0) {
      return res.status(400).json({
        message: "Books array is required"
      });
    }
    //   let totalPrice = 0;
    //   for (let i = 0; i < body.Books.length; i++) {
    //     const item = body.Books[i];

    //     if (!item || !item.BookId) {
    //       return res.status(400).json({
    //         message: "Book not BookId is required at index " + i
    //       });
    //     }

    //     const book = await Book.findById(item.BookId);
    //     if (!book) {
    //       return res.status(404).json({
    //         message: "Book not found " + i
    //       });
    //     }

    //     if (book.Stock == null || book.Stock < item.Quantity) {
    //       return res.status(400).json({
    //         message: "Not enough stock" + i
    //       });
    //     }



    //     book.Stock = book.Stock - Number(item.Quantity);
    //     await book.save();

    //     totalPrice = totalPrice + (Number(book.Price) * Number(item.Quantity));
    //   }

    //   const created = await Order.create({
    //     User: CheckUser._id,
    //     Books: body.Books.map(Item => ({
    //       BookId: Item.BookId,
    //       Quantity: Number(Item.Quantity)
    //     })),
    //     TotalPrice: Number(totalPrice.toFixed(2)),
    //     Status: "pending"
    //   });

    //   return res.status(201).json({
    //     message: "Order placed",
    //     orderId: created._id,
    //     total: created.TotalPrice
    //   });

    const session = await mongoose.startSession();
    let totalPrice = 0;
    let created = null;
    try {
      await session.withTransaction(async () => {
        totalPrice = 0;

        for (let i = 0; i < body.Books.length; i++) {

          const item = body.Books[i];

          if (!item || !item.BookId) {

            throw new Error("VALIDATION_MISSING_BOOKID_" +
              i);
          }

          const book = await Book.findById(item.BookId).session(session);
          if (!book) {

            throw new Error("NOT_FOUND_" +
              i);
          }

          const qtyNum = Number(item.Quantity);
          if (book.Stock == null || qtyNum < 1) {

            throw new Error("INVALID_QTY_" +
              i);
          }

          const reserve = await Book.updateOne({
            _id: item.BookId,
            Stock: {
              $gte: qtyNum
            }
          }, {
            $inc: {
              Stock: -qtyNum
            }
          }, {
            session
          });
          if (reserve.matchedCount === 0 || reserve.modifiedCount === 0) {

            throw new Error("INSUFFICIENT_STOCK_" +
              i);
          }
          totalPrice = totalPrice + (Number(book.Price) * qtyNum);
        }
        totalPrice = Number(totalPrice.toFixed(2));
        created = await Order.create([{
          User: req.user.userId,
          Books: body.Books.map(Item => ({
            BookId: Item.BookId,
            Quantity: Number(Item.Quantity)
          })),
          TotalPrice: totalPrice,
          Status: "pending"
        }], {
          session
        });
        created = created[0];
      });
    } catch (trxErr) {

      if (typeof trxErr.message === "string") {

        if (trxErr.message.startsWith("VALIDATION_MISSING_BOOKID_")) {

          const i = trxErr.message.split("_").pop();
          return res.status(400).json({
            message: "Book not BookId is required at index " +
              i
          });
        }
        if (trxErr.message.startsWith("NOT_FOUND_")) {

          const i = trxErr.message.split("_").pop();
          return res.status(404).json({
            message: "Book not found " +
              i
          });
        }
        if (trxErr.message.startsWith("INVALID_QTY_")) {

          const i = trxErr.message.split("_").pop();
          return res.status(400).json({
            message: "Not enough stock" +
              i
          });
        }
        if (trxErr.message.startsWith("INSUFFICIENT_STOCK_")) {

          const i = trxErr.message.split("_").pop();
          return res.status(400).json({
            message: "Not enough stock" +
              i
          });
        }
      }
      throw trxErr;

    } finally {
      session.endSession();
    }


    return res.status(201).json({
      message: "Order placed",
      orderId: created._id,
      total: created.TotalPrice
    });

  } catch (error) {
    console.error("CreateOrder:", error);
    res.status(500).json({
      message: error.message
    });
  }
}

/**
 * @swagger
 * /api/Orders:
 *   get:
 *     summary: Get user's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
async function GetOrders(req, res) {
  try {

    // const CheckUser = await CheckForUser(req, res);
    // if (!CheckUser) return;
    const UserOrders = await Order.find({
      User: req.user.userId
    })
    res.status(200).json(UserOrders);
  } catch (error) {
    console.error("GetOrders:", error);
    res.status(500).json({
      message: error.message
    });
  }
}

module.exports = {
  CreateOrder,
  GetOrders
}
