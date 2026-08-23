const Timetable = require('../models/Timetable');
const Student = require('../models/Student');

async function canHandleSubject({
  staffId,
  academicYear,
  department,
  year,
  semester,
  subjectId,
}) {
    
  const count = await Timetable.countDocuments({
    staff: staffId,
    academicYear: academicYear,
    //department_code: department,
    year: Number(year),
    semester: Number(semester),
    subject: subjectId,
  });
  return count > 0;
}


function resolveComponent(category) {
  if (category === 'T') return 'Theory';
  if (category === 'L') return 'Practical';
  return null; // TL => must choose
}

function canView(user, mark) {
  if (user.role_type === 'Admin') return true;
  if (user.role_type === 'Hod') {
    return mark.department_code === user.department_code;
  }
  return mark.staff.toString() === user._id.toString() ||
         mark.entered_by.toString() === user._id.toString();
}

async function canWrite(user, params) {
  const { department_code, subject, academic_year, year, semester } = params;
  if (user.role_type === 'Hod') {
    if (department_code === user.department_code) return true;
    if (await canHandleSubject({ staffId: user._id, academic_year, department: department_code, year, semester, subjectId: subject })) {
      return true;
    }
    return false;
  }
  return await canHandleSubject({
    staffId: user._id,
    academicYear: academic_year,
    department: department_code,
    year,
    semester,
    subjectId: subject,
  });
}

module.exports = {
  canHandleSubject,
  resolveComponent,
  canView,
  canWrite,
};