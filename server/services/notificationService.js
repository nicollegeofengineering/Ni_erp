const connectDB = require('../config/db');
const { webpush } = require('../config/webPush');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');

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

module.exports = {
  sendPushToSubscriptions,
  notifyAnnouncement,
  notifyAdmissionApplication,
};
