const express = require("express");
const router = express.Router();
const Announcement = require("../../models/Announcement");

/**
 * GET /api/news
 * Public endpoint consumed by college website (niphp/includes/header.php)
 * Returns universal / college announcements in descending order by creation date.
 */
router.get("/", async (req, res) => {
  try {
    const announcements = await Announcement.find({
      type: "college",
      isActive: true,
    })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(20)
      .lean();

    // Map to the array format that PHP json_decode / website ticker expects
    const newsList = announcements.map((item) => ({
      _id: item._id,
      title: item.title,
      content: item.content,
      author: item.authorName || "Administration",
      date: item.createdAt,
      type: item.type,
      priority: item.priority,
    }));

    // If empty, supply a welcoming fallback headline
    if (newsList.length === 0) {
      return res.status(200).json([
        {
          title: "Admissions Open for B.E. & B.Tech Programmes — Apply Online Now!",
          content: "Welcome to Noorul Islam College of Engineering and Technology (NICETECH).",
          date: new Date(),
        },
      ]);
    }

    res.status(200).json(newsList);
  } catch (err) {
    console.error("[News API] Error fetching public news ticker:", err);
    res.status(200).json([
      {
        title: "Welcome to Noorul Islam College of Engineering and Technology (NICETECH)",
        date: new Date(),
      },
    ]);
  }
});

module.exports = router;
