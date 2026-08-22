const express = require('express');
const connectDB = require('../config/db');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Returns statistics:
 * - totalStudents
 * - activeStaff
 * - attendancePercentage (first period, today)
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // Only allow Admin role
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await connectDB();

    // 1. Total Students
    const totalStudents = await Student.countDocuments();

    // 2. Active Staff
    const activeStaff = await Staff.countDocuments({ staff_status: 'Active' });

    // 3. Attendance percentage for today – first period (period = 1)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Aggregate to count all "Present" students across all classes for period 1 today
    const presentResult = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: today, $lt: tomorrow },
          period: 1,
        },
      },
      { $unwind: '$students' },                       // flatten students array
      { $match: { 'students.status': 'Present' } },   // only present entries
      { $count: 'totalPresent' },                     // count them
    ]);

    const presentToday = presentResult.length ? presentResult[0].totalPresent : 0;

    const attendancePercentage = totalStudents > 0
      ? Math.round((presentToday / totalStudents) * 100)
      : 0;

    const stats = {
      totalStudents,
      activeStaff,
      attendancePercentage,
    };

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;