const connectDB = require('../config/db');
const { webpush } = require('../config/webPush');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * Helper: send web push notification safely to a list of subscriptions and prune expired ones.
 */
async function sendPushToSubscriptions(subscriptions, payload) {
  if (!subscriptions || subscriptions.length === 0) return 0;
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let successCount = 0;

  const sendPromises = subscriptions.map(async (subDoc) => {
    try {
      await webpush.sendNotification(subDoc.subscription, payloadStr);
      successCount++;
    } catch (err) {
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

/**
 * Send notification for Universal (College) or Department announcements.
 * - Universal (College): send to ALL users across the institution.
 * - Department: send to Admin, Department Staff & HOD, and Department Students.
 */
async function notifyAnnouncement(announcement, isUpdate = false) {
  try {
    await connectDB();

    const isCollege = announcement.type === 'college';
    const deptCode = !isCollege && announcement.department ? String(announcement.department).trim().toUpperCase() : 'ALL';

    const titlePrefix = isUpdate ? '🔄 Updated Announcement: ' : '📢 Announcement: ';
    const notifTitle = isCollege
      ? `${titlePrefix}${announcement.title}`
      : `${titlePrefix}[${deptCode}] ${announcement.title}`;

    const previewMsg = announcement.content
      ? announcement.content.length > 200
        ? `${announcement.content.substring(0, 200)}...`
        : announcement.content
      : 'New announcement posted.';

    const link = '/student/announcements';

    // 1. Create In-App Notification document
    const notifDoc = await Notification.create({
      recipient: null,
      role: 'All',
      department: deptCode,
      title: notifTitle,
      message: previewMsg,
      type: 'ANNOUNCEMENT',
      link,
      senderName: announcement.authorName || (isCollege ? 'College Administration' : `${deptCode} Department`),
    });

    console.log(`[Notification] In-app notification created: "${notifTitle}" (Dept: ${deptCode}) ID: ${notifDoc._id}`);

    // 2. Query target push subscriptions
    let subQuery = {};
    if (!isCollege) {
      // Department notification: Admin, Dept Staff/HOD, Dept Students
      subQuery = {
        $or: [
          { department: deptCode },
          { department: 'ALL' },
          { role: 'Admin' },
        ],
      };
    }

    const subscriptions = await PushSubscription.find(subQuery).lean();

    // 3. Send Web Push Notification
    if (subscriptions && subscriptions.length > 0) {
      const pushPayload = {
        title: notifTitle,
        body: previewMsg,
        icon: '/nilogo.png',
        badge: '/nilogo.png',
        data: {
          url: link,
          notificationId: notifDoc._id.toString(),
        },
      };

      sendPushToSubscriptions(subscriptions, pushPayload).then((count) => {
        console.log(`[Notification] Announcement ${isUpdate ? 'update' : 'create'} push delivered to ${count} of ${subscriptions.length} subscriber(s).`);
      }).catch((pushErr) => {
        console.warn('[Notification] Push delivery warning:', pushErr.message);
      });
    }

    return notifDoc;
  } catch (err) {
    console.error('[Notification] Error in notifyAnnouncement:', err);
    return null;
  }
}

/**
 * Send In-App & Web Push Notification to Admin and Department HODs when a new admission application is submitted.
 */
async function notifyAdmissionApplication(application) {
  try {
    await connectDB();

    const deptCode = application.department ? String(application.department).trim().toUpperCase() : 'ALL';
    const notifTitle = `📝 New Admission Application: ${application.name}`;
    const previewMsg = `Applied for ${deptCode} (${application.branchPreferred || 'B.E/B.Tech'}). Cutoff: ${application.cutoffMark ?? 'N/A'}. Hall Ticket: ${application.hallTicketNo}`;
    const link = '/admin/admissions';

    // 1. Create In-App Notification document
    const notifDoc = await Notification.create({
      recipient: null,
      role: 'Admin',
      department: deptCode,
      title: notifTitle,
      message: previewMsg,
      type: 'ANNOUNCEMENT',
      link,
      senderName: 'Online Admission Portal',
    });

    console.log(`[Notification] In-app admission alert created: "${notifTitle}" (Dept: ${deptCode}) ID: ${notifDoc._id}`);

    // 2. Query target push subscriptions: Admin & Department HODs
    const subQuery = {
      $or: [
        { role: 'Admin' },
        { role: 'HOD', department: deptCode },
        { department: 'ALL' },
      ],
    };

    const subscriptions = await PushSubscription.find(subQuery).lean();

    // 3. Send Web Push Notification
    if (subscriptions && subscriptions.length > 0) {
      const pushPayload = {
        title: notifTitle,
        body: previewMsg,
        icon: '/nilogo.png',
        badge: '/nilogo.png',
        data: {
          url: link,
          notificationId: notifDoc._id.toString(),
        },
      };

      sendPushToSubscriptions(subscriptions, pushPayload)
        .then((count) => {
          console.log(`[Notification] Admission application push delivered to ${count} of ${subscriptions.length} admin/HOD subscriber(s).`);
        })
        .catch((pushErr) => {
          console.warn('[Notification] Push delivery warning for admission application:', pushErr.message);
        });
    }

    return notifDoc;
  } catch (err) {
    console.error('[Notification] Error in notifyAdmissionApplication:', err);
    return null;
  }
}

/**
 * Check and send notification to student when their attendance drops below 80% (Warning) or below 70% (Critical / Exam Ineligible).
 */
async function notifyAttendanceAlert(studentId, currentPercentage, semester) {
  try {
    await connectDB();
    if (typeof currentPercentage !== 'number' || isNaN(currentPercentage)) return null;

    let alertType = null;
    let notifTitle = '';
    let previewMsg = '';

    if (currentPercentage < 70) {
      alertType = 'CRITICAL';
      notifTitle = `🚨 Attendance Alert: ${currentPercentage}% (Exam Ineligible)`;
      previewMsg = `Your attendance has fallen to ${currentPercentage}%, which is below the mandatory 70% minimum threshold to write exams. Please contact your Class Advisor / HOD immediately.`;
    } else if (currentPercentage < 80) {
      alertType = 'WARNING';
      notifTitle = `⚠️ Attendance Warning: ${currentPercentage}%`;
      previewMsg = `Your attendance is currently ${currentPercentage}% (below 80%). Please attend upcoming classes regularly to stay above the 70% exam eligibility cutoff.`;
    }

    if (!alertType) return null;

    // Find the student document and associated user
    const student = await Student.findOne({
      $or: [
        { student_id: String(studentId).trim() },
        { register_no: String(studentId).trim() },
        { roll_no: String(studentId).trim() },
      ],
    }).lean();

    if (!student) return null;

    // Find user for direct recipient
    const user = await User.findOne({
      $or: [
        { username: student.student_id },
        { username: student.register_no },
        { username: student.roll_no },
        { email: student.email },
      ],
    }).lean();

    // Prevent duplicate alerts sent on the same day for the same student & alert type
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const existingNotif = await Notification.findOne({
      recipient: user ? user._id : null,
      type: 'ATTENDANCE_WARNING',
      createdAt: { $gte: startOfToday },
      title: notifTitle,
    });

    if (existingNotif) {
      return existingNotif;
    }

    const link = '/student/attendance';

    const notifDoc = await Notification.create({
      recipient: user ? user._id : null,
      role: 'Student',
      department: student.department_code || 'ALL',
      year: student.year || null,
      semester: semester || student.semester || null,
      title: notifTitle,
      message: previewMsg,
      type: 'ATTENDANCE_WARNING',
      link,
      senderName: 'Attendance Department',
    });

    console.log(`[Notification] Attendance alert sent to student ${student.student_id || student.register_no} (${currentPercentage}%): "${notifTitle}"`);

    // Web push notifications
    let subQuery = {};
    if (user) {
      subQuery = { userId: user._id };
    } else {
      subQuery = { role: 'Student', department: student.department_code || 'ALL' };
    }

    const subscriptions = await PushSubscription.find(subQuery).lean();
    if (subscriptions && subscriptions.length > 0) {
      const pushPayload = {
        title: notifTitle,
        body: previewMsg,
        icon: '/nilogo.png',
        badge: '/nilogo.png',
        data: {
          url: link,
          notificationId: notifDoc._id.toString(),
        },
      };

      sendPushToSubscriptions(subscriptions, pushPayload).catch((pushErr) => {
        console.warn('[Notification] Push delivery warning for attendance alert:', pushErr.message);
      });
    }

    return notifDoc;
  } catch (err) {
    console.error('[Notification] Error in notifyAttendanceAlert:', err);
    return null;
  }
}

module.exports = {
  sendPushToSubscriptions,
  notifyAnnouncement,
  notifyAdmissionApplication,
  notifyAttendanceAlert,
};
