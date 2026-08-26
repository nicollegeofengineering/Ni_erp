const webpush = require('web-push');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BBLGr8ODigWp_zmZRfhXKrs8Lj24stO8EuPPz0GZ0N4bzw0YwFafoAc7-iIhlqKY2l1U8Z-xKbksxRpo-3Ee5dI';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  '2iPO9YA_gnZ9PdasnWJ6SMO0wYhClCop3TyLLTVFge4';

const VAPID_EMAIL =
  process.env.VAPID_EMAIL ||
  (process.env.EMAIL_USER ? `mailto:${process.env.EMAIL_USER}` : 'mailto:nicetonline@gmail.com');

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

module.exports = {
  webpush,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
};
