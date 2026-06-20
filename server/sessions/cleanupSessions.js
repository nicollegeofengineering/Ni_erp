const activeSessions = require("./sessions");

setInterval(() => {

    const now = Date.now();

    for (const [email, session] of activeSessions) {

        if (session.expiresAt < now) {

            activeSessions.delete(email);

            console.log(`Session expired: ${email}`);

        }

    }

}, 15 * 60 * 1000);