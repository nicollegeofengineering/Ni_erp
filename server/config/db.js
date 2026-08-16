const mongoose = require("mongoose");
require('dotenv').config();
let cached = global._mongoose;

if (!cached) {
    cached = global._mongoose = {
        conn: null,
        promise: null
    };
}

async function connectDB() {
    // Already connected
    if (cached.conn) {
        return cached.conn;
    }

    // Connection not started yet
    if (!cached.promise) {
        mongoose.set("bufferCommands", false);

        cached.promise = mongoose
            .connect(process.env.MONGO_URI, {
                dbName:process.env.MONGO_DB
            })
            .then((m) => {
                console.log(`Connected to MongoDB - database: ${process.env.MONGO_DB}`);
                return m;
            });
    }

    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null;

        console.error(
            "MongoDB connection failed:",
            err.message
        );

        throw err;
    }

    return cached.conn;
}

module.exports = connectDB;