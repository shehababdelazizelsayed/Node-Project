
const Cart = require("../models/Cart");
const Book = require("../models/Book");
const { CheckForUser } = require("../Helpers/Login.Helper");
async function AddToCart(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

    const { BookId, Qty } = req.body;
    if (!BookId) {
      return res.status(400).json({ message: "BookId is required" });
    }

    const GetBook = await Book.findById(BookId)
    if (!GetBook){ 
      return res.status(404).json({ message: "Book not found" });
   
    }
    let QtyNum;
        if (Qty === undefined || Qty === null) {
        QtyNum = 1;
        } else {
        QtyNum = Number(Qty);
        }
        if(GetBook.Stock < QtyNum) {
          return res.status(405).json({ message: "Out of Stock" });
        }
        let SelectCart = await Cart.findOne({ User: CheckUser._id });
   if (!SelectCart) {
      SelectCart = await Cart.create({
        User: CheckUser._id,
        Items: [{ Book: GetBook._id, Quantity: QtyNum }],
      });

      const Result = await Cart.findById(SelectCart._id)
        .populate({ path: "Items.Book", select: "Title Stock Price Image Category" })
        

      return res.status(201).json({ message: "Added to cart", Cart: Result });
    }

   
    const item = SelectCart.Items.find((Item) => Item.Book.equals(GetBook._id));
    if (item) {
      const newQty = item.Quantity + QtyNum;
      if (newQty > GetBook.Stock) {
        return res.status(405).json({ message: "Out of Stock" });
      }
      item.Quantity = newQty;
    } else {
      if (QtyNum > GetBook.Stock) {
        return res.status(405).json({ message: "Out of Stock" });
      }
      SelectCart.Items.push({ Book: GetBook._id, Quantity: QtyNum });
    }

    await SelectCart.save();

    const Result = await Cart.findById(SelectCart._id)
      .populate({ path: "Items.Book", select: "Title Stock Price Image Category" })
      console.log(Result)
      return res.status(201).json({ message: "Added to cart", Cart: Result });
}catch (error){
 console.error("AddToCart:", error);
    res.status(500).json({ message: error.message });
    }
}

async function GetCart(req,res) {
 try {
     const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;
     let SelectCart = await Cart.findOne({ User: CheckUser._id })
      .populate({ path: "Items.Book", select: "Title Price Stock Image Category" })
    if(!SelectCart){
      return  res.status(404).json({ message: "Cart not Found" });
    }
    return res.status(200).json({message:"Cart is Found ", Cart:SelectCart});
 } catch (error) {
     console.error("GetCart:", error);
    res.status(500).json({ message: error.message });
 }
  
}

async function RemoveFromCart(req, res) {
  try {
    const CheckUser = await CheckForUser(req, res);
    if (!CheckUser) return;

    const { id: BookId } = req.params;

    const SelectCart = await Cart.findOne({ User: CheckUser._id });
    if (!SelectCart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // const CheckItem = SelectCart.Items.length;

  
   const index = SelectCart.Items.findIndex((item) => item.Book.equals(BookId));
    if (index === -1) {
      return res.status(404).json({ message: "Book not found in cart" });
    }



SelectCart.Items.splice(index, 1); 
await SelectCart.save();

  
  

    const Result = await Cart.findById(SelectCart._id)
      .populate({ path: "Items.Book", select: "Title Price Stock Image Category" })
      

    return res.status(200).json({ message: "Removed from cart", Cart: Result });
  } catch (error) {
   
    console.error("RemoveFromCart:", error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports={AddToCart, GetCart ,RemoveFromCart}