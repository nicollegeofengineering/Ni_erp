const Mark = require('../models/Mark');
const Student = require('../models/Student');
const Timetable = require('../models/Timetable');

async function getSubjectsForStaff({ staffId, exam_name, academic_year, year, semester, batch }) {
  const timetableFilter = {
    staff: staffId,
    academic_year,
    year: Number(year),
    semester: Number(semester),
  };
  if (batch) timetableFilter.batch = batch;

  const timetables = await Timetable.find(timetableFilter)
    .populate('subject', 'subjectName subjectCode Category')
    .lean();

  const subjectMap = new Map();
  timetables.forEach(entry => {
    if (entry.subject) {
      const sub = entry.subject;
      const key = sub._id.toString();
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          _id: sub._id,
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode,
          Category: sub.Category,
          department_code: entry.department_code,
        });
      }
    }
  });
  return Array.from(subjectMap.values());
}

async function getRoster({ department_code, year, semester, section, batch }) {
  const filter = {
    department_code,
    year: Number(year),
    semester: Number(semester),
    student_status: { $ne: 'Suspended' },
  };
  if (section) filter.section = section;
  if (batch) filter.batch = batch;

  const students = await Student.find(filter)
    .select('student_id register_no first_name last_name')
    .lean();

  return students.map(s => ({
    _id: s._id,
    register_no: s.register_no || s.student_id,
    full_name: `${s.first_name} ${s.last_name}`.trim(),
  }));
}

async function getMarks(filters) {
  const query = {};
  if (filters.exam_name) query.exam_name = filters.exam_name;
  if (filters.subject) query.subject = filters.subject;
  if (filters.component) query.component = filters.component;
  if (filters.student) query.student = filters.student;
  if (filters.academic_year) query.academic_year = filters.academic_year;
  if (filters.department_code) query.department_code = filters.department_code;
  if (filters.year) query.year = Number(filters.year);
  if (filters.semester) query.semester = Number(filters.semester);
  if (filters.section) query.section = filters.section;
  if (filters.batch) query.batch = filters.batch;
  if (filters._id) query._id = filters._id;

  const marks = await Mark.find(query)
    .populate('student', 'student_id register_no first_name last_name')
    .populate('subject', 'subjectName subjectCode Category')
    .populate('staff', 'staff_id first_name last_name')
    .lean();
  return marks;
}

async function createMark(data, user) {
  const mark = new Mark({
    ...data,
    staff: data.staff || user._id,
    entered_by: user._id,
    last_edited_by: null,
  });
  await mark.save();
  return mark;
}

async function updateMark(markId, updates, user) {
  const mark = await Mark.findById(markId);
  if (!mark) throw new Error('Mark not found');
  if (updates.marks_obtained !== undefined) mark.marks_obtained = updates.marks_obtained;
  if (updates.remarks !== undefined) mark.remarks = updates.remarks;
  mark.last_edited_by = user._id;
  await mark.save();
  return mark;
}

async function deleteMark(markId) {
  const mark = await Mark.findByIdAndDelete(markId);
  if (!mark) throw new Error('Mark not found');
  return mark;
}

async function getStudentMarks(register_no) {
  const student = await Student.findOne({ register_no });
  if (!student) throw new Error('Student not found');

  const marks = await Mark.find({ student: student._id })
    .populate('subject', 'subjectName subjectCode Category')
    .lean();

  const grouped = {};
  marks.forEach(mark => {
    const sem = mark.semester;
    const exam = mark.exam_name;
    if (!grouped[sem]) grouped[sem] = {};
    if (!grouped[sem][exam]) grouped[sem][exam] = [];
    grouped[sem][exam].push({
      _id: mark.subject._id,
      code: mark.subject.subjectCode,
      name: mark.subject.subjectName,
      theory_marks: mark.component === 'Theory' ? mark.marks_obtained : null,
      practical_marks: mark.component === 'Practical' ? mark.marks_obtained : null,
    });
  });
  return grouped;
}

module.exports = {
  getSubjectsForStaff,
  getRoster,
  getMarks,
  createMark,
  updateMark,
  deleteMark,
  getStudentMarks,
};