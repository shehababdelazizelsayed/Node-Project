const express = require("express");
const router = express.Router();
const { authMiddleware, authorizeRoles } = require("../Helpers/auth.middleware");
const upload = require("../Helpers/upload");
const {
  SubmitPendingBook,
  GetPendingBooks,
  ApprovePendingBook,
  RejectPendingBook,
  GetUserPendingBooks,
} = require("../Controllers/PendingBooks.Controller");

/**
 * @swagger
 * /api/pending-books:
 *   post:
 *     summary: Submit a book for admin approval
 *     tags: [Pending Books]
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
 *         description: Book submitted for approval successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 PendingBook:
 *                   $ref: '#/components/schemas/PendingBook'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]),
  SubmitPendingBook
);

/**
 * @swagger
 * /api/pending-books/admin:
 *   get:
 *     summary: Get all pending books (Admin only)
 *     tags: [Pending Books]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending books retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 pendingBooks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PendingBook'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/admin", authMiddleware, authorizeRoles("Admin"), GetPendingBooks);

/**
 * @swagger
 * /api/pending-books/{id}/approve:
 *   patch:
 *     summary: Approve a pending book (Admin only)
 *     tags: [Pending Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pending book ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminComment:
 *                 type: string
 *                 description: Optional admin comment
 *     responses:
 *       200:
 *         description: Book approved successfully
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
 *         description: Validation error or book already reviewed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pending book not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/approve",
  authMiddleware,
  authorizeRoles("Admin"),
  ApprovePendingBook
);

/**
 * @swagger
 * /api/pending-books/{id}/reject:
 *   patch:
 *     summary: Reject a pending book (Admin only)
 *     tags: [Pending Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Pending book ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adminComment
 *             properties:
 *               adminComment:
 *                 type: string
 *                 description: Admin comment explaining rejection
 *     responses:
 *       200:
 *         description: Book rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or book already reviewed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pending book not found
 *       500:
 *         description: Internal server error
 */
router.patch(
  "/:id/reject",
  authMiddleware,
  authorizeRoles("Admin"),
  RejectPendingBook
);

/**
 * @swagger
 * /api/pending-books/user:
 *   get:
 *     summary: Get user's pending books
 *     tags: [Pending Books]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User pending books retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 pendingBooks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PendingBook'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/user", authMiddleware, GetUserPendingBooks);

module.exports = router;
