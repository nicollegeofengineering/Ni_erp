const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const connectDB = require('../../config/db');
const User = require('../../models/User');
const Staff = require('../../models/Staff');
const Student = require('../../models/Student');

// ============================================================================
// GET /api/user/profile
// Universal profile endpoint for Admin, HOD, Staff, and Student
// ============================================================================
router.get('/profile', async (req, res) => {
  try {
    await connectDB();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await User.findById(userId).select('-password').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found' });
    }

    const role = (user.role || '').toString();
    const normalizedRole = role.toLowerCase();

    // 1. Admin Profile
    if (normalizedRole === 'admin') {
      const isObjectId = mongoose.Types.ObjectId.isValid(user.username);
      const emailRegex = user.email ? new RegExp(`^${user.email.trim()}$`, 'i') : null;
      const usernameRegex = user.username ? new RegExp(`^${user.username.trim()}$`, 'i') : null;

      const staff = await Staff.findOne({
        $or: [
          ...(emailRegex ? [{ email: emailRegex }, { personal_email: emailRegex }] : []),
          ...(usernameRegex ? [{ staff_id: usernameRegex }, { staff_code: usernameRegex }, { email: usernameRegex }] : []),
          { staff_id: user.username },
          { email: user.email },
          ...(isObjectId ? [{ _id: user.username }] : []),
        ],
      }).lean();

      const photoUrl = staff && staff.photo_file_id
        ? `/api/admin/staff/${staff.staff_id}/photo?v=${staff.photo_version || 0}`
        : staff?.photo_url || user.profile_image || '/user.png';

      const fullName = staff
        ? `${staff.prefix ? staff.prefix + ' ' : ''}${staff.first_name} ${staff.last_name || ''}`.trim()
        : user.name || 'Administrator';

      return res.status(200).json({
        success: true,
        role: 'Admin',
        data: {
          ...(staff || {}),
          _id: user._id,
          name: fullName,
          username: user.email || user.username,
          login_id: user.email || user.username,
          staff_id: staff?.staff_id || user.username,
          email: staff?.email || user.email,
          role: 'Admin',
          profile_image: photoUrl,
          isActive: user.isActive,
          createdAt: staff?.createdAt || user.createdAt,
          updatedAt: staff?.updatedAt || user.updatedAt,
          user_account: {
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          },
        },
      });
    }

    // 2. HOD or Staff Profile
    if (normalizedRole === 'staff' || normalizedRole === 'hod') {
      const isObjectId = mongoose.Types.ObjectId.isValid(user.username);
      const emailRegex = user.email ? new RegExp(`^${user.email.trim()}$`, 'i') : null;
      const usernameRegex = user.username ? new RegExp(`^${user.username.trim()}$`, 'i') : null;

      const staff = await Staff.findOne({
        $or: [
          ...(emailRegex ? [{ email: emailRegex }, { personal_email: emailRegex }] : []),
          ...(usernameRegex ? [{ staff_id: usernameRegex }, { staff_code: usernameRegex }, { email: usernameRegex }] : []),
          { staff_id: user.username },
          { email: user.email },
          { phone_number: user.username },
          ...(isObjectId ? [{ _id: user.username }] : []),
        ],
      }).lean();

      if (!staff) {
        // Fallback to basic user profile if staff record is not yet linked
        return res.status(200).json({
          success: true,
          role: user.role,
          data: {
            _id: user._id,
            name: user.name,
            username: user.email || user.username,
            login_id: user.email || user.username,
            staff_id: user.username,
            email: user.email,
            role: user.role,
            designation: user.role,
            department_code: 'General',
            profile_image: user.profile_image || '/user.png',
            createdAt: user.createdAt,
          },
        });
      }

      const photoUrl = staff.photo_file_id
        ? `/api/admin/staff/${staff.staff_id}/photo?v=${staff.photo_version || 0}`
        : staff.photo_url || user.profile_image || '/user.png';

      const fullName = `${staff.prefix ? staff.prefix + ' ' : ''}${staff.first_name} ${staff.last_name || ''}`.trim();

      return res.status(200).json({
        success: true,
        role: staff.role_type || user.role,
        data: {
          ...staff,
          name: fullName,
          username: user.email || user.username,
          login_id: user.email || user.username,
          staff_id: staff.staff_id,
          email: staff.email || user.email,
          profile_image: photoUrl,
          user_account: {
            username: user.username,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          },
        },
      });
    }

    // 3. Student Profile
    if (normalizedRole === 'student') {
      const isObjectId = mongoose.Types.ObjectId.isValid(user.username);
      const student = await Student.findOne({
        $or: [
          { student_id: user.username },
          { register_no: user.username },
          { roll_no: user.username },
          { email: user.email },
          ...(isObjectId ? [{ _id: user.username }] : []),
        ],
      }).lean();

      if (!student) {
        return res.status(200).json({
          success: true,
          role: 'Student',
          data: {
            _id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            role: 'Student',
            profile_image: user.profile_image || '/user.png',
          },
        });
      }

      const photoUrl = student.photo_file_id
        ? `/api/admin/student/${student.student_id}/photo?v=${student.photo_version || 0}`
        : student.profile_image || user.profile_image || '/user.png';

      const fullName = `${student.first_name} ${student.last_name || ''}`.trim();

      return res.status(200).json({
        success: true,
        role: 'Student',
        data: {
          ...student,
          name: fullName,
          email: student.email || user.email,
          profile_image: photoUrl,
        },
      });
    }

    // Fallback for any other roles (e.g. Accountant)
    return res.status(200).json({
      success: true,
      role: user.role,
      data: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        profile_image: user.profile_image || '/user.png',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/user/profile:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
