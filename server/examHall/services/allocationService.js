const { getLayoutDefinition } = require('../utils/layoutDefinitions');
const ExamSeating = require('../models/ExamSeating');
const ExamSession = require('../models/ExamSession');

/**
 * Helper to convert year number/string to Roman numeral year label (e.g. "III Year")
 */
function getRomanYearLabel(year, yearString) {
  if (yearString && yearString.trim()) {
    const ys = yearString.trim();
    if (/year/i.test(ys)) return ys;
    return `${ys} Year`;
  }
  const yNum = Number(year);
  if (yNum === 1) return 'I Year';
  if (yNum === 2) return 'II Year';
  if (yNum === 3) return 'III Year';
  if (yNum === 4) return 'IV Year';
  if (yNum === 5) return 'V Year';
  if (yNum === 6) return 'VI Year';
  return '';
}

/**
 * Formats Degree & Branch string (e.g. "B.E. Computer Science and Engineering")
 */
function formatDegreeBranch(prog = '', dept = '', deptCode = '') {
  const p = (prog || '').trim() || 'B.E.';
  const d = (dept || deptCode || '').trim();
  if (!d) return p;
  // If dept already includes the degree prefix (e.g. "B.E. CSE"), return as is
  if (d.startsWith(p) || /^b\.?e\.?/i.test(d) || /^b\.?tech\.?/i.test(d) || /^m\.?e\.?/i.test(d) || /^m\.?tech\.?/i.test(d)) {
    return d;
  }
  return `${p} ${d}`;
}

/**
 * Formats Year & Branch string for Internal exams (e.g. "III Year – B.E. Computer Science and Engineering")
 */
function formatYearBranch(year, yearString, prog, dept, deptCode, regNo = '') {
  let yearLabel = getRomanYearLabel(year, yearString);
  if (!yearLabel && regNo) {
    // Infer year from register number prefix (e.g. 23CSE001 -> 23 -> III Year in 2026)
    const match = String(regNo).match(/^([A-Za-z0-9]*?)(\d{2})([A-Za-z]+)/);
    if (match && match[2]) {
      const batch2Digits = parseInt(match[2], 10);
      const batchYear = 2000 + batch2Digits;
      const currentYear = new Date().getFullYear();
      const diff = currentYear - batchYear + 1;
      if (diff >= 1 && diff <= 6) {
        yearLabel = getRomanYearLabel(diff);
      }
    }
  }
  const degreeBranch = formatDegreeBranch(prog, dept, deptCode);
  if (yearLabel) {
    return `${yearLabel} – ${degreeBranch}`;
  }
  return degreeBranch;
}

/**
 * Backend Exam Hall Allocation Service
 */
class AllocationService {
  /**
   * Generates seating arrangement for an exam session across chosen halls.
   */
  static generateAllocation(candidates, halls) {
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates found for allocation.');
    }
    if (!halls || halls.length === 0) {
      throw new Error('No halls provided for allocation.');
    }

    const totalCapacity = halls.length * 25;
    if (candidates.length > totalCapacity) {
      throw new Error(
        `Not enough hall capacity. Total candidates: ${candidates.length}, Total capacity: ${totalCapacity}. Please add more halls.`
      );
    }

    // 1. Group candidates by subjectCode
    const subjectMap = new Map();
    candidates.forEach((cand) => {
      const code = (cand.subjectCode || '').trim().toUpperCase();
      if (!subjectMap.has(code)) {
        subjectMap.set(code, []);
      }
      subjectMap.get(code).push(cand);
    });

    // Sort candidates inside each subject group by registerNo
    for (const [code, list] of subjectMap.entries()) {
      list.sort((a, b) => a.registerNo.localeCompare(b.registerNo, undefined, { numeric: true }));
    }

    // 2. Distribute candidate pools across halls
    const hallAllocations = [];
    const availableHalls = [...halls];

    // Create a pool of subject queues
    const subjectQueues = new Map();
    for (const [code, list] of subjectMap.entries()) {
      subjectQueues.set(code, [...list]);
    }

    let remainingCandidateCount = candidates.length;

