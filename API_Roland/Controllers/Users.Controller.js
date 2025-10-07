const User = require("../models/User")


const UserLogin=  async (req, res) => {
        try {
        const { Email, Password } = req.body;

        if (!Email || !Password) {
        return res.status(400).json({ message: "Email and Password are required" });
        }

        const FindUser = await User.findOne({ Email });
        if (!FindUser) {
        return res.status(401).json({ message: "Invalid email or password" });
        }

        if (FindUser.Password !== Password) {
        return res.status(401).json({ message: "Invalid email or password" });
        }

        return res.status(200).json({
        message: "Login successful",
        FindUser,
        //   FindUser: {
        //     id: user._id,
        //     Name: user.Name,
        //     Email: user.Email,
        //     Role:User.Role,
        //     IsVerified:User.IsVerified
        //   },
        });
        } catch (error) {
        console.error("Login error:", error);
         return res.status(500).json({ message: error.message });
        }
    };

const UserRegister= async (req, res) => {
  try {
    const { Name, Email, Password , Role} = req.body; 

     if (!Email || !Password|| Name) {
        return res.status(400).json({ message: "Name, Email and Password are required" });
        }

      if (!Role){
        return Role="User"  
      }   

    
    const user = await User.create({ Name, Email, Password , Role}); 

 
    return res.status(201).json({
      message: "User created",
      user: { id: user._id, Name: user.Name, Email: user.Email , Role:User.Role},
    });
  } catch (error) {
    console.error("UserRegister:", error);
    return res.status(500).json({ message: error.message });
  }
};

const UserUpdate=async function updateProfile(req, res) {
  try {

  //  const { Email, Password } = req.body;
   const Email = req.header("UserEmail");
  const Password = req.header("UserPassword");

        if (!Email || !Password) {
        return res.status(400).json({ message: "Email and Password are required" });
        }

        const FindUser = await User.findOne({ Email });
        if (!FindUser) {
        return res.status(401).json({ message: "You most Login first " });
        }

        if (FindUser.Password !== Password) {
        return res.status(401).json({ message: "Invalid  password" });
        }
        // if(FindUser.IsVerified == false ){
        //   return res.status(401).json({ message: "You most Verified First" });
        // }

         const updates = {};
    if (req.body.Name != null) updates.Name = req.body.Name;
    if (req.body.NewEmail != null) updates.Email = req.body.NewEmail;
    if (req.body.NewPassword != null) updates.Password = req.body.NewPassword;
    if(req.body.NewPassword == FindUser.Password){
      return res.status(401).json({ message: "Please Insert New Password " });
    }
    if(req.body == null){
       return res.status(400).json({ message: "No fields to update" });
    }

        const UpdatedUser = await User.findByIdAndUpdate(
      FindUser._id,
      updates,
      
    )
    return res.status(200).json({ message: "Profile updated", User: UpdatedUser });

  } catch (error) {
    console.error("UserUpdate:", error);
    return res.status(500).json({ message: error.message });
  }
}

module.exports ={
UserLogin,
UserRegister,
UserUpdate
}