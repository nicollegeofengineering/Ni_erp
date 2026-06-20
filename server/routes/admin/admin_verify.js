const express=require("express");
const VerifyToken=require("../../middleware/verifyToken");
const router=express.Router();

router.get("/admin_verify",VerifyToken,(req,res)=>{
    res.json({status:"success",message:"Token is valid"});
});

module.exports=router;