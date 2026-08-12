const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        username: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        role: {
            type: String,
            enum: ["Staff","Admin","Hod","Student","Accountant"],
            required: true
        },

        profile_image: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);


// Hash password before saving
UserSchema.pre("save", async function () {

    // Don't hash if password hasn't changed
    if (!this.isModified("password")) {
        return;
    }

    const salt = await bcrypt.genSalt(10);

    this.password = await bcrypt.hash(
        this.password,
        salt
    );
});


// Compare password during login
UserSchema.methods.comparePassword = async function (candidatePassword) {

    return bcrypt.compare(
        candidatePassword,
        this.password
    );

};


module.exports = mongoose.model("User", UserSchema);