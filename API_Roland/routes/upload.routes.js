const express = require("express");
const router = express.Router();
const upload = require("../Helpers/upload");

// upload image 
router.post("/upload",upload.single("image"), (req,res)=> {
    if(!req.file){
        return res.status(400).json({message:"No file uploaded!"})
    }
    res.status(200).json({
        message:"Image uploaded successfully",
        url:req.file.path,// link image in cloudinary
    });

})

module.exports = router;