const { getLayoutDefinition } = require('../../utils/layoutDefinitions');

/**
 * Shared Dynamic Seating Layout Renderer (A4 Landscape)
 * Renders physical columns as vertical PDF seating boxes with complete borders and clean typography.
 *
 * The number of boxes is ALWAYS derived from the physical layout definition:
 *   FIVE_BY_FIVE       → 5 boxes (5 rows each)
 *   FOUR_BY_SIX_PLUS_ONE → 4 boxes (Box 1 = 7 rows, Boxes 2–4 = 6 rows)
 *
 * @param {PDFKit.PDFDocument} doc - Active PDFKit document instance
 * @param {Object} options
 * @param {string} options.layoutType - 'FIVE_BY_FIVE' | 'FOUR_BY_SIX_PLUS_ONE'
 * @param {Array} options.seats - Array of ExamSeating records for the active hall
 * @param {number} options.startY - Y-coordinate where seating blocks should begin
 * @param {number} options.left - Left margin X-coordinate (default: 28)
 * @param {number} options.contentWidth - Total available width (default: 785.89)
 * @param {number} options.availableHeight - Optional max height available for seating section
 * @returns {number} endY - The Y-coordinate after the tallest seating block
 */
function renderSeatingLayout(doc, {
  layoutType = 'FIVE_BY_FIVE',
  seats = [],
  startY = 140,
  left = 28,
  contentWidth = 785.89,
  availableHeight = 0,
}) {
  // 1. Fetch authoritative physical layout definition
  const layout = getLayoutDefinition(layoutType);
  const physicalGrid = layout.getGrid(); // Array of { seatNo, row, column }

  // 2. Map existing seat allocations by seatNo
  const seatMap = new Map();
  seats.forEach((s) => {
    seatMap.set(Number(s.seatNo), s);
  });

  // 3. Determine unique physical columns in ascending order
  const columnNumbers = [...new Set(physicalGrid.map((p) => p.column))].sort((a, b) => a - b);
  const numBoxes = columnNumbers.length; // 5 for FIVE_BY_FIVE, 4 for FOUR_BY_SIX_PLUS_ONE

  // 4. Determine maximum rows per box (needed for height calculation)
  const maxRowsInAnyBox = Math.max(
    ...columnNumbers.map((colNum) =>
      physicalGrid.filter((p) => p.column === colNum).length
    )
  );

  // 5. Calculate dynamic box geometry
  //    Gap between adjacent boxes: slightly wider for fewer boxes
  const boxGap = numBoxes === 5 ? 10 : 14;
  const totalGaps = (numBoxes - 1) * boxGap;
  const boxWidth = (contentWidth - totalGaps) / numBoxes;

  // Seat No column: ~20% of box width; Register No column: ~80%
  const seatNoColWidth = numBoxes === 5 ? Math.round(boxWidth * 0.20) : Math.round(boxWidth * 0.20);
  const regNoColWidth = boxWidth - seatNoColWidth;

  const headerHeight = 22;

  // Calculate row height dynamically to use available vertical space effectively
  let rowHeight;
  if (availableHeight > 0) {
    // Use the available height to determine best row height
    const maxBoxHeight = availableHeight;
    const computedRowHeight = (maxBoxHeight - headerHeight) / maxRowsInAnyBox;
    // Clamp between min and max
    rowHeight = Math.max(22, Math.min(computedRowHeight, 36));
  } else {
    // Default comfortable row heights
    rowHeight = numBoxes === 5 ? 28 : 24;
  }

  let maxY = startY;

  // 6. Render each physical column as one PDF seating box
  columnNumbers.forEach((colNum, colIdx) => {
    // Get all physical positions for this column and sort by row ascending
    const colPositions = physicalGrid
      .filter((p) => p.column === colNum)
      .sort((a, b) => a.row - b.row);

    const boxLeft = left + colIdx * (boxWidth + boxGap);
    const boxSeatCount = colPositions.length;
    const boxTotalHeight = headerHeight + boxSeatCount * rowHeight;

    if (startY + boxTotalHeight > maxY) {
      maxY = startY + boxTotalHeight;
    }

    doc.save();
    doc.lineWidth(0.7);
    doc.strokeColor('#000000');
    doc.fillColor('#000000');

    // 6a. Outer Box Rectangle (Complete border — top, bottom, left, right)
    doc.rect(boxLeft, startY, boxWidth, boxTotalHeight).stroke();

    // 6b. Header Horizontal Divider
    doc.moveTo(boxLeft, startY + headerHeight)
      .lineTo(boxLeft + boxWidth, startY + headerHeight)
      .stroke();

    // 6c. Vertical Divider between Seat No and Register No (Full height from top to bottom)
    const dividerX = boxLeft + seatNoColWidth;
    doc.moveTo(dividerX, startY)
      .lineTo(dividerX, startY + boxTotalHeight)
      .stroke();

    // 6d. Header Labels (Black text on white background — NO fill)
    doc.font('Helvetica-Bold').fontSize(8.5);
    doc.text('Seat\nNo.', boxLeft + 1, startY + 3, {
      width: seatNoColWidth - 2,
      align: 'center',
      lineGap: -1,
    });
    doc.text('Register No.', dividerX + 2, startY + 6.5, {
      width: regNoColWidth - 4,
      align: 'center',
    });

    // 6e. Data Rows
    colPositions.forEach((pos, rIdx) => {
      const rowY = startY + headerHeight + rIdx * rowHeight;

      // Row separator line (between consecutive data rows, NOT after last row)
      if (rIdx < boxSeatCount - 1) {
        doc.moveTo(boxLeft, rowY + rowHeight)
          .lineTo(boxLeft + boxWidth, rowY + rowHeight)
          .stroke();
      }

      // Seat Number (centered vertically and horizontally)
      const seatNoStr = String(pos.seatNo);
      doc.font('Helvetica-Bold').fontSize(10);
      const seatTextY = rowY + (rowHeight - 10) / 2;
      doc.text(seatNoStr, boxLeft + 1, seatTextY, {
        width: seatNoColWidth - 2,
        align: 'center',
      });

      // Register Number (if seat is occupied)
      const allocatedSeat = seatMap.get(pos.seatNo);
      if (allocatedSeat && allocatedSeat.registerNo) {
        const regNoStr = String(allocatedSeat.registerNo);
        // Adaptive font sizing for long register numbers
        let regFontSize = 10;
        if (regNoStr.length > 14) regFontSize = 8;
        else if (regNoStr.length > 12) regFontSize = 8.5;
        else if (regNoStr.length > 10) regFontSize = 9;

        doc.font('Helvetica-Bold').fontSize(regFontSize);
        const regTextY = rowY + (rowHeight - regFontSize) / 2;
        doc.text(regNoStr, dividerX + 4, regTextY, {
          width: regNoColWidth - 8,
          align: 'center',
        });
      }
    });

    doc.restore();
  });

  return maxY;
}

module.exports = {
  renderSeatingLayout,
};
