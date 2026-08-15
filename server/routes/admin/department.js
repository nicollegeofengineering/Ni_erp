const express = require('express');
const router = express.Router();
const  connectDB  = require('../../config/db'); // adjust path as needed
const Department = require('../../models/Department'); // adjust path

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

// ----- DELETE /:code  —  delete a department by its code -----
router.delete('/:code', async (req, res) => {
  try {
    await connectDB();
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