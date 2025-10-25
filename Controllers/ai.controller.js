/**
 * @swagger
 * /api/ai:
 *   post:
 *     summary: Query books using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: The query to ask about books
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 booksAnalyzed:
 *                   type: integer
 *                 response:
 *                   type: string
 *       400:
 *         description: Query is required
 *       404:
 *         description: No books found
 *       500:
 *         description: Internal server error
 */

const Groq = require("groq-sdk");
const Book = require("../models/Book");
const logger = require("../utils/logger"); 

const queryBooksWithAI = async (req, res) => {
  try {
    const { query } = req.body;

    logger.info(`AI query received: ${query || "No query provided"}`); 

    if (!query) {
      logger.warn("Query missing in AI request"); 
      return res
        .status(400)
        .json({ success: false, error: "Query is required" });
    }

    const books = await Book.find({}, "Title Author Price Description").lean();
    if (!books?.length) {
      logger.warn("No books found in database for AI query"); 
      return res.status(404).json({ success: false, error: "No books found" });
    }

    const groq = new Groq({ apiKey: process.env.AI });
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable book assistant. Analyze the provided book data and answer questions accurately and concisely. 

Guidelines:
- Give direct, specific answers with relevant details
- Reference book titles and authors when applicable
- Keep responses focused and well-organized
- Use bullet points only when comparing multiple books
- Provide prices when relevant to the query
- When referring to the book collection, use "store" instead of "database"
- Don't Give recommendation on another store or platform`,
        },
        {
          role: "user",
          content: `Available Books:\n${JSON.stringify(
            books,
            null,
            2
          )}\n\nUser Question: ${query}\n\nProvide a clear and helpful answer based on the book data above.`,
        },
      ],
      max_tokens: 500,
    });

    const aiResponse = response.choices[0].message.content;

    logger.info(`AI response generated successfully for query: "${query}"`); // ✅ info log

    return res.json({
      success: true,
      query: query,
      booksAnalyzed: books.length,
      response: aiResponse,
    });
  } catch (err) {
    logger.error(`AI Error: ${err.message}`, { stack: err.stack }); // ✅ error log
    return res.status(500).json({
      success: false,
      error: "Unable to process request. Please try again.",
    });
  }
};

module.exports = {
  queryBooksWithAI,
};
