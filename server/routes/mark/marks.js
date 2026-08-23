const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const {
  canHandleSubject,
  resolveComponent,
  canView,
  canWrite,
} = require('../../services/markPermissions');
const markService = require('../../services/markService');
const Mark = require('../../models/Mark');
const Subject = require('../../models/Subject');

const auth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};

// ============================================================
// GET /api/mark/subjects – subjects staff is timetabled for
// ============================================================
router.get('/subjects', auth, async (req, res) => {
  try {
    await connectDB();
    const { exam_name, academic_year, year, semester, batch } = req.query;
    if (!exam_name || !academic_year || !year || !semester) {
      return res.status(400).json({ success: false, message: 'Missing required filters' });
    }

    console.log(req.user.id,exam_name,academic_year,year,semester,batch)
    const subjects = await markService.getSubjectsForStaff({
      staffId: req.user.id,
      exam_name,
      academic_year,
      year,
      semester,
      batch,
    });

    res.json({ success: true, data: subjects });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// GET /api/mark/roster – eligible students
// ============================================================
router.get('/roster', auth, async (req, res) => {
  try {
    await connectDB();
    const { department_code, year, semester, section, batch } = req.query;
    if (!department_code || !year || !semester) {
      return res.status(400).json({ success: false, message: 'Missing required filters' });
    }

    const students = await markService.getRoster({ department_code, year, semester, section, batch });
    res.json({ success: true, data: students });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// GET /api/mark – list marks with filters
// ============================================================
router.get('/', auth, async (req, res) => {
  try {
    await connectDB();
    const filters = req.query;
    const marks = await markService.getMarks(filters);

    const allowed = marks.filter(mark => canView(req.user, mark));
    res.json({ success: true, data: allowed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// POST /api/mark – create a new mark entry
// ============================================================
router.post('/', auth, async (req, res) => {
  try {
    await connectDB();
    const {
      exam_name,
      subject,
      component,
      student,
      marks_obtained,
      max_marks,
      remarks,
      academic_year,
      department_code,
      year,
      semester,
      section,
      batch,
    } = req.body;

    if (!exam_name || !subject || !student || !academic_year || !department_code || !year || !semester) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const canWriteCheck = await canWrite(req.user, {
      department_code,
      subject,
      academic_year,
      year,
      semester,
    });
    if (!canWriteCheck) {
      return res.status(403).json({ success: false, message: 'Access denied – not timetabled' });
    }

    let finalComponent = component;
    if (!finalComponent) {
      const subjectDoc = await Subject.findById(subject);
      if (!subjectDoc) return res.status(400).json({ success: false, message: 'Subject not found' });
      const resolved = resolveComponent(subjectDoc.Category);
      if (resolved) {
        finalComponent = resolved;
      } else {
        return res.status(400).json({ success: false, message: 'Component required for Theory cum Practical subjects' });
      }
    }

    const markData = {
      exam_name,
      subject,
      component: finalComponent,
      student,
      marks_obtained: marks_obtained ?? null,
      max_marks: max_marks || 100,
      remarks: remarks || '',
      academic_year,
      department_code,
      year: Number(year),
      semester: Number(semester),
      section: section || '',
      batch: batch || '',
      staff: req.user._id,
    };

    const newMark = await markService.createMark(markData, req.user);
    res.status(201).json({ success: true, data: newMark });
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Mark already exists for this student/exam/subject/component' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// PATCH /api/mark/:id – update marks_obtained / remarks
// ============================================================
router.patch('/:id', auth, async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;
    const { marks_obtained, remarks } = req.body;

    const existingMark = await markService.getMarks({ _id: id });
    if (!existingMark || existingMark.length === 0) {
      return res.status(404).json({ success: false, message: 'Mark not found' });
    }
    const mark = existingMark[0];

    const canWriteCheck = await canWrite(req.user, {
      department_code: mark.department_code,
      subject: mark.subject._id,
      academic_year: mark.academic_year,
      year: mark.year,
      semester: mark.semester,
    });
    if (!canWriteCheck) {
      return res.status(403).json({ success: false, message: 'Access denied – not timetabled' });
    }

    const updated = await markService.updateMark(id, { marks_obtained, remarks }, req.user);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// DELETE /api/mark/:id – delete a mark
// ============================================================
router.delete('/:id', auth, async (req, res) => {
  try {
    await connectDB();
    const { id } = req.params;

    const existingMark = await markService.getMarks({ _id: id });
    if (!existingMark || existingMark.length === 0) {
      return res.status(404).json({ success: false, message: 'Mark not found' });
    }
    const mark = existingMark[0];

    const canWriteCheck = await canWrite(req.user, {
      department_code: mark.department_code,
      subject: mark.subject._id,
      academic_year: mark.academic_year,
      year: mark.year,
      semester: mark.semester,
    });
    if (!canWriteCheck) {
      return res.status(403).json({ success: false, message: 'Access denied – not timetabled' });
    }

    await markService.deleteMark(id);
    res.json({ success: true, message: 'Mark deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// GET /api/mark/student – student view by register number
// ============================================================
router.get('/student', auth, async (req, res) => {
  try {
    await connectDB();
    const { register_no } = req.query;
    if (!register_no) {
      return res.status(400).json({ success: false, message: 'Register number required' });
    }

    const grouped = await markService.getStudentMarks(register_no);
    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error(error);
    if (error.message === 'Student not found') {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================================
// GET /api/mark/exam-subjects – get unique exam names and subjects for a class
// ============================================================
router.get('/exam-subjects', auth, async (req, res) => {
  try {
    await connectDB();
    const { academic_year, department_code, year, semester, batch } = req.query;
    if (!academic_year || !department_code || !year || !semester) {
      return res.status(400).json({ success: false, message: 'Missing required filters' });
    }
    const query = {
      academic_year,
      department_code,
      year: Number(year),
      semester: Number(semester),
    };
    if (batch) query.batch = batch;

    const exams = await Mark.distinct('exam_name', query);
    const subjectIds = await Mark.distinct('subject', query);
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('_id subjectName subjectCode Category')
      .lean();

    res.json({ success: true, data: { exams, subjects } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;