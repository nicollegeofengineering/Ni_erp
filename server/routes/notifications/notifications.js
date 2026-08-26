const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const verifyToken = require('../../middleware/verifyToken');
const { webpush, VAPID_PUBLIC_KEY } = require('../../config/webPush');
const PushSubscription = require('../../models/PushSubscription');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const Student = require('../../models/Student');
const Staff = require('../../models/Staff');

// Helper to resolve student / staff department for user
async function resolveUserDepartment(userId, role) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return { department: 'ALL', year: null, semester: null };

    const normRole = String(role || user.role || '').trim().toLowerCase();

    if (normRole === 'student') {
      const reg = (user.username || user.email || '').trim();
      const student = await Student.findOne({
        $or: [
          { register_no: new RegExp(`^${reg}$`, 'i') },
          { student_id: new RegExp(`^${reg}$`, 'i') },
          { roll_no: new RegExp(`^${reg}$`, 'i') },
          { email: new RegExp(`^${user.email || reg}$`, 'i') },
        ],
      }).lean();

      if (student) {
        return {
          department: (student.department_code || student.department || '').trim().toUpperCase() || 'ALL',
          year: student.year || null,
          semester: student.semester || null,
        };
      }
    } else if (['staff', 'hod', 'hods'].includes(normRole)) {
      const staff = await Staff.findOne({
        $or: [
          { email: new RegExp(`^${user.email}$`, 'i') },
          { staff_id: new RegExp(`^${user.username}$`, 'i') },
        ],
      }).lean();

      if (staff) {
        return {
          department: (staff.department_code || staff.department || '').trim().toUpperCase() || 'ALL',
          year: null,
          semester: null,
        };
      }
    }
    return { department: 'ALL', year: null, semester: null };
  } catch (err) {
    console.error('Error resolving user department:', err);
    return { department: 'ALL', year: null, semester: null };
  }
}

// Helper: send push notification safely to a list of subscriptions
async function sendPushToSubscriptions(subscriptions, payload) {
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let successCount = 0;

  const sendPromises = subscriptions.map(async (subDoc) => {
    try {
      await webpush.sendNotification(subDoc.subscription, payloadStr);
      successCount++;
    } catch (err) {
      // 404 Not Found or 410 Gone means the subscription has expired or unsubscribed
      if (err.statusCode === 404 || err.statusCode === 410) {
        try {
          await PushSubscription.deleteOne({ _id: subDoc._id });
        } catch (delErr) {
          // ignore cleanup errors
        }
      } else {
        console.warn('Web push delivery error for sub:', subDoc._id, err.message);
      }
    }
  });

  await Promise.allSettled(sendPromises);
  return successCount;
}

// ============================================================================
// 1. GET /api/notifications/vapid-public-key
// ============================================================================
router.get('/vapid-public-key', (req, res) => {
  return res.status(200).json({
    success: true,
    publicKey: VAPID_PUBLIC_KEY,
  });
});