    for (let hIndex = 0; hIndex < availableHalls.length; hIndex++) {
      const hall = availableHalls[hIndex];
      const layoutDef = getLayoutDefinition(hall.layoutType);
      const gridSeats = layoutDef.getGrid(); // Array of { seatNo, row, column }

      // Number of candidates to place in this hall (min 25, or remaining)
      const seatsToFill = Math.min(25, remainingCandidateCount);
      if (seatsToFill <= 0) break;

      // 2D grid matrix to track placed subjects for fast neighbor lookup: matrix[row][col] = subjectCode
      const matrix = {};
      for (let r = 1; r <= layoutDef.rows; r++) {
        matrix[r] = {};
      }

      const hallSeatingRecords = [];

      for (let sIndex = 0; sIndex < seatsToFill; sIndex++) {
        const seat = gridSeats[sIndex];
        const r = seat.row;
        const c = seat.column;

        // Find neighboring subjects
        const neighborSubjects = new Set();
        if (matrix[r]?.[c - 1]) neighborSubjects.add(matrix[r][c - 1]); // Left
        if (matrix[r]?.[c + 1]) neighborSubjects.add(matrix[r][c + 1]); // Right
        if (matrix[r - 1]?.[c]) neighborSubjects.add(matrix[r - 1][c]); // Up
        if (matrix[r + 1]?.[c]) neighborSubjects.add(matrix[r + 1][c]); // Down

        // Find best subject queue:
        // Priority 1: Queue with candidates whose subject is NOT in neighborSubjects, sorted by largest remaining queue
        let chosenSubjectCode = null;
        let largestCount = -1;

        // Check non-conflicting subjects
        for (const [subCode, queue] of subjectQueues.entries()) {
          if (queue.length > 0 && !neighborSubjects.has(subCode)) {
            if (queue.length > largestCount) {
              largestCount = queue.length;
              chosenSubjectCode = subCode;
            }
          }
        }

        // Fallback: If all available subjects conflict, pick the subject queue with the largest remaining count
        if (!chosenSubjectCode) {
          largestCount = -1;
          for (const [subCode, queue] of subjectQueues.entries()) {
            if (queue.length > 0 && queue.length > largestCount) {
              largestCount = queue.length;
              chosenSubjectCode = subCode;
            }
          }
        }

        if (!chosenSubjectCode) {
          // No more candidates in any queue
          break;
        }

        const candidate = subjectQueues.get(chosenSubjectCode).shift();
        remainingCandidateCount--;

        // Place on matrix
        matrix[r][c] = candidate.subjectCode;

        hallSeatingRecords.push({
          hall: hall._id,
          hallNumber: hall.hallNumber,
          seatNo: seat.seatNo,
          row: seat.row,
          column: seat.column,
          candidate: candidate._id,
          registerNo: candidate.registerNo,
          name: candidate.name,
          programme: candidate.programme || 'B.Tech',
          department: candidate.department || '',
          departmentCode: candidate.departmentCode || '',
          year: candidate.year || null,
          yearString: candidate.yearString || '',
          subjectCode: candidate.subjectCode,
          subjectName: candidate.subjectName || '',
        });
      }

      hallAllocations.push({
        hall,
        layout: layoutDef,
        seats: hallSeatingRecords,
      });
    }

    return hallAllocations;
  }

  /**
   * Formats sorted register numbers into range strings (e.g. "946023AIDS001 - 946023AIDS025")
   */
  static formatRegisterNumberRanges(regNos = []) {
    if (!regNos || regNos.length === 0) return '';
    if (regNos.length === 1) return regNos[0];

    const sorted = [...regNos].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    const ranges = [];
    let rangeStart = sorted[0];
    let prevReg = sorted[0];

    const parseReg = (r) => {
      const match = String(r).match(/^(.*?)([0-9]+)$/);
      if (!match) return { prefix: String(r), num: null, raw: String(r) };
      return {
        prefix: match[1],
        num: BigInt(match[2]),
        digits: match[2].length,
        raw: String(r),
      };
    };

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const prevParsed = parseReg(prevReg);
      const currParsed = parseReg(curr);

      if (
        prevParsed.num !== null &&
        currParsed.num !== null &&
        prevParsed.prefix === currParsed.prefix &&
        currParsed.num === prevParsed.num + 1n
      ) {
        prevReg = curr;
      } else {
        if (rangeStart === prevReg) {
          ranges.push(rangeStart);
        } else {
          ranges.push(`${rangeStart} - ${prevReg}`);
        }
        rangeStart = curr;
        prevReg = curr;
      }
    }

    if (rangeStart === prevReg) {
      ranges.push(rangeStart);
    } else {
      ranges.push(`${rangeStart} - ${prevReg}`);
    }

    return ranges.join(', ');
  }

  /**
   * Computes the official summary for a hall's seating according to exam type.
   * Completely REMOVES "Common Sub".
   * For ANNA_UNIVERSITY: Groups by (Degree & Branch, Subject Code).
   * For INTERNAL: Groups by (Year & Branch).
   */
  static computeDegreeBranchSummary(seats = [], examType = 'ANNA_UNIVERSITY') {
    if (!seats || seats.length === 0) return [];

    const isInternal = String(examType).toUpperCase() === 'INTERNAL';

    if (isInternal) {
      // Group by Year & Branch
      const groupMap = new Map();

      seats.forEach((s) => {
        const yearBranch = formatYearBranch(
          s.year,
          s.yearString,
          s.programme,
          s.department,
          s.departmentCode,
          s.registerNo
        );
        const groupKey = yearBranch;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            yearBranch,
            subjectCode: (s.subjectCode || '').trim().toUpperCase(),
            subjectName: s.subjectName || '',
            seats: [],
          });
        }
        groupMap.get(groupKey).seats.push(s);
      });

      const summaryList = [];

      for (const [key, group] of groupMap.entries()) {
        const sortedSeats = group.seats.sort((a, b) =>
          a.registerNo.localeCompare(b.registerNo, undefined, { numeric: true })
        );

        const registerNumbers = AllocationService.formatRegisterNumberRanges(
          sortedSeats.map((st) => st.registerNo)
        );

        summaryList.push({
          yearBranch: group.yearBranch,
          degreeBranch: group.yearBranch,
          subjectCode: group.subjectCode,
          subjectName: group.subjectName,
          registerNumbers,
          count: sortedSeats.length,
        });
      }

      // Sort deterministically by yearBranch
      summaryList.sort((a, b) => a.yearBranch.localeCompare(b.yearBranch));
      return summaryList;
    }

    // ANNA_UNIVERSITY: Group by (Degree & Branch, Subject Code)
    const groupMap = new Map();

    seats.forEach((s) => {
      const degreeBranch = formatDegreeBranch(
        s.programme,
        s.department,
        s.departmentCode
      );
      const subCode = (s.subjectCode || '').trim().toUpperCase();
      const groupKey = `${degreeBranch}___${subCode}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          degreeBranch,
          subjectCode: subCode,
          subjectName: s.subjectName || '',
          seats: [],
        });
      }
      groupMap.get(groupKey).seats.push(s);
    });

    const summaryList = [];

    for (const [key, group] of groupMap.entries()) {
      const sortedSeats = group.seats.sort((a, b) =>
        a.registerNo.localeCompare(b.registerNo, undefined, { numeric: true })
      );

      const registerNumbers = AllocationService.formatRegisterNumberRanges(
        sortedSeats.map((st) => st.registerNo)
      );

      summaryList.push({
        degreeBranch: group.degreeBranch,
        subjectCode: group.subjectCode,
        subjectName: group.subjectName,
        registerNumbers,
        count: sortedSeats.length,
      });
    }

    // Sort deterministically by degreeBranch, then subjectCode
    summaryList.sort((a, b) => {
      const dbCmp = a.degreeBranch.localeCompare(b.degreeBranch);
      if (dbCmp !== 0) return dbCmp;
      return a.subjectCode.localeCompare(b.subjectCode);
    });

    return summaryList;
  }
}

module.exports = AllocationService;
