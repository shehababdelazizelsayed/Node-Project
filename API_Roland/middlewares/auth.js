const jwt = require("jsonwebtoken")

const verifyToken = (req,res,next)=> {
  try {
   const authHeader = req.headers.authorization; 
   if(!authHeader || !authHeader.startsWith("Bearer ")){
    return res.status(401).json({message:"No Token Provided"})
   }
   const token = authHeader.split(" ")[1];
   const decoded = jwt.verify(token,process.env.JWT_SECRET);
   req.user = decoded;
   next();
  } catch (error) {
    if(error.name === "TokenExpiredError"){
 return res.status(401).json({ message: "Token has expired" });
    }
    return res.status(403).json({ message: "Invalid token" });
  }
}

// Roles
const authorizeRoles = (...allowedRoles) => {
  return(req,res,next) => {
    if(!req.user || !allowedRoles.includes(req.user.Role)){
      return res.status(403).json({ message: "Access denied" });
    }
    next()
  }
}

module.exports = { verifyToken, authorizeRoles };
