const User = require("../models/User");
const Books = require("../models/Book");
const checkUser = require("../Helpers/Login.Helper");





async function getAllBookUsers(req, res) {



  try {

    const query = req.query;
    const limit = parseInt(query.limit) || 10;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;



    // const UserEmail = await checkUser(req, res);
    // if (!UserEmail) {
    //   return res.status(401).json({
    //     message: "please log in first !!"
    //   });
    // }
    const GetBooks = await Books.find().skip(skip).limit(limit);
    console.log(Books);
    console.log(GetBooks);
    res.status(200).json(GetBooks);
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
}


module.exports = {
  getAllBookUsers
};
