const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("../../config/db"); // default export (function)
const Subject = require("../../models/Subject");

const router = express.Router();

/**
 * GET /api/admin/subject/all
 * Query: page, limit, search, category
 */
router.get("/all", async (req, res) => {
  
  try {
    await connectDB();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search && req.query.search.trim()) {
      const searchTerm = req.query.search.trim();
      filter.$or = [
        { subjectName: { $regex: searchTerm, $options: "i" } },
        { subjectCode: { $regex: searchTerm, $options: "i" } },
      ];
    }

    if (req.query.category && req.query.category.trim()) {
      filter.Category = { $regex: req.query.category.trim(), $options: "i" };
    }

    const [subjects, total] = await Promise.all([
      Subject.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subject.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: subjects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/admin/subject
 */
router.post("/", async (req, res) => {
  const role = req.user?.role;
    
    if (role !== 'Admin' && role !== 'Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  try {
    await connectDB();

    const { subjectName, subjectCode, Category } = req.body;

    if (!subjectName || !subjectName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject name is required",
      });
    }
    if (!subjectCode || !subjectCode.trim()) {
      return res.status(400).json({
        success: false,
        message: "Subject code is required",
      });
    }
    if (!Category || !Category.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const VALID_CATEGORIES = ['L', 'T', 'T/L', 'O'];
    const formattedCategory = Category.trim().toUpperCase();
    if (!VALID_CATEGORIES.includes(formattedCategory)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category. Allowed options are: L, T, T/L, O",
      });
    }

    const formattedSubjectName = subjectName.trim().toUpperCase();
    const formattedSubjectCode = subjectCode.trim().toUpperCase();

    const existingSubject = await Subject.findOne({
      subjectCode: formattedSubjectCode,
    });

    if (existingSubject) {
      return res.status(409).json({
        success: false,
        message: `Subject code '${formattedSubjectCode}' already exists`,
        field: "subjectCode",
        value: formattedSubjectCode,
      });
    }

    const newSubject = new Subject({
      subjectName: formattedSubjectName,
      subjectCode: formattedSubjectCode,
      Category: formattedCategory,
    });

    await newSubject.save();

    res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: newSubject,
    });
  } catch (err) {
    console.error("Error creating subject:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];
      return res.status(409).json({
        success: false,
        message: `${field} '${value}' already exists`,
        field,
        value,
      });
    }
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * PUT /api/admin/subject/:id
 */
router.put("/:id", async (req, res) => {
  const role = req.user?.role;
    
    if (role !== 'Admin' && role !== 'Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  try {
    await connectDB();

    const { id } = req.params;
    const { subjectName, Category } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID",
      });
    }

    const existingSubject = await Subject.findById(id);
    if (!existingSubject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    const updateData = {};

    if (subjectName && subjectName.trim()) {
      updateData.subjectName = subjectName.trim().toUpperCase();
    }
    if (Category && Category.trim()) {
      const VALID_CATEGORIES = ['L', 'T', 'T/L', 'O'];
      const formattedCategory = Category.trim().toUpperCase();
      if (!VALID_CATEGORIES.includes(formattedCategory)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category. Allowed options are: L, T, T/L, O",
        });
      }
      updateData.Category = formattedCategory;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update. Provide subjectName or Category.",
      });
    }

    const updatedSubject = await Subject.findByIdAndUpdate(
      id,
      updateData,
      { returnDocument: 'after', runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: updatedSubject,
    });
  } catch (err) {
    console.error("Error updating subject:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];
      return res.status(409).json({
        success: false,
        message: `${field} '${value}' already exists`,
        field,
        value,
      });
    }
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * DELETE /api/admin/subject/:id
 */
router.delete("/:id", async (req, res) => {
  const role = (req.user?.role || '').toLowerCase();
    
  if (role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only Administrators can delete subjects.',
    });
  }
  try {
    await connectDB();

    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID",
      });
    }

    const deletedSubject = await Subject.findByIdAndDelete(id);
    if (!deletedSubject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subject deleted successfully",
      data: deletedSubject,
    });
  } catch (err) {
    console.error("Error deleting subject:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;