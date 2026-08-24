const { getLayoutDefinition } = require('../utils/layoutDefinitions');
const ExamSeating = require('../models/ExamSeating');
const ExamSession = require('../models/ExamSession');

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
    // Allocate candidate batches per hall roughly proportionally to subject sizes
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
}

module.exports = AllocationService;
