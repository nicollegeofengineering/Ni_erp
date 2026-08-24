const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const Announcement = require('../../models/Announcement');
const User = require('../../models/User');
const Staff = require('../../models/Staff');
const Student = require('../../models/Student');

// Helper to resolve user details, role, and department code
async function getUserDetails(req) {
  if (!req.user || !req.user.id) return null;
  const user = await User.findById(req.user.id).lean();
  if (!user) return null;

  const role = (user.role || req.user.role || 'Student').trim();
  let department = null;
  let fullName = user.name || user.username;

  if (role.toLowerCase() === 'admin') {
    department = null;
  } else if (role.toLowerCase() === 'hod' || role.toLowerCase() === 'staff') {
    const staffDoc = await Staff.findOne({ staff_id: user.username }).lean();
    if (staffDoc) {
      department = (staffDoc.department_code || staffDoc.department || '').toUpperCase();
      if (staffDoc.first_name || staffDoc.last_name) {
        fullName = `${staffDoc.prefix || ''} ${staffDoc.first_name || ''} ${staffDoc.last_name || ''}`.trim();
      }
    }
  } else if (role.toLowerCase() === 'student') {
    const studentDoc = await Student.findOne({
      $or: [
        { register_no: user.username },
        { roll_no: user.username },
        { email: user.email },
      ],
    }).lean();
    if (studentDoc) {
      department = (studentDoc.department_code || studentDoc.department || '').toUpperCase();
      fullName = studentDoc.name || fullName;
    }
  }

  return {
    userId: user._id,
    username: user.username,
    fullName,
    role,
    department,
  };
}

// ============================================================================
// 1. PUBLIC ENDPOINT (For College Website / Mobile app)
// ============================================================================
router.get('/public', async (req, res) => {
  try {
    await connectDB();
    const limit = parseInt(req.query.limit) || 20;

    const announcements = await Announcement.find({
      type: 'college',
      isActive: true,
    })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: announcements.length,
      data: announcements,
    });
  } catch (error) {
    console.error('Error fetching public announcements:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. AUTHENTICATED LIST ENDPOINT (Admin, HOD, Staff, Student)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const userInfo = await getUserDetails(req);
    if (!userInfo) {
      return res.status(401).json({ success: false, message: 'Unauthorized', islogout: true });
    }

    const { role, department } = userInfo;
    const requestedDept = req.query.department ? req.query.department.toUpperCase() : null;

    // College Announcements (Universal to everyone)
    const collegeQuery = { type: 'college', isActive: true };
    const collegeAnnouncements = await Announcement.find(collegeQuery)
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    // Department Announcements
    let deptQuery = { type: 'department', isActive: true };

    if (role.toLowerCase() === 'admin') {
      if (requestedDept) {
        deptQuery.department = requestedDept;
      }
      // If admin and no requestedDept, fetch all department announcements
    } else {
      // HOD, Staff, Student: strictly their own department
      deptQuery.department = department || requestedDept;
    }

    const departmentAnnouncements = await Announcement.find(deptQuery)
      .sort({ pinned: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        college: collegeAnnouncements,
        department: departmentAnnouncements,
        userRole: role,
        userDepartment: department,
      },
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 3. CREATE ANNOUNCEMENT (Admin for College/Dept; HOD for Dept)
// ============================================================================
router.post('/', async (req, res) => {
  try {
    await connectDB();
    const userInfo = await getUserDetails(req);
    if (!userInfo) {
      return res.status(401).json({ success: false, message: 'Unauthorized', islogout: true });
    }

    const { title, content, type = 'college', department, priority = 'normal', pinned = false } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    const role = userInfo.role.toLowerCase();

    // Permissions check
    if (type === 'college') {
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only Administrators can create College Announcements.',
        });
      }
    } else if (type === 'department') {
      if (role !== 'admin' && role !== 'hod' && role !== 'hods') {
        return res.status(403).json({
          success: false,
          message: 'Only HODs and Administrators can create Department Announcements.',
        });
      }

      if (role !== 'admin') {
        // HOD must post to their own department
        if (!userInfo.department) {
          return res.status(400).json({ success: false, message: 'HOD department not found' });
        }
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid announcement type' });
    }

    const targetDept = type === 'department' ? (role === 'admin' ? (department || '').toUpperCase() : userInfo.department) : null;

    if (type === 'department' && !targetDept) {
      return res.status(400).json({ success: false, message: 'Department is required for department announcements' });
    }

    const newAnnouncement = new Announcement({
      title: title.trim(),
      content: content.trim(),
      type,
      department: targetDept,
      priority,
      pinned: Boolean(pinned),
      author: userInfo.userId,
      authorName: userInfo.fullName,
      authorRole: userInfo.role,
      isActive: true,
    });

    await newAnnouncement.save();

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: newAnnouncement,
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. UPDATE ANNOUNCEMENT
// ============================================================================
router.put('/:id', async (req, res) => {
  try {
    await connectDB();
    const userInfo = await getUserDetails(req);
    if (!userInfo) {
      return res.status(401).json({ success: false, message: 'Unauthorized', islogout: true });
    }

    const { id } = req.params;
    const { title, content, priority, pinned, isActive, department } = req.body;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const role = userInfo.role.toLowerCase();

    // Check permissions
    if (announcement.type === 'college') {
      if (role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only Admin can edit College Announcements' });
      }
    } else if (announcement.type === 'department') {
      if (role !== 'admin') {
        if (role !== 'hod' && role !== 'hods') {
          return res.status(403).json({ success: false, message: 'Only HODs can edit Department Announcements' });
        }
        if (announcement.department !== userInfo.department) {
          return res.status(403).json({ success: false, message: 'You can only edit announcements for your own department' });
        }
      }
    }

    if (title !== undefined) announcement.title = title.trim();
    if (content !== undefined) announcement.content = content.trim();
    if (priority !== undefined) announcement.priority = priority;
    if (pinned !== undefined) announcement.pinned = Boolean(pinned);
    if (isActive !== undefined) announcement.isActive = Boolean(isActive);
    if (department !== undefined && role === 'admin' && announcement.type === 'department') {
      announcement.department = department.toUpperCase();
    }

    await announcement.save();

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement,
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. DELETE ANNOUNCEMENT
// ============================================================================
router.delete('/:id', async (req, res) => {
  try {
    await connectDB();
    const userInfo = await getUserDetails(req);
    if (!userInfo) {
      return res.status(401).json({ success: false, message: 'Unauthorized', islogout: true });
    }

    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const role = userInfo.role.toLowerCase();

    // Check permissions
    if (announcement.type === 'college') {
      if (role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only Admin can delete College Announcements' });
      }
    } else if (announcement.type === 'department') {
      if (role !== 'admin') {
        if (role !== 'hod' && role !== 'hods') {
          return res.status(403).json({ success: false, message: 'Only HODs can delete Department Announcements' });
        }
        if (announcement.department !== userInfo.department) {
          return res.status(403).json({ success: false, message: 'You can only delete announcements for your own department' });
        }
      }
    }

    await Announcement.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
