const path = require('path');
const fs = require('fs');
const AllocationService = require('../allocationService');
const { renderSeatingLayout } = require('./seatingRenderer');

const ASSETS_DIR = path.join(__dirname, '../../../assets/exam-pdf');
const COLLEGE_LOGO_PATH = path.join(ASSETS_DIR, 'nilogo.png');

/**
 * Formats a Date object or string into DD-MM-YYYY
 */
function formatPdfDate(d) {
  if (!d) return 'N/A';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return String(d);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Renders a single hall page for Internal Examination in A4 Landscape.
 *
 * Layout:
 *   Header (centered nilogo.png)
 *   Seating Arrangement (underlined)
 *   Info Box: Exam Name | Hall No. / Date / Session
 *   Seating Boxes (dynamic from layoutType)
 *   Summary Table (Year & Branch, merged Hall No.)
 *   Signatures: Internal exam coordinator / Principal
 *   Page No / Footer
 */
function renderInternalHallPage(doc, { session, hallData, pageIndex = 1, totalPages = 1 }) {
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const left = 28;
  const right = 28;
  const contentWidth = pageWidth - left - right; // 785.89 pt

  // ===================== 1. HEADER =====================
  let currentY = 12;

  // Centered College Logo
  if (fs.existsSync(COLLEGE_LOGO_PATH)) {
    const logoWidth = 440;
    const logoHeight = logoWidth * (287 / 1918); // maintain aspect ratio (~65.8pt)
    const logoX = (pageWidth - logoWidth) / 2;
    doc.image(COLLEGE_LOGO_PATH, logoX, currentY, { width: logoWidth, height: logoHeight });
    currentY += logoHeight + 4;
  } else {
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000');
    doc.text('NOORUL ISLAM COLLEGE OF ENGINEERING AND TECHNOLOGY', left, currentY, {
      width: contentWidth,
      align: 'center',
    });
    currentY += 22;
  }

  // Centered Underlined "Seating Arrangement"
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
  const titleText = 'Seating Arrangement';
  const titleWidth = doc.widthOfString(titleText);
  const titleX = (pageWidth - titleWidth) / 2;
  doc.text(titleText, titleX, currentY);
  doc.lineWidth(0.7).strokeColor('#000000');
  doc.moveTo(titleX, currentY + 13).lineTo(titleX + titleWidth, currentY + 13).stroke();
  currentY += 20;

  // ===================== 2. INFO BOX =====================
  const infoBoxY = currentY;
  const row1Height = 18;
  const row2Height = 18;
  const infoBoxHeight = row1Height + row2Height;

  doc.lineWidth(0.7).strokeColor('#000000');
  doc.rect(left, infoBoxY, contentWidth, infoBoxHeight).stroke();

  // Horizontal divider
  doc.moveTo(left, infoBoxY + row1Height)
    .lineTo(left + contentWidth, infoBoxY + row1Height)
    .stroke();

  // Row 1: Exam Name
  const examName = session.examName || session.examMaster?.examName || 'Internal Examination 1';
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#000000');
  doc.text(`Exam Name :  ${examName}`, left + 8, infoBoxY + 4.5, { width: contentWidth - 16 });

  // Row 2: Hall No, Date, Session
  const hallNoStr = hallData.hallNumber || 'D401';
  const dateStr = formatPdfDate(session.examDate);
  const sessionStr = session.session || 'FN';

  const col1W = 185;
  const col2W = 385;
  const div1X = left + col1W;
  const div2X = left + col1W + col2W;

  doc.moveTo(div1X, infoBoxY + row1Height).lineTo(div1X, infoBoxY + infoBoxHeight).stroke();
  doc.moveTo(div2X, infoBoxY + row1Height).lineTo(div2X, infoBoxY + infoBoxHeight).stroke();

  doc.font('Helvetica-Bold').fontSize(9.5);
  doc.text(`Hall No.: ${hallNoStr}`, left + 8, infoBoxY + row1Height + 4.5);
  doc.text(`Date: ${dateStr}`, div1X + 10, infoBoxY + row1Height + 4.5);
  doc.text(`Session: ${sessionStr}`, div2X + 10, infoBoxY + row1Height + 4.5);

  currentY = infoBoxY + infoBoxHeight + 8;

  // ===================== 3. SEATING ARRANGEMENT =====================
  // Calculate how much vertical space is available for the seating section.
  // Reserve space for: summary (~90pt) + gap (22pt) + signatures (20pt) + pageNo (16pt) + footer (16pt) + bottom margin (10pt)
  const reservedBelow = 170;
  const seatingAvailableHeight = pageHeight - currentY - reservedBelow;

  const seatingEndY = renderSeatingLayout(doc, {
    layoutType: hallData.layoutType || 'FIVE_BY_FIVE',
    seats: hallData.seats || [],
    startY: currentY,
    left,
    contentWidth,
    availableHeight: seatingAvailableHeight,
  });

  currentY = seatingEndY + 10;

  // ===================== 4. SUMMARY TABLE =====================
  const summaryRows = AllocationService.computeDegreeBranchSummary(hallData.seats || [], 'INTERNAL');

  const sumCol0 = 80;  // Hall No.
  const sumCol1 = 245; // Year & Branch
  const sumCol2 = 100;  // Subject Code
  const sumCol3 = 280.89; // Register number of candidated
  const sumCol4 = 80;  // No of candidated

  const colPositions = [
    left,
    left + sumCol0,
    left + sumCol0 + sumCol1,
    left + sumCol0 + sumCol1 + sumCol2,
    left + sumCol0 + sumCol1 + sumCol2 + sumCol3,
    left + contentWidth,
  ];

  const sumHeaderHeight = 20;
  const baseRowHeight = 20;
  const totalRowHeight = 18;

  // Calculate dynamic data row heights based on text content
  const evaluatedRows = (summaryRows.length > 0 ? summaryRows : [
    { degreeBranch: 'N/A', subjectCode: 'N/A', registerNumbers: 'N/A', count: 0 },
  ]).map((row) => {
    const branchText = row.degreeBranch || row.yearBranch || 'N/A';
    doc.font('Helvetica-Bold').fontSize(8.5);
    const textH = doc.heightOfString(branchText, { width: sumCol1 - 10 });
    const height = Math.max(baseRowHeight, textH + 8);
    return { ...row, branchText, height };
  });

  const dataRowsTotalHeight = evaluatedRows.reduce((acc, r) => acc + r.height, 0);
  const summaryTableHeight = sumHeaderHeight + dataRowsTotalHeight + totalRowHeight;
  const tableTop = currentY;

  // Outer table border
  doc.lineWidth(0.7).strokeColor('#000000');
  doc.rect(left, tableTop, contentWidth, summaryTableHeight).stroke();

  // Header divider
  doc.moveTo(left, tableTop + sumHeaderHeight).lineTo(left + contentWidth, tableTop + sumHeaderHeight).stroke();

  // Header vertical dividers
  for (let i = 1; i < colPositions.length - 1; i++) {
    doc.moveTo(colPositions[i], tableTop).lineTo(colPositions[i], tableTop + sumHeaderHeight).stroke();
  }

  // Header labels
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8.5);
  doc.text('Hall No.:', colPositions[0], tableTop + 6, { width: sumCol0, align: 'center' });
  doc.text('Degree & Branch', colPositions[1], tableTop + 6, { width: sumCol1, align: 'center' });
  doc.text('Subject Code', colPositions[2], tableTop + 6, { width: sumCol2, align: 'center' });
  doc.text('Register number of candidates', colPositions[3], tableTop + 6, { width: sumCol3, align: 'center' });
  doc.text('No of\ncandidates', colPositions[4], tableTop + 2.5, { width: sumCol4, align: 'center', lineGap: -1 });

  // Data rows vertical dividers (columns 1–4 only; column 0 is merged)
  for (let i = 1; i < colPositions.length - 1; i++) {
    doc.moveTo(colPositions[i], tableTop + sumHeaderHeight)
      .lineTo(colPositions[i], tableTop + sumHeaderHeight + dataRowsTotalHeight)
      .stroke();
  }

  // Vertically merged Hall No. text (printed ONCE, centered in the merged cell, NO horizontal lines)
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
  const hallNoMergedY = tableTop + sumHeaderHeight + (dataRowsTotalHeight - 10) / 2;
  doc.text(hallNoStr, colPositions[0], hallNoMergedY, { width: sumCol0, align: 'center' });

  // Data rows content
  let rowY = tableTop + sumHeaderHeight;
  let totalCandidates = 0;

  evaluatedRows.forEach((r, idx) => {
    totalCandidates += Number(r.count || 0);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
    doc.text(r.branchText, colPositions[1] + 5, rowY + 5, { width: sumCol1 - 10 });
    doc.text(r.subjectCode || '', colPositions[2], rowY + (r.height - 8.5) / 2, { width: sumCol2, align: 'center' });
    doc.text(r.registerNumbers || '', colPositions[3] + 5, rowY + 5, { width: sumCol3 - 10, align: 'center' });
    doc.text(String(r.count || 0), colPositions[4], rowY + (r.height - 8.5) / 2, { width: sumCol4, align: 'center' });

    // Horizontal row separator (only between rows, from col 1 to end — NOT through merged Hall No.)
    if (idx < evaluatedRows.length - 1) {
      doc.moveTo(colPositions[1], rowY + r.height).lineTo(left + contentWidth, rowY + r.height).stroke();
    }
    rowY += r.height;
  });

  // Total row
  doc.moveTo(left, rowY).lineTo(left + contentWidth, rowY).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
  doc.text('Total:', colPositions[3], rowY + 4.5, { width: sumCol3 - 10, align: 'right' });
  doc.moveTo(colPositions[4], rowY).lineTo(colPositions[4], rowY + totalRowHeight).stroke();
  doc.text(String(totalCandidates), colPositions[4], rowY + 4.5, { width: sumCol4, align: 'center' });

  currentY = tableTop + summaryTableHeight;

  // ===================== 5. SIGNATURES =====================
  // Generous signing room above text (48pt+), positioned lower down near footer
  const sigBlockWidth = 240;
  const sigSidePadding = 20;
  const sigLeftX = left + sigSidePadding;
  const sigRightX = left + contentWidth - sigBlockWidth - sigSidePadding;
  const sigY = Math.max(currentY + 48, pageHeight - 72);

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
  // Left signature — centered within left block
  doc.text('Internal exam coordinator', sigLeftX, sigY, {
    width: sigBlockWidth,
    align: 'center',
  });
  // Right signature — centered within right block
  doc.text('Principal', sigRightX, sigY, {
    width: sigBlockWidth,
    align: 'center',
  });

  // ===================== 6. PAGE NUMBER & FOOTER =====================
  const pageNoY = pageHeight - 32;
  doc.font('Helvetica').fontSize(8.5).fillColor('#64748b');
  doc.text(`Page No: ${pageIndex}`, left, pageNoY, { width: contentWidth, align: 'center' });

  const footerY = pageHeight - 18;
  doc.fontSize(7).fillColor('#94a3b8');
  doc.text('Generated via NICETECH ERP System.', left, footerY, { width: contentWidth, align: 'center' });
}

module.exports = {
  renderInternalHallPage,
};
