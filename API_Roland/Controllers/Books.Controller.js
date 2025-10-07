
const User = require("../models/User");
const Book = require("../models/Book");
async function CheckForAdmin(req, res) {
  const Email = req.header("UserEmail") 
  const Password = req.header("UserPassword")
   if (!Email) {
     res.status(401).json({ message: "Email is required" });
     return null;
  }
    const CheckUser = await User.findOne({ Email: Email });
    console.log(CheckUser)
  if (!CheckUser) {
   res.status(401).json({ message: "Invalid Email" });
    return null;
  }
   if (Password != null && CheckUser.Password !== Password) {
   res.status(401).json({ message: "Invalid password" });
    return null;
  }

  if (CheckUser.Role !== "Admin") {
   res.status(403).json({ message: "Access Denied" });
     return null;
  }
  return CheckUser; 
}
async function AddBook(req, res) {
    try {
          const CheckAdmin = await CheckForAdmin(req, res);
    if (!CheckAdmin) return null;
        const { Title, Author, Price, Description, Stock,Image,Category, Pdf, Reviews} = req.body
        if(!Title || !Author || !Price || !Description || !Category ){
             return res.status(400).json({ message: "Title, Author, Price , Description , Category are required" });
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
      Reviews


    })
    return res.status(201).json({ message: "Book created", Book: CreateBook});
    } catch (error) {
        console.error("addBook:", error);
        return res.status(500).json({ message: error.message });
    }
}


 async function  GetBooks(req,res){
      try {
              const CheckAdmin = await CheckForAdmin(req, res);
    if (!CheckAdmin) return null
    const GatAllBooks = await Book.find({});
    res.status(200).json(GatAllBooks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function UpdateBooks(req ,res) {
      try {
    const CheckAdmin = await CheckForAdmin(req, res);
    if (!CheckAdmin) return null
    const { id } = req.params;
    const GetThisBook = await Book.findById(id);
    
    if(req.body == null){
       return res.status(400).json({ message: "No fields to update" });
    }
    if (!GetThisBook) {
      return res.status(404).json({ message: "Book not found" });
    }

     const allowed = ["Title", "Author", "Price", "Stock", "Category", "Description", "Image", "Pdf", "Reviews"];
    const Update = {};
    for (const key of allowed) {
      if (req.body[key] != null) Update[key] = req.body[key];
    }
    
   
if (Update.Price != null) {
      Update.Price = Number(Update.Price);
      if (Update.Price < 0) return res.status(400).json({ message: "Price must be >= 0" });
    }
    if (Update.Stock != null) {
      Update.Stock = Number(Update.Stock);
      if (Update.Stock < 0) return res.status(400).json({ message: "Stock must be >= 0" });
    }
     const updatedBook = await Book.findByIdAndUpdate(id, Update,{
         new: true, 
     });
     return res.status(200).json({ message: "Book updated", Book: updatedBook });

    
  } catch (error) {
    console.error("UpdateBook", error);
    res.status(500).json({ message: error.message });
  }
} 
async function DeleteBook(req, res) {
  try {
    const admin = await CheckForAdmin(req, res);
    if (!admin) return null;

    const { id } = req.params;


    const Deleted = await Book.findByIdAndDelete(id)
    if (!Deleted) {
      return res.status(404).json({ message: "Book not found" });
    }

    return res.status(200).json({ message: "Book deleted", Book: Deleted });
  } catch (error) {
    console.error("DeleteBook:", error);
    res.status(500).json({ message: error.message });
  }
}

module.exports = {AddBook ,GetBooks , UpdateBooks ,DeleteBook}