const mongoose = require('mongoose');
const ExamSession = require('../models/ExamSession');
const ExamCandidate = require('../models/ExamCandidate');
const ExamHall = require('../models/ExamHall');
const ExamSeating = require('../models/ExamSeating');
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

// ==================== 1. SESSIONS ====================

exports.getSessions = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const sessions = await ExamSession.find().sort({ examDate: -1, createdAt: -1 }).lean();
    
    // Enrich with counts
    const enriched = await Promise.all(
      sessions.map(async (sess) => {
        const candidateCount = await ExamCandidate.countDocuments({ examSession: sess._id });
        const seatingCount = await ExamSeating.countDocuments({ examSession: sess._id });
        const allocatedHalls = await ExamSeating.distinct('hall', { examSession: sess._id });
        return {
          ...sess,
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
    const session = await ExamSession.findById(id).lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }
    const candidateCount = await ExamCandidate.countDocuments({ examSession: session._id });
    const seatingCount = await ExamSeating.countDocuments({ examSession: session._id });
    return res.status(200).json({
      success: true,
      data: { ...session, candidateCount, seatingCount },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSession = async (req, res) => {
  if (!checkAuth(req, res)) return;
  try {
    const { examName, examDate, session } = req.body;
    if (!examName?.trim() || !examDate || !session) {
      return res.status(400).json({
        success: false,
        message: 'Exam name, date, and session (FN/AN) are required.',
      });
    }

    const newSession = new ExamSession({
      examName: examName.trim(),
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
    const { examName, examDate, session, status } = req.body;

    const existing = await ExamSession.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exam session not found' });
    }

    if (examName?.trim()) existing.examName = examName.trim();
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

// ==================== 2. CANDIDATES ====================

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
    const { sessionId, subjectCode, subjectName, registerNoFrom, registerNoTo, defaultNamePrefix } = req.body;

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

    // Check if range is pure numeric or has common alphanumeric prefix
    const fromMatch = fromStr.match(/^(\D*)(\d+)$/);
    const toMatch = toStr.match(/^(\D*)(\d+)$/);

    if (!fromMatch || !toMatch || fromMatch[1] !== toMatch[1]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid range format. Prefix must match and suffix must be numeric.',
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

    candidates.forEach((cand, idx) => {
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
    const { registerNo, name, subjectCode, subjectName } = req.body;

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
    if (subjectCode?.trim()) candidate.subjectCode = subjectCode.trim().toUpperCase();
    if (subjectName !== undefined) candidate.subjectName = subjectName.trim();

    await candidate.save();

    // Also update seating record if already allocated
    await ExamSeating.updateMany(
      { candidate: id },
      {
        registerNo: candidate.registerNo,
        name: candidate.name,
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
      // Remove this seat so it becomes empty, or user can regenerate
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
    // Check if seating is currently allocated in this hall
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
        message: `Not enough hall capacity. Total Candidates: ${candidates.length}, Total Capacity: ${totalCapacity}. Please select another hall.`,
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
  // Same logic as generateAllocation, overwriting existing records
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
    const session = await ExamSession.findById(sessionId).lean();
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
          occupiedCount: 0,
          subjectSummary: {},
        });
      }

      const hallData = hallsMap.get(hallId);
      hallData.seats[seat.seatNo] = seat;
      hallData.occupiedCount++;

      // Subject summary
      const sub = seat.subjectCode;
      if (!hallData.subjectSummary[sub]) {
        hallData.subjectSummary[sub] = {
          subjectCode: sub,
          subjectName: seat.subjectName,
          registerNumbers: [],
          count: 0,
        };
      }
      hallData.subjectSummary[sub].registerNumbers.push(seat.registerNo);
      hallData.subjectSummary[sub].count++;
    });

    const hallsResult = Array.from(hallsMap.values()).map((h) => {
      // Format register numbers ranges or list
      const summaryList = Object.values(h.subjectSummary).map((s) => {
        s.registerNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return {
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          count: s.count,
          registerRange: formatRegisterRange(s.registerNumbers),
        };
      });

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
      session,
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
