const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const connectDB = require('../../config/db');
const Department = require('../../models/Department');
const VerifyToken = require('../../middleware/verifyToken');

// ----- GET /all  —  list all departments -----
router.get('/all', async (req, res) => {
  try {
    await connectDB();
    const departments = await Department.find().lean();
    res.status(200).json({
      success: true,
      data: departments,
      cached: false,
    });
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ----- POST /  —  create a new department -----
router.post('/', async (req, res) => {
  try {
    await connectDB();
    const { code, name } = req.body;

    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: 'Department code and name are required',
      });
    }

    // Check for duplicate code
    const existing = await Department.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Department with code '${code}' already exists`,
      });
    }

    const newDepartment = new Department({
      code: code.toUpperCase(),
      name: name.trim(),
    });

    await newDepartment.save();

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: newDepartment,
    });
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ----- PUT /:id  —  update a department -----
router.put('/:id', async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const { code, name } = req.body;

    if (!name && !code) {
      return res.status(400).json({
        success: false,
        message: 'Department code or name is required',
      });
    }

    let department = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      department = await Department.findById(id);
    }
    if (!department) {
      department = await Department.findOne({ code: id.toUpperCase() });
    }

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    if (code && code.trim()) {
      const formattedCode = code.trim().toUpperCase();
      if (formattedCode !== department.code) {
        const existing = await Department.findOne({ code: formattedCode });
        if (existing) {
          return res.status(409).json({
            success: false,
            message: `Department with code '${formattedCode}' already exists`,
          });
        }
        department.code = formattedCode;
      }
    }

    if (name && name.trim()) {
      department.name = name.trim();
    }

    await department.save();

    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: department,
    });
  } catch (err) {
    console.error('Error updating department:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ----- DELETE /:code  —  delete a department by its code (Admin Only) -----
router.delete('/:code', VerifyToken, async (req, res) => {
  try {
    await connectDB();

    const role = (req.user?.role || '').toLowerCase();
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Administrators are permitted to delete departments.',
      });
    }

    const { code } = req.params;
    const deleted = await Department.findOneAndDelete({ code: code.toUpperCase() });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Department with code '${code}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
      data: deleted,
    });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;