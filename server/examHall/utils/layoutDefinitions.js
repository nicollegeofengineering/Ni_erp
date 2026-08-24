/**
 * Physical Seat Layout Geometries
 * Fixed capacity: 25 seats for both layouts.
 */

const LAYOUTS = {
  FIVE_BY_FIVE: {
    name: '5 × 5',
    type: 'FIVE_BY_FIVE',
    rows: 5,
    cols: 5,
    capacity: 25,
    getGrid: () => {
      const seats = [];
      let seatNo = 1;
      for (let r = 1; r <= 5; r++) {
        for (let c = 1; c <= 5; c++) {
          seats.push({
            seatNo,
            row: r,
            column: c,
          });
          seatNo++;
        }
      }
      return seats;
    },
  },

  FOUR_BY_SIX_PLUS_ONE: {
    name: '4 × 6 + 1',
    type: 'FOUR_BY_SIX_PLUS_ONE',
    rows: 7,
    cols: 4,
    capacity: 25,
    getGrid: () => {
      const seats = [];
      let seatNo = 1;
      // Rows 1 to 6 have 4 columns each (seats 1..24)
      for (let r = 1; r <= 6; r++) {
        for (let c = 1; c <= 4; c++) {
          seats.push({
            seatNo,
            row: r,
            column: c,
          });
          seatNo++;
        }
      }
      // Row 7 has 1 column (seat 25, column 1)
      seats.push({
        seatNo: 25,
        row: 7,
        column: 1,
      });
      return seats;
    },
  },
};

function getLayoutDefinition(layoutType) {
  if (layoutType === 'FOUR_BY_SIX_PLUS_ONE') {
    return LAYOUTS.FOUR_BY_SIX_PLUS_ONE;
  }
  return LAYOUTS.FIVE_BY_FIVE;
}

module.exports = {
  LAYOUTS,
  getLayoutDefinition,
};
