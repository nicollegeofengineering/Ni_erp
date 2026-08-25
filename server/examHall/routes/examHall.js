const express = require('express');
const router = express.Router();
const examHallController = require('../controllers/examHallController');

// 0. Exam Masters (Configurations)
router.get('/masters', examHallController.getMasters);
router.post('/masters', examHallController.createMaster);
router.put('/masters/:id', examHallController.updateMaster);
router.delete('/masters/:id', examHallController.deleteMaster);

// 1. Sessions / Schedules
router.get('/sessions', examHallController.getSessions);
router.get('/sessions/:id', examHallController.getSessionById);
router.post('/sessions', examHallController.createSession);
router.put('/sessions/:id', examHallController.updateSession);
router.delete('/sessions/:id', examHallController.deleteSession);

// 2. Candidates & Student DB
router.get('/students/lookup', examHallController.lookupStudents);
router.post('/candidates/import-students', examHallController.importStudents);
router.get('/candidates/:sessionId', examHallController.getCandidates);
router.post('/candidates/range', examHallController.addRangeCandidates);
router.post('/candidates/manual', examHallController.addManualCandidates);
router.put('/candidates/:id', examHallController.updateCandidate);
router.delete('/candidates/:id', examHallController.deleteCandidate);

// 3. Halls
router.get('/halls', examHallController.getHalls);
router.post('/halls', examHallController.createHall);
router.put('/halls/:id', examHallController.updateHall);
router.delete('/halls/:id', examHallController.deleteHall);

// 4. Allocation & Seating
router.post('/allocation/generate', examHallController.generateAllocation);
router.post('/allocation/regenerate', examHallController.regenerateAllocation);
router.delete('/allocation/:sessionId', examHallController.deleteAllocation);
router.get('/seating/:sessionId', examHallController.getSeatingArrangement);

// 5. Candidate Seat Search
router.get('/search', examHallController.searchCandidateSeating);

module.exports = router;
