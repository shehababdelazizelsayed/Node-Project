const jwt = require("jsonwebtoken");

// Check Authentication
 const verifyToken =(req,res,next)=> {
    try {
     const authHeader = req.headers.authorization;
      if(!authHeader || !authHeader.startsWith("Bearer ")){
        return res.status(401).json({message:'No Token Provided'});
      }  
      const token = authHeader.split(" ")[1];

      const decoded = jwt.verify(token,process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
       return res.status(403).json({message:'Invalid or expired Token'}) 
    }
}

// Authoraization (Admin or Owner)
 const isAdminOrOwner = (req,res,next)=> {
   const {Role} = req.user;
   
    if(Role ==="Admin" || Role === "Owner"){
        return next()
    }
    return res.status(403).json({message:"Access denied"});
}


module.exports = {verifyToken , isAdminOrOwner}