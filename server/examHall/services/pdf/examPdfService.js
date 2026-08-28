const PDFDocument = require('pdfkit');

// Statically require standard fonts so serverless bundlers (Vercel NFT, AWS Lambda)
// detect and include the font files in the production deployment bundle.
try {
  require('pdfkit/standard-fonts/Helvetica');
  require('pdfkit/standard-fonts/HelveticaBold');
  require('pdfkit/standard-fonts/HelveticaOblique');
  require('pdfkit/standard-fonts/HelveticaBoldOblique');
  require('pdfkit/standard-fonts/TimesRoman');
  require('pdfkit/standard-fonts/TimesBold');
  require('pdfkit/standard-fonts/TimesItalic');
  require('pdfkit/standard-fonts/TimesBoldItalic');
  require('pdfkit/standard-fonts/Courier');
  require('pdfkit/standard-fonts/CourierBold');
  require('pdfkit/standard-fonts/CourierOblique');
  require('pdfkit/standard-fonts/CourierBoldOblique');
  require('pdfkit/standard-fonts/Symbol');
  require('pdfkit/standard-fonts/ZapfDingbats');
} catch (e) {
  // Ignored if handled by standard font loaders
}
const ExamSession = require('../../models/ExamSession');
const ExamMaster = require('../../models/ExamMaster');
const ExamSeating = require('../../models/ExamSeating');
const ExamHall = require('../../models/ExamHall');
const { getLayoutDefinition } = require('../../utils/layoutDefinitions');
const { renderAnnaUniversityHallPage } = require('./annaUniversitySeatingPdf');
const { renderInternalHallPage } = require('./internalSeatingPdf');

/**
 * Orchestrates Exam Seating PDF generation for Anna University and Internal examinations in A4 Landscape.
 */
class ExamPdfService {
  /**
   * Generates a PDF stream or buffer for a given exam session.
   * @param {string} sessionId - ExamSession ObjectId
   * @param {string|null} hallId - Optional filter for a single hall
   * @returns {Promise<PDFDocument>}
   */
  static async generateExamSeatingPdf(sessionId, hallId = null) {
    if (!sessionId) {
      throw new Error('Session ID is required for PDF generation.');
    }

    const session = await ExamSession.findById(sessionId)
      .populate('examMaster')
      .lean();

    if (!session) {
      throw new Error('Exam session not found.');
    }

    // Resolve authoritative exam type and series info from ExamMaster or Session
    const examType = (
      session.examMaster?.examType ||
      session.examType ||
      'ANNA_UNIVERSITY'
    ).toUpperCase();

    const resolvedSession = {
      ...session,
      examType,
      examName: session.examMaster?.examName || session.examName || '',
      examCode: session.examMaster?.examCode || session.examCode || '',
      centreCode: session.examMaster?.centreCode || session.centreCode || '9640',
      centreName:
        session.examMaster?.centreName ||
        session.centreName ||
        'Noorul Islam College of Engineering and Technology',
    };

    // Build filter for seating records
    const seatingFilter = { examSession: sessionId };
    if (hallId) {
      seatingFilter.hall = hallId;
    }

    const seatingRecords = await ExamSeating.find(seatingFilter)
      .populate('hall')
      .sort({ hallNumber: 1, seatNo: 1 })
      .lean();

    if (!seatingRecords || seatingRecords.length === 0) {
      throw new Error('No seating allocation records found for this exam session.');
    }

    // Group seating records by Hall
    const hallsMap = new Map();
    seatingRecords.forEach((seat) => {
      const hId = seat.hall?._id?.toString() || seat.hallNumber;
      if (!hallsMap.has(hId)) {
        hallsMap.set(hId, {
          hallId: hId,
          hallNumber: seat.hallNumber,
          layoutType: seat.hall?.layoutType || 'FIVE_BY_FIVE',
          seats: [],
          occupiedCount: 0,
        });
      }
      const hData = hallsMap.get(hId);
      hData.seats.push(seat);
      hData.occupiedCount++;
    });

    const hallList = Array.from(hallsMap.values()).sort((a, b) =>
      a.hallNumber.localeCompare(b.hallNumber, undefined, { numeric: true })
    );

    if (hallList.length === 0) {
      throw new Error('No halls found with allocated seating in this session.');
    }

    // Create PDF Document in A4 LANDSCAPE mode
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      autoFirstPage: false,
      info: {
        Title: `${resolvedSession.examName} - Seating Arrangement`,
        Author: 'NICETECH ERP System',
        Subject: 'Exam Hall Seating Arrangement',
        Keywords: 'Exam, Seating, Anna University, Internal, NICETECH',
      },
    });

    // Render each hall on its own A4 Landscape page
    hallList.forEach((hallData, index) => {
      doc.addPage({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
      });

      const pageIndex = index + 1;
      const totalPages = hallList.length;

      if (examType === 'INTERNAL') {
        renderInternalHallPage(doc, {
          session: resolvedSession,
          hallData,
          pageIndex,
          totalPages,
        });
      } else {
        renderAnnaUniversityHallPage(doc, {
          session: resolvedSession,
          hallData,
          pageIndex,
          totalPages,
        });
      }
    });

    doc.end();
    return doc;
  }
}

module.exports = ExamPdfService;
