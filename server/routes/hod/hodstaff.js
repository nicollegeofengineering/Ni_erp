const express = require("express");
const router = express.Router();

const Staff = require("../../models/Staff");
const User = require("../../models/User");

router.get("/hoddep", async (req, res) => {
    try {
        // JWT contains "id", not "_id"
        const userId = req.user?.id;

        

        if (!userId) {
            return res.status(401).json({
                message: "Unauthorized"
            });
        }

        // Find logged-in user
        const user = await User.findById(userId)
            .select("username email role")
            .lean();

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        console.log("User:", user);

        // Find corresponding HOD staff
        const staff = await Staff.findOne({
            $or: [
                { staff_id: user.username },
                { email: user.email }
            ],
            role_type: { $in: ["Hod", "HOD"] }
        })
            .select("department_code staff_id email")
            .lean();

        

        if (!staff) {
            return res.status(404).json({
                message: "HOD staff record not found"
            });
        }

        return res.status(200).json({
            department_code: staff.department_code
        });

    } catch (error) {
        console.error("Error fetching HOD department:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

module.exports = router;