const mysql=require('mysql2');
require('dotenv').config();

const pool=mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME,
    waitForConnections:true,
    connectionLimit:10,
})

pool.query('SELECT 1',(err,result)=>{
    if(err){
        console.error('Error connecting to the database:',err);
    }else{
        console.log('Database connection successful');
    }
});
module.exports=pool.promise();