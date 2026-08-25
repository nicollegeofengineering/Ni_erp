const mongoose = require('mongoose');
const ExamMaster = require('../models/ExamMaster');
const ExamSession = require('../models/ExamSession');
const ExamCandidate = require('../models/ExamCandidate');
const ExamHall = require('../models/ExamHall');
const ExamSeating = require('../models/ExamSeating');
const Student = require('../../models/Student');
const Department = require('../../models/Department');
const Subject = require('../../models/Subject');
const AllocationService = require('../services/allocationService');
const { getLayoutDefinition } = require('../utils/layoutDefinitions');

// Helper to check user authorization (Admin and HOD allowed)
const checkAuth = (req, res) => {
  const role = (req.user?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'hod') {
    res.status(403).json({
      success: false,
      message: 'Access denied. Only Admin and HOD are authorized to manage Exam Hall Allocations.',
    });
    return false;
  }
  return true;
};

// ==================== 0. EXAM MASTERS (CONFIGURATION) ====================

exports.getMasters = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const masters = await ExamMaster.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: masters });
  } catch (err) {
    console.error('Error fetching exam masters:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createMaster = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { examCode, examName, centreCode, centreName } = req.body;
    if (!examCode?.trim() || !examName?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Exam Code and Exam Name are required.',
      });
    }

    const code = examCode.trim().toUpperCase();
    const existing = await ExamMaster.findOne({ examCode: code });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Exam Configuration with code '${code}' already exists.`,
      });
    }

    const newMaster = new ExamMaster({
      examCode: code,
      examName: examName.trim(),
      centreCode: centreCode?.trim() || '9460',
      centreName: centreName?.trim() || 'Nagercoil Islam College of Engineering and Technology',
      active: true,
    });

    await newMaster.save();
    return res.status(201).json({
      success: true,
      message: 'Exam Master configuration saved successfully',
      data: newMaster,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMaster = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const { examCode, examName, centreCode, centreName, active } = req.body;

    const master = await ExamMaster.findById(id);
    if (!master) {
      return res.status(404).json({ success: false, message: 'Exam Master configuration not found' });
    }

    if (examCode?.trim()) {
      const code = examCode.trim().toUpperCase();
      if (code !== master.examCode) {
        const dup = await ExamMaster.findOne({ examCode: code, _id: { $ne: id } });
        if (dup) {
          return res.status(409).json({ success: false, message: `Exam Code '${code}' is already in use.` });
        }
        master.examCode = code;
      }
    }

    if (examName?.trim()) master.examName = examName.trim();
    if (centreCode !== undefined) master.centreCode = centreCode.trim();
    if (centreName !== undefined) master.centreName = centreName.trim();
    if (active !== undefined) master.active = Boolean(active);

    await master.save();

    // Also cascade updates to linked sessions
    await ExamSession.updateMany(
      { examMaster: id },
      {
        examCode: master.examCode,
        examName: master.examName,
        centreCode: master.centreCode,
        centreName: master.centreName,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Exam Master configuration updated successfully',
      data: master,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteMaster = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const force = req.query.force === 'true' || req.body?.force === true;

    const linkedSessions = await ExamSession.find({ examMaster: id }).select('_id').lean();
    const sessionIds = linkedSessions.map((s) => s._id);

    if (sessionIds.length > 0 && !force) {
      const candidateCount = await ExamCandidate.countDocuments({ examSession: { $in: sessionIds } });
      const seatingCount = await ExamSeating.countDocuments({ examSession: { $in: sessionIds } });
      return res.status(200).json({
        success: false,
        requiresConfirmation: true,
        sessionCount: sessionIds.length,
        candidateCount,
        seatingCount,
        message: `This exam has ${sessionIds.length} schedule(s), ${candidateCount} registered student(s), and ${seatingCount} seating allocations. Deleting will erase all assigned halls and students. Do you want to delete all?`,
      });
    }

    // Cascade delete: Seating arrangements, registered candidates, and linked sessions
    if (sessionIds.length > 0) {
      await ExamSeating.deleteMany({ examSession: { $in: sessionIds } });
      await ExamCandidate.deleteMany({ examSession: { $in: sessionIds } });
      await ExamSession.deleteMany({ _id: { $in: sessionIds } });
    }

    const deleted = await ExamMaster.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Exam Master configuration not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Exam Master and all ${sessionIds.length} associated schedule(s), hall allocations, and registered candidates deleted successfully.`,
    });
  } catch (err) {
    console.error('Error deleting exam master:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== 1. SESSIONS ====================

exports.getSessions = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const sessions = await ExamSession.find()
      .populate('examMaster')
      .sort({ examDate: -1, createdAt: -1 })
      .lean();
    
    // Enrich with counts
    const enriched = await Promise.all(
      sessions.map(async (sess) => {
        const candidateCount = await ExamCandidate.countDocuments({ examSession: sess._id });
        const seatingCount = await ExamSeating.countDocuments({ examSession: sess._id });
        const allocatedHalls = await ExamSeating.distinct('hall', { examSession: sess._id });
        return {
          ...sess,
          examName: sess.examMaster?.examName || sess.examName,
          examCode: sess.examMaster?.examCode || sess.examCode,
          centreCode: sess.examMaster?.centreCode || sess.centreCode || '9460',
          centreName: sess.examMaster?.centreName || sess.centreName || 'Nagercoil Islam College of Engineering and Technology',
          candidateCount,
          seatingCount,
          allocatedHallCount: allocatedHalls.length,
        };
      })
    );

    return res.status(200).json({ success: true, data: enriched });
  } catch (err) {
    console.error('Error fetching exam sessions:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSessionById = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const session = await ExamSession.findById(id).populate('examMaster').lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }
    const candidateCount = await ExamCandidate.countDocuments({ examSession: session._id });
    const seatingCount = await ExamSeating.countDocuments({ examSession: session._id });
    return res.status(200).json({
      success: true,
      data: {
        ...session,
        examName: session.examMaster?.examName || session.examName,
        examCode: session.examMaster?.examCode || session.examCode,
        centreCode: session.examMaster?.centreCode || session.centreCode || '9460',
        centreName: session.examMaster?.centreName || session.centreName || 'Nagercoil Islam College of Engineering and Technology',
        candidateCount,
        seatingCount,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSession = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { examMasterId, examCode, examName, centreCode, centreName, examDate, session } = req.body;
    
    let resolvedExamName = examName?.trim();
    let resolvedExamCode = examCode?.trim();
    let resolvedCentreCode = centreCode?.trim() || '9460';
    let resolvedCentreName = centreName?.trim() || 'Nagercoil Islam College of Engineering and Technology';
    let masterRef = null;

    if (examMasterId && mongoose.Types.ObjectId.isValid(examMasterId)) {
      const master = await ExamMaster.findById(examMasterId);
      if (master) {
        masterRef = master._id;
        resolvedExamName = master.examName;
        resolvedExamCode = master.examCode;
        resolvedCentreCode = master.centreCode;
        resolvedCentreName = master.centreName;
      }
    }

    if (!resolvedExamName || !examDate || !session) {
      return res.status(400).json({
        success: false,
        message: 'Exam name, date, and session (FN/AN) are required.',
      });
    }

    const newSession = new ExamSession({
      examMaster: masterRef,
      examCode: resolvedExamCode || '',
      examName: resolvedExamName,
      centreCode: resolvedCentreCode,
      centreName: resolvedCentreName,
      examDate: new Date(examDate),
      session: session.toUpperCase(),
      status: 'DRAFT',
      createdBy: req.user?.username || req.user?.email || 'Admin',
    });

    await newSession.save();
    return res.status(201).json({
      success: true,
      message: 'Exam session created successfully',
      data: newSession,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSession = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const { examMasterId, examName, examCode, centreCode, centreName, examDate, session, status } = req.body;

    const existing = await ExamSession.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    if (examMasterId && mongoose.Types.ObjectId.isValid(examMasterId)) {
      const master = await ExamMaster.findById(examMasterId);
      if (master) {
        existing.examMaster = master._id;
        existing.examName = master.examName;
        existing.examCode = master.examCode;
        existing.centreCode = master.centreCode;
        existing.centreName = master.centreName;
      }
    } else {
      if (examName?.trim()) existing.examName = examName.trim();
      if (examCode?.trim()) existing.examCode = examCode.trim();
      if (centreCode !== undefined) existing.centreCode = centreCode.trim();
      if (centreName !== undefined) existing.centreName = centreName.trim();
    }

    if (examDate) existing.examDate = new Date(examDate);
    if (session) existing.session = session.toUpperCase();
    if (status) existing.status = status;

    await existing.save();
    return res.status(200).json({
      success: true,
      message: 'Exam session updated successfully',
      data: existing,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSession = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    await ExamSeating.deleteMany({ examSession: id });
    await ExamCandidate.deleteMany({ examSession: id });
    const deleted = await ExamSession.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Exam session and all associated candidate/seating data deleted successfully',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== 2. CANDIDATES & STUDENT DB ====================

exports.lookupStudents = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { departmentCode, year, semester, section, search } = req.query;
    const filter = { student_status: 'Active' };

    if (departmentCode?.trim()) {
      filter.department_code = departmentCode.trim().toUpperCase();
    }
    if (year) {
      filter.year = parseInt(year, 10);
    }
    if (semester) {
      filter.semester = parseInt(semester, 10);
    }
    if (section?.trim()) {
      filter.section = section.trim().toUpperCase();
    }
    if (search?.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      filter.$or = [
        { register_no: reg },
        { roll_no: reg },
        { student_id: reg },
        { first_name: reg },
        { last_name: reg },
      ];
    }

    const [students, departments, subjects] = await Promise.all([
      Student.find(filter)
        .select('student_id register_no roll_no first_name last_name programme department_code year semester section')
        .sort({ department_code: 1, year: 1, register_no: 1 })
        .limit(1000)
        .lean(),
      Department.find().select('name code').sort({ code: 1 }).lean(),
      Subject.find().select('subjectName subjectCode').sort({ subjectCode: 1 }).lean(),
    ]);

    // Map department name to code
    const deptNameMap = {};
    departments.forEach((d) => {
      deptNameMap[d.code.toUpperCase()] = d.name;
    });

    const enrichedStudents = students.map((s) => ({
      _id: s._id,
      student_id: s.student_id,
      register_no: s.register_no,
      roll_no: s.roll_no,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      programme: s.programme || 'B.Tech',
      department_code: (s.department_code || '').toUpperCase(),
      department_name: deptNameMap[(s.department_code || '').toUpperCase()] || s.department_code,
      year: s.year,
      semester: s.semester,
      section: s.section,
    }));

    return res.status(200).json({
      success: true,
      count: enrichedStudents.length,
      students: enrichedStudents,
      departments,
      subjects,
    });
  } catch (err) {
    console.error('Error looking up students:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.importStudents = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId, studentIds, subjectCode, subjectName } = req.body;
    if (!sessionId || !Array.isArray(studentIds) || studentIds.length === 0 || !subjectCode?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Session ID, student IDs array, and Subject Code are required.',
      });
    }

    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const [students, departments] = await Promise.all([
      Student.find({ _id: { $in: studentIds } }).lean(),
      Department.find().lean(),
    ]);

    const deptMap = {};
    departments.forEach((d) => {
      deptMap[d.code.toUpperCase()] = d.name;
    });

    const existingCandidates = await ExamCandidate.find({ examSession: sessionId }).select('registerNo').lean();
    const existingSet = new Set(existingCandidates.map((c) => c.registerNo));

    const newCandidates = [];
    const duplicates = [];

    students.forEach((st) => {
      const regNo = st.register_no?.trim();
      if (!regNo) return;
      if (existingSet.has(regNo)) {
        duplicates.push(regNo);
      } else {
        const deptCode = (st.department_code || '').toUpperCase();
        const deptName = deptMap[deptCode] || deptCode;
        newCandidates.push({
          examSession: sessionId,
          student: st._id,
          name: `${st.first_name || ''} ${st.last_name || ''}`.trim() || `Candidate ${regNo}`,
          registerNo: regNo,
          programme: st.programme || 'B.Tech',
          department: deptName,
          departmentCode: deptCode,
          subjectCode: subjectCode.trim().toUpperCase(),
          subjectName: subjectName?.trim() || '',
        });
        existingSet.add(regNo);
      }
    });

    if (newCandidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: `All ${duplicates.length} selected students already exist in this exam session.`,
        duplicates,
      });
    }

    await ExamCandidate.insertMany(newCandidates);

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${newCandidates.length} students from database.${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`,
      addedCount: newCandidates.length,
      skippedCount: duplicates.length,
    });
  } catch (err) {
    console.error('Error importing students:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCandidates = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId } = req.params;
    const { search, subjectCode } = req.query;

    const filter = { examSession: sessionId };
    if (subjectCode?.trim()) {
      filter.subjectCode = subjectCode.trim().toUpperCase();
    }
    if (search?.trim()) {
      const reg = new RegExp(search.trim(), 'i');
      filter.$or = [{ registerNo: reg }, { name: reg }, { subjectCode: reg }];
    }

    const candidates = await ExamCandidate.find(filter)
      .sort({ subjectCode: 1, registerNo: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: candidates.length,
      data: candidates,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Add candidates via Register Number Range
exports.addRangeCandidates = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId, subjectCode, subjectName, registerNoFrom, registerNoTo, defaultNamePrefix, programme, department, departmentCode } = req.body;

    if (!sessionId || !subjectCode?.trim() || !registerNoFrom?.trim() || !registerNoTo?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject code, register number from, and register number to are required.',
      });
    }

    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const fromStr = registerNoFrom.trim();
    const toStr = registerNoTo.trim();

    // Match arbitrary prefix with numeric suffix
    const fromMatch = fromStr.match(/^(.*?)([0-9]+)$/);
    const toMatch = toStr.match(/^(.*?)([0-9]+)$/);

    if (!fromMatch || !toMatch || fromMatch[1] !== toMatch[1]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid range format. Common prefix must match and end with numeric digits.',
      });
    }

    const prefix = fromMatch[1];
    const fromNum = BigInt(fromMatch[2]);
    const toNum = BigInt(toMatch[2]);
    const padLength = fromMatch[2].length;

    if (fromNum > toNum) {
      return res.status(400).json({
        success: false,
        message: 'Register Number From cannot be greater than Register Number To.',
      });
    }

    const count = Number(toNum - fromNum) + 1;
    if (count > 500) {
      return res.status(400).json({
        success: false,
        message: `Range too large (${count} candidates). Maximum 500 candidates allowed per range batch.`,
      });
    }

    const existingCandidates = await ExamCandidate.find({ examSession: sessionId }).select('registerNo').lean();
    const existingSet = new Set(existingCandidates.map((c) => c.registerNo));

    const newCandidates = [];
    const duplicates = [];

    for (let current = fromNum; current <= toNum; current++) {
      const regNo = prefix + current.toString().padStart(padLength, '0');
      if (existingSet.has(regNo)) {
        duplicates.push(regNo);
      } else {
        newCandidates.push({
          examSession: sessionId,
          registerNo: regNo,
          name: defaultNamePrefix ? `${defaultNamePrefix} ${regNo}` : `Candidate ${regNo}`,
          programme: programme || 'B.Tech',
          department: department || '',
          departmentCode: (departmentCode || '').toUpperCase(),
          subjectCode: subjectCode.trim().toUpperCase(),
          subjectName: subjectName?.trim() || '',
        });
        existingSet.add(regNo);
      }
    }

    if (newCandidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: `All ${duplicates.length} register numbers in this range already exist in this exam session.`,
        duplicates,
      });
    }

    await ExamCandidate.insertMany(newCandidates);

    return res.status(201).json({
      success: true,
      message: `Successfully added ${newCandidates.length} candidates.${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`,
      addedCount: newCandidates.length,
      skippedCount: duplicates.length,
    });
  } catch (err) {
    console.error('Error adding range candidates:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Add candidates via manual entry rows
exports.addManualCandidates = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId, candidates } = req.body;
    if (!sessionId || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and candidate rows are required.',
      });
    }

    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const existingCandidates = await ExamCandidate.find({ examSession: sessionId }).select('registerNo').lean();
    const existingSet = new Set(existingCandidates.map((c) => c.registerNo));

    const validRows = [];
    const duplicates = [];

    candidates.forEach((cand) => {
      const regNo = (cand.registerNo || '').trim();
      const name = (cand.name || '').trim();
      const subjectCode = (cand.subjectCode || '').trim().toUpperCase();
      const subjectName = (cand.subjectName || '').trim();

      if (regNo && subjectCode) {
        if (existingSet.has(regNo)) {
          duplicates.push(regNo);
        } else {
          validRows.push({
            examSession: sessionId,
            registerNo: regNo,
            name: name || `Candidate ${regNo}`,
            programme: cand.programme || 'B.Tech',
            department: cand.department || '',
            departmentCode: (cand.departmentCode || '').toUpperCase(),
            subjectCode,
            subjectName,
          });
          existingSet.add(regNo);
        }
      }
    });

    if (validRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: duplicates.length > 0
          ? `All provided register numbers already exist in this exam session.`
          : 'No valid candidate rows provided.',
        duplicates,
      });
    }

    await ExamCandidate.insertMany(validRows);

    return res.status(201).json({
      success: true,
      message: `Successfully added ${validRows.length} candidates.${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`,
      addedCount: validRows.length,
      skippedCount: duplicates.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCandidate = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const { registerNo, name, subjectCode, subjectName, programme, department, departmentCode } = req.body;

    const candidate = await ExamCandidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (registerNo?.trim() && registerNo.trim() !== candidate.registerNo) {
      const dup = await ExamCandidate.findOne({
        examSession: candidate.examSession,
        registerNo: registerNo.trim(),
        _id: { $ne: id },
      });
      if (dup) {
        return res.status(409).json({
          success: false,
          message: `Register number '${registerNo.trim()}' already exists in this exam session.`,
        });
      }
      candidate.registerNo = registerNo.trim();
    }

    if (name?.trim()) candidate.name = name.trim();
    if (programme !== undefined) candidate.programme = programme.trim();
    if (department !== undefined) candidate.department = department.trim();
    if (departmentCode !== undefined) candidate.departmentCode = departmentCode.trim().toUpperCase();
    if (subjectCode?.trim()) candidate.subjectCode = subjectCode.trim().toUpperCase();
    if (subjectName !== undefined) candidate.subjectName = subjectName.trim();

    await candidate.save();

    // Also update seating record if already allocated
    await ExamSeating.updateMany(
      { candidate: id },
      {
        registerNo: candidate.registerNo,
        name: candidate.name,
        programme: candidate.programme,
        department: candidate.department,
        departmentCode: candidate.departmentCode,
        subjectCode: candidate.subjectCode,
        subjectName: candidate.subjectName,
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Candidate updated successfully',
      data: candidate,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCandidate = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const candidate = await ExamCandidate.findById(id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    // Check if seating exists for this candidate
    const existingSeating = await ExamSeating.findOne({ candidate: id });
    if (existingSeating) {
      await ExamSeating.deleteOne({ candidate: id });
    }

    await ExamCandidate.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Candidate deleted successfully',
      allocationAffected: !!existingSeating,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== 3. HALLS ====================

exports.getHalls = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const halls = await ExamHall.find().sort({ hallNumber: 1 }).lean();
    return res.status(200).json({ success: true, data: halls });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createHall = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { hallNumber, layoutType } = req.body;
    if (!hallNumber?.trim() || !layoutType) {
      return res.status(400).json({
        success: false,
        message: 'Hall number and layout type (FIVE_BY_FIVE or FOUR_BY_SIX_PLUS_ONE) are required.',
      });
    }

    const formattedNumber = hallNumber.trim().toUpperCase();
    const existing = await ExamHall.findOne({ hallNumber: formattedNumber });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Hall '${formattedNumber}' already exists.`,
      });
    }

    const newHall = new ExamHall({
      hallNumber: formattedNumber,
      layoutType: layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? 'FOUR_BY_SIX_PLUS_ONE' : 'FIVE_BY_FIVE',
      capacity: 25,
      active: true,
    });

    await newHall.save();
    return res.status(201).json({
      success: true,
      message: 'Exam hall created successfully',
      data: newHall,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateHall = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const { hallNumber, layoutType, active } = req.body;

    const hall = await ExamHall.findById(id);
    if (!hall) {
      return res.status(404).json({ success: false, message: 'Hall not found' });
    }

    if (hallNumber?.trim()) {
      const formatted = hallNumber.trim().toUpperCase();
      if (formatted !== hall.hallNumber) {
        const dup = await ExamHall.findOne({ hallNumber: formatted, _id: { $ne: id } });
        if (dup) {
          return res.status(409).json({ success: false, message: `Hall '${formatted}' already exists.` });
        }
        hall.hallNumber = formatted;
      }
    }

    if (layoutType) {
      hall.layoutType = layoutType === 'FOUR_BY_SIX_PLUS_ONE' ? 'FOUR_BY_SIX_PLUS_ONE' : 'FIVE_BY_FIVE';
    }

    if (active !== undefined) {
      hall.active = Boolean(active);
    }

    await hall.save();
    return res.status(200).json({
      success: true,
      message: 'Hall updated successfully',
      data: hall,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteHall = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { id } = req.params;
    const seatingCount = await ExamSeating.countDocuments({ hall: id });
    if (seatingCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete hall because it is currently assigned in active exam seatings. Please delete or regenerate the allocation first.',
      });
    }

    const deleted = await ExamHall.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Hall not found' });
    }
    return res.status(200).json({ success: true, message: 'Hall deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ==================== 4. ALLOCATION ENGINE ====================

exports.generateAllocation = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId, hallIds } = req.body;

    if (!sessionId || !Array.isArray(hallIds) || hallIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Exam session ID and at least one hall are required.',
      });
    }

    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const candidates = await ExamCandidate.find({ examSession: sessionId }).lean();
    if (candidates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidates registered in this exam session. Please add candidates first.',
      });
    }

    const halls = await ExamHall.find({ _id: { $in: hallIds }, active: true }).sort({ hallNumber: 1 }).lean();
    if (halls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid active halls selected.',
      });
    }

    const totalCapacity = halls.length * 25;
    if (candidates.length > totalCapacity) {
      return res.status(400).json({
        success: false,
        message: `Selected halls do not have sufficient seating capacity. Total Candidates: ${candidates.length}, Selected Capacity: ${totalCapacity}.`,
        candidatesCount: candidates.length,
        totalCapacity,
      });
    }

    // Run allocation algorithm
    const hallAllocations = AllocationService.generateAllocation(candidates, halls);

    // Flatten all seat records with examSession
    const allSeatRecords = [];
    hallAllocations.forEach((hAlloc) => {
      hAlloc.seats.forEach((seat) => {
        allSeatRecords.push({
          examSession: sessionId,
          hall: seat.hall,
          hallNumber: seat.hallNumber,
          seatNo: seat.seatNo,
          row: seat.row,
          column: seat.column,
          candidate: seat.candidate,
          registerNo: seat.registerNo,
          name: seat.name,
          programme: seat.programme || 'B.Tech',
          department: seat.department || '',
          departmentCode: seat.departmentCode || '',
          subjectCode: seat.subjectCode,
          subjectName: seat.subjectName,
        });
      });
    });

    // Atomic replace: remove old seating for this session and insert new
    await ExamSeating.deleteMany({ examSession: sessionId });
    await ExamSeating.insertMany(allSeatRecords);

    session.status = 'ALLOCATED';
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Seating allocation generated successfully.',
      totalCandidates: candidates.length,
      allocatedSeats: allSeatRecords.length,
      totalCapacity,
      availableSeats: totalCapacity - candidates.length,
      hallsCount: halls.length,
    });
  } catch (err) {
    console.error('Allocation error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.regenerateAllocation = async (req, res) => {
  return exports.generateAllocation(req, res);
};

exports.deleteAllocation = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId } = req.params;
    const session = await ExamSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const deleted = await ExamSeating.deleteMany({ examSession: sessionId });
    session.status = 'DRAFT';
    await session.save();

    return res.status(200).json({
      success: true,
      message: 'Seating allocation deleted successfully. Candidates and halls have been preserved.',
      deletedCount: deleted.deletedCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSeatingArrangement = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId } = req.params;
    const session = await ExamSession.findById(sessionId).populate('examMaster').lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    const seatings = await ExamSeating.find({ examSession: sessionId })
      .populate('hall')
      .sort({ hallNumber: 1, seatNo: 1 })
      .lean();

    // Group seatings by hall
    const hallsMap = new Map();

    seatings.forEach((seat) => {
      const hallId = seat.hall._id.toString();
      if (!hallsMap.has(hallId)) {
        const layoutDef = getLayoutDefinition(seat.hall.layoutType);
        hallsMap.set(hallId, {
          hall: seat.hall,
          layout: layoutDef,
          seats: {},
          seatsList: [],
          occupiedCount: 0,
        });
      }

      const hallData = hallsMap.get(hallId);
      hallData.seats[seat.seatNo] = seat;
      hallData.seatsList.push(seat);
      hallData.occupiedCount++;
    });

    const resolvedExamName = session.examMaster?.examName || session.examName;
    const resolvedCentreCode = session.examMaster?.centreCode || session.centreCode || '9460';
    const resolvedCentreName = session.examMaster?.centreName || session.centreName || 'Nagercoil Islam College of Engineering and Technology';

    const hallsResult = Array.from(hallsMap.values()).map((h) => {
      // Compute dynamic Anna University Degree & Branch summary (with Common Sub logic)
      const summaryList = AllocationService.computeDegreeBranchSummary(h.seatsList);

      return {
        hallId: h.hall._id,
        hallNumber: h.hall.hallNumber,
        layoutType: h.hall.layoutType,
        capacity: 25,
        occupiedCount: h.occupiedCount,
        seats: h.seats,
        summaryList,
      };
    });

    return res.status(200).json({
      success: true,
      session: {
        ...session,
        examName: resolvedExamName,
        centreCode: resolvedCentreCode,
        centreName: resolvedCentreName,
      },
      totalAllocated: seatings.length,
      halls: hallsResult,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Helper to format continuous register number ranges nicely
function formatRegisterRange(regNos) {
  if (!regNos || regNos.length === 0) return '';
  if (regNos.length === 1) return regNos[0];

  const ranges = [];
  let start = regNos[0];
  let prev = regNos[0];

  const isNumericSuccessor = (a, b) => {
    const matchA = a.match(/^(\D*)(\d+)$/);
    const matchB = b.match(/^(\D*)(\d+)$/);
    if (!matchA || !matchB || matchA[1] !== matchB[1]) return false;
    return BigInt(matchB[2]) - BigInt(matchA[2]) === 1n;
  };

  for (let i = 1; i < regNos.length; i++) {
    const current = regNos[i];
    if (isNumericSuccessor(prev, current)) {
      prev = current;
    } else {
      if (start === prev) {
        ranges.push(start);
      } else {
        ranges.push(`${start} - ${prev}`);
      }
      start = current;
      prev = current;
    }
  }

  if (start === prev) {
    ranges.push(start);
  } else {
    ranges.push(`${start} - ${prev}`);
  }

  return ranges.join(', ');
}

// ==================== 5. CANDIDATE SEAT SEARCH ====================

exports.searchCandidateSeating = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { sessionId, registerNo } = req.query;
    if (!sessionId || !registerNo?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and Register Number are required for search.',
      });
    }

    const regTrimmed = registerNo.trim();
    const seating = await ExamSeating.findOne({
      examSession: sessionId,
      registerNo: new RegExp(`^${regTrimmed}$`, 'i'),
    })
      .populate('examSession')
      .populate('hall')
      .lean();

    if (!seating) {
      return res.status(404).json({
        success: false,
        message: `No seating record found for Register No. '${regTrimmed}' in this exam session.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        registerNo: seating.registerNo,
        name: seating.name,
        subjectCode: seating.subjectCode,
        subjectName: seating.subjectName,
        hallNumber: seating.hallNumber,
        seatNo: seating.seatNo,
        row: seating.row,
        column: seating.column,
        examName: seating.examSession?.examName,
        examDate: seating.examSession?.examDate,
        session: seating.examSession?.session,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
