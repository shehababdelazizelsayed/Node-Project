const Book = require("../models/Book");


// Add
async function AddBook(req, res) {
  try {

    const {
      Title,
      Author,
      Price,
      Description,
      Stock,
      Image,
      Category,
      Pdf,
    } = req.body;


    if (!Title || !Author || !Price || !Description || !Category) {
      return res.status(400).json({
        message: "Title, Author, Price , Description , Category are required",
      });
    }


    if (Number(Price) < 0) {
      return res.status(400).json({ message: "Price must be >= 0" });
    }

    if (Number(Stock) < 0) {
      return res.status(400).json({ message: "Stock must be >= 0" });
    }


    const CreateBook = await Book.create({
      Title,
      Author,
      Price,
      Stock,
      Category,
      Description,
      Image,
      Pdf,
      Owner: req.user.userId
    });

    return res.status(201).json({ message: "Book created successfully", Book: CreateBook });

  } catch (error) {
    console.error("addBook:", error);
    return res.status(500).json({ message: error.message });
  }
};


// Update
async function UpdateBooks(req, res) {
  try {

    const { id } = req.params;
    const GetThisBook = await Book.findById(id);

    if (req.body == null) {
      return res.status(400).json({ message: "No fields to update" });
    }

    if (!GetThisBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (req.user.Role !== "Admin" && CreateBook.Owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: "You are not allowed to edit this book" });
    }

    const allowed = [
      "Title",
      "Author",
      "Price",
      "Stock",
      "Category",
      "Description",
      "Image",
      "Pdf",
    ];

    const Update = {};
    for (const key of allowed) {
      if (req.body[key] != null) Update[key] = req.body[key];
    }

    if (Update.Price != null) {
      Update.Price = Number(Update.Price);
      if (Update.Price < 0)
        return res.status(400).json({ message: "Price must be >= 0" });
    }

    if (Update.Stock != null) {
      Update.Stock = Number(Update.Stock);
      if (Update.Stock < 0)
        return res.status(400).json({ message: "Stock must be >= 0" });
    }

    const updatedBook = await Book.findByIdAndUpdate(id, Update, {
      new: true,
    });

    return res.status(200).json({ message: "Book updated successfully", Book: updatedBook });

  } catch (error) {
    console.error("UpdateBook", error);
    res.status(500).json({ message: error.message });
  }
}


// Delete
async function DeleteBook(req, res) {
  try {

    const { id } = req.params;
    const Deleted = await Book.findByIdAndDelete(id);

    if (!Deleted) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (req.user.Role !== "Admin" && CreateBook.Owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: "You are not allowed to delete this book" });
    }

    return res.status(200).json({ message: "Book deleted successfully", Book: Deleted });

  } catch (error) {
    console.error("DeleteBook:", error);
    res.status(500).json({ message: error.message });
  }
}


// Get
async function GetBooks(res) {
  try {
    const books = await Book.find();
    return res.status(200).json({
      message: "Books retrieved successfully",
      books: books,
    });
  } catch (error) {
    console.error("GetBooks:", error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports = { AddBook, GetBooks, UpdateBooks, DeleteBook };
