const Order = require("../models/Order")
const { CheckForUser } = require("../Helpers/Login.Helper");
const Book = require("../models/Book");
const Cart = require("../models/Cart");

async function CreateOrder(req,res) {
    try {
         const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
    // const CheckCart = await Cart.findOne({ CheckUser: User._id });
    // if (!CheckCart) {
    //   return res.status(400).json({ message: "Cart is empty" });

    // }
    const body = req.body;
    if (!body || !Array.isArray(body.Books) || body.Books.length === 0) {
      return res.status(400).json({ message: "Books array is required" });
    }
    let totalPrice = 0;
    for (let i = 0; i < body.Books.length; i++) {
      const item = body.Books[i];

      if (!item || !item.BookId ) {
        return res.status(400).json({ message: "Book not BookId is required at index " + i });
      }

      const book = await Book.findById(item.BookId);
      if (!book) {
        return res.status(404).json({ message: "Book not found " + i });
      }

      if (book.Stock == null || book.Stock < item.Quantity) {
        return res.status(400).json({ message: "Not enough stock" + i });
      }

   

    book.Stock = book.Stock - Number(item.Quantity); 
    await book.save();

      totalPrice = totalPrice + (Number(book.Price) * Number(item.Quantity));
    }

    const created = await Order.create({
      User: CheckUser._id,
      Books: body.Books.map(Item => ({ BookId: Item.BookId, Quantity: Number(Item.Quantity) })),
      TotalPrice: Number(totalPrice.toFixed(2)),
      Status: "pending"
    });

    return res.status(201).json({
      message: "Order placed",
      orderId: created._id,
      total: created.TotalPrice
    });
  } catch (error) {
   console.error("CreateOrder:", error);
    res.status(500).json({ message: error.message });
    }
}
 async function  GetOrders(req,res){
      try {
              
     const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
    const UserOrders = await Order.find({ User: CheckUser._id })
    res.status(200).json(UserOrders);
  } catch (error) {
   console.error("GetOrders:", error);
    res.status(500).json({ message: error.message });
    }
}

module.exports={CreateOrder , GetOrders}