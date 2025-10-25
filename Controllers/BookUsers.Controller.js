/**
 * @swagger
 * components:
 *   schemas:
 *     BookUser:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         Title:
 *           type: string
 *         Author:
 *           type: string
 *         Price:
 *           type: number
 *         Description:
 *           type: string
 *         Stock:
 *           type: integer
 *         Image:
 *           type: string
 *         Category:
 *           type: string
 *         Pdf:
 *           type: string
 *         Owner:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const User = require("../models/User");
const Books = require("../models/Book");
const checkUser = require("../Helpers/Login.Helper");
const Joi = require('joi');
const logger = require("../utils/logger");

/**
 * @swagger
 * /api/BookUsers:
 *   get:
 *     summary: Get all books for users with pagination
 *     tags: [BookUsers]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of books per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Books retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/BookUser'
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */


async function getAllBookUsers(req, res) {
  try {
    const schema = Joi.object({
      limit: Joi.number().integer().min(1).max(100).default(10),
      page: Joi.number().integer().min(1).default(1),
    }).unknown(false);

    const { error, value } = schema.validate(req.query, { stripUnknown: true });
    if (error) {
      logger.warn(`Validation error in getAllBookUsers: ${error.details.map(d => d.message).join(", ")}`);
      return res.status(400).json({
        message: 'Validation error',
        errors: error.details.map(d => d.message.replace(/"/g, ''))
      });
    }

    const query = value;
    const limit = query.limit;
    const page = query.page;
    const skip = (page - 1) * limit;

    logger.info(`Fetching books for users | page=${page}, limit=${limit}`);

    const GetBooks = await Books.find().skip(skip).limit(limit);

    logger.info(`Books retrieved successfully | count=${GetBooks.length}`);

    console.log(Books);
    console.log(GetBooks);

    res.status(200).json(GetBooks);
  } catch (error) {
    logger.error(`getAllBookUsers Error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      message: error.message
    });
  }
}

module.exports = {
  getAllBookUsers
};
