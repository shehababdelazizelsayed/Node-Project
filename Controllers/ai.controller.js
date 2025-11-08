
const Groq = require("groq-sdk");
const Book = require("../models/Book");

const queryBooksWithAI = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res
        .status(400)
        .json({ success: false, error: "Query is required" });
    }

    const books = await Book.find({}, "Title Author Price Description").lean();
    if (!books?.length) {
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

    return res.json({
      success: true,
      query: query,
      booksAnalyzed: books.length,
      response: aiResponse,
    });
  } catch (err) {
    console.error("AI Error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Unable to process request. Please try again.",
    });
  }
};

module.exports = {
  queryBooksWithAI,
};