// ============================================================================
// 2. POST /api/notifications/subscribe
// ============================================================================
router.post('/subscribe', verifyToken, async (req, res) => {
  try {
    const { subscription, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: 'Valid push subscription object with endpoint and keys is required.',
      });
    }

    await connectDB();
    const role = req.user.role || 'Student';
    const deptInfo = await resolveUserDepartment(req.user.id, role);

    // Upsert subscription
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      {
        userId: req.user.id,
        role,
        department: deptInfo.department,
        year: deptInfo.year,
        semester: deptInfo.semester,
        subscription,
        userAgent: userAgent || '',
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Successfully subscribed to Web Push Notifications.',
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 3. POST /api/notifications/unsubscribe
// ============================================================================
router.post('/unsubscribe', verifyToken, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await connectDB();

    if (endpoint) {
      await PushSubscription.deleteOne({ 'subscription.endpoint': endpoint });
    } else {
      await PushSubscription.deleteMany({ userId: req.user.id });
    }

    return res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from Web Push Notifications.',
    });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. GET /api/notifications/my-notifications
// ============================================================================
router.get('/my-notifications', verifyToken, async (req, res) => {
  try {
    await connectDB();
    const userId = req.user.id;
    const role = req.user.role || 'Student';
    const deptInfo = await resolveUserDepartment(userId, role);

    const isUserAdmin = String(role).toLowerCase() === 'admin';
    const userDept = (deptInfo.department || 'ALL').trim().toUpperCase();

    const query = {
      clearedBy: { $ne: userId },
      $or: [
        { recipient: userId },
        {
          recipient: null,
          role: { $in: ['All', 'ALL', 'all', role] },
          ...(isUserAdmin ? {} : { department: { $in: ['ALL', userDept] } }),
        },
      ],
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const formattedList = notifications.map((n) => {
      const isRead = n.recipient
        ? n.isRead
        : Array.isArray(n.readBy) && n.readBy.some((id) => String(id) === String(userId));

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        link: n.link,
        department: n.department,
        senderName: n.senderName || 'NICETECH Admin',
        createdAt: n.createdAt,
        isRead,
      };
    });

    const unreadCount = formattedList.filter((n) => !n.isRead).length;

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications: formattedList,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. PUT /api/notifications/mark-read
// ============================================================================
router.put('/mark-read', verifyToken, async (req, res) => {
  try {
    const { notificationId, markAll } = req.body;
    await connectDB();
    const userId = req.user.id;

    if (markAll) {
      // Mark all direct notifications
      await Notification.updateMany({ recipient: userId, isRead: false }, { $set: { isRead: true } });
      // Mark all broadcast notifications
      await Notification.updateMany(
        { recipient: null, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );
      return res.status(200).json({ success: true, message: 'All notifications marked as read.' });
    }

    if (notificationId) {
      const notif = await Notification.findById(notificationId);
      if (notif) {
        if (notif.recipient && String(notif.recipient) === String(userId)) {
          notif.isRead = true;
          await notif.save();
        } else if (!notif.recipient) {
          await Notification.updateOne(
            { _id: notificationId },
            { $addToSet: { readBy: userId } }
          );
        }
      }
    }

    return res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5B. PUT /api/notifications/clear (Clear single or all notifications for user)
// ============================================================================
router.put('/clear', verifyToken, async (req, res) => {
  try {
    const { notificationId, clearAll } = req.body;
    await connectDB();
    const userId = req.user.id;
    const role = req.user.role || 'Student';
    const deptInfo = await resolveUserDepartment(userId, role);

    if (clearAll) {
      // 1. Delete direct notifications
      await Notification.deleteMany({ recipient: userId });

      // 2. Add userId to clearedBy for broadcast notifications matching user
      const isUserAdmin = String(role).toLowerCase() === 'admin';
      const userDept = (deptInfo.department || 'ALL').trim().toUpperCase();

      const broadcastFilter = {
        recipient: null,
        role: { $in: ['All', 'ALL', 'all', role] },
        ...(isUserAdmin ? {} : { department: { $in: ['ALL', userDept] } }),
      };

      await Notification.updateMany(
        broadcastFilter,
        { $addToSet: { clearedBy: userId } }
      );

      return res.status(200).json({ success: true, message: 'All notifications cleared.' });
    }

    if (notificationId) {
      const notif = await Notification.findById(notificationId);
      if (notif) {
        if (notif.recipient && String(notif.recipient) === String(userId)) {
          await Notification.deleteOne({ _id: notificationId });
        } else {
          await Notification.updateOne(
            { _id: notificationId },
            { $addToSet: { clearedBy: userId } }
          );
        }
      }
      return res.status(200).json({ success: true, message: 'Notification cleared.' });
    }

    return res.status(400).json({ success: false, message: 'Notification ID or clearAll flag required.' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 6. POST /api/notifications/notify-marks (Broadcast Internal Marks Published)
// ============================================================================
router.post('/notify-marks', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Hod', 'Staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Authorized role required.' });
    }

    const { department, year, semester, subjectCode, subjectName, examName } = req.body;
    await connectDB();

    const deptCode = department && department !== 'ALL' ? String(department).trim().toUpperCase() : 'ALL';
    const examLabel = examName || 'Internal Assessment';

    let title = '📢 Internal Marks Published';
    let message = '';

    if (subjectCode) {
      const subTitle = `${subjectCode} - ${subjectName || 'Subject'}`;
      title = `📢 ${examLabel} Marks Published`;
      message = `Internal marks for ${subTitle} (Dept: ${deptCode}${semester ? `, Sem: ${semester}` : ''}) have been officially published. Check your marks portal now.`;
    } else if (deptCode !== 'ALL') {
      message = `Internal marks for ${deptCode}${year ? ` Year ${year}` : ''}${semester ? ` (Semester ${semester})` : ''} have been officially published. Check your marks portal now.`;
    } else {
      message = `Internal marks have been officially published. Check your marks portal now to view your assessment scores.`;
    }

    const link = '/student/marks';

    // 1. Create In-App Notification document
    const notifDoc = await Notification.create({
      recipient: null,
      role: 'All',
      department: deptCode,
      year: year ? Number(year) : null,
      semester: semester ? Number(semester) : null,
      title,
      message,
      type: 'MARK_PUBLISHED',
      link,
      senderName: `${req.user.role} Management`,
    });

    // 2. Query target push subscriptions
    const subQuery = {};
    if (deptCode !== 'ALL') {
      subQuery.$or = [{ department: deptCode }, { department: 'ALL' }, { role: 'Admin' }];
    }

    const subscriptions = await PushSubscription.find(subQuery).lean();

    // 3. Send Web Push
    const pushPayload = {
      title,
      body: message,
      icon: '/nilogo.png',
      badge: '/nilogo.png',
      data: {
        url: link,
        notificationId: notifDoc._id.toString(),
      },
    };

    const pushSentCount = await sendPushToSubscriptions(subscriptions, pushPayload);

    return res.status(200).json({
      success: true,
      message: `Notifications sent successfully! Delivered push alert to ${pushSentCount} device(s) and logged in-app notifications.`,
      notificationId: notifDoc._id,
      pushSentCount,
    });
  } catch (error) {
    console.error('Error broadcasting marks notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 7. POST /api/notifications/broadcast (General College/Department Notification)
// ============================================================================
router.post('/broadcast', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Hod'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or HOD role required.' });
    }

    const { title, message, department, role, link, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    await connectDB();
    const deptCode = department && department !== 'ALL' ? String(department).trim().toUpperCase() : 'ALL';
    const targetRole = role || 'All';

    // 1. Create In-App Notification
    const notifDoc = await Notification.create({
      recipient: null,
      role: targetRole,
      department: deptCode,
      title: title.trim(),
      message: message.trim(),
      type: type || 'ANNOUNCEMENT',
      link: link || '/student/announcements',
      senderName: `${req.user.role} Office`,
    });

    // 2. Query target subscriptions
    const subQuery = {};
    if (deptCode !== 'ALL') {
      subQuery.$or = [{ department: deptCode }, { department: 'ALL' }, { role: 'Admin' }];
    }
    if (targetRole !== 'All') {
      subQuery.role = targetRole;
    }

    const subscriptions = await PushSubscription.find(subQuery).lean();

    // 3. Send Web Push
    const pushPayload = {
      title,
      body: message,
      icon: '/nilogo.png',
      badge: '/nilogo.png',
      data: {
        url: link || '/student',
        notificationId: notifDoc._id.toString(),
      },
    };

    const pushSentCount = await sendPushToSubscriptions(subscriptions, pushPayload);

    return res.status(200).json({
      success: true,
      message: `Broadcast sent! Delivered push to ${pushSentCount} device(s).`,
      notificationId: notifDoc._id,
      pushSentCount,
    });
  } catch (error) {
    console.error('Error broadcasting notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
