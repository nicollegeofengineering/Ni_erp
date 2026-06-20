const express=require('express');
const app=express();
const cors=require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const db=require('./config/db');

require("./sessions/cleanupSessions");

//----------------Routes
const loginRoute=require('./routes/auth/login');
const adminVerifyRoute=require('./routes/admin/admin_verify');


//----------------
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));
//-----------------

//-----------------
app.use('/auth',loginRoute);
app.use('/api',adminVerifyRoute);



//-----------------
app.get('/',(req,res)=>{
    res.send("Server is running....");
});
//-----------------

//-----------------
const port=process.env.PORT || 5000;
app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
})