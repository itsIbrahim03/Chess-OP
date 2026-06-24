/**
 * Piece set definitions for Chess-OP
 * Each set maps color+piece to an SVG URL
 */

const LICHESS_CDN = 'https://lichess1.org/assets/piece';

const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

// Helper to generate Lichess piece URLs
function lichessSet(setName) {
  const pieces = { w: {}, b: {} };
  PIECE_TYPES.forEach(type => {
    pieces.w[type] = `${LICHESS_CDN}/${setName}/w${type.toUpperCase()}.svg`;
    pieces.b[type] = `${LICHESS_CDN}/${setName}/b${type.toUpperCase()}.svg`;
  });
  return pieces;
}

export const PIECE_SETS = [
  {
    id: 'cburnett',
    name: 'Cburnett',
    pieces: {
      w: {
        p: '/pieces/cburnett/wP.svg',
        n: '/pieces/cburnett/wN.svg',
        b: '/pieces/cburnett/wB.svg',
        r: '/pieces/cburnett/wR.svg',
        q: '/pieces/cburnett/wQ.svg',
        k: '/pieces/cburnett/wK.svg',
      },
      b: {
        p: '/pieces/cburnett/bP.svg',
        n: '/pieces/cburnett/bN.svg',
        b: '/pieces/cburnett/bB.svg',
        r: '/pieces/cburnett/bR.svg',
        q: '/pieces/cburnett/bQ.svg',
        k: '/pieces/cburnett/bK.svg',
      },
    },
  },
  {
    id: 'alpha',
    name: 'Alpha',
    pieces: lichessSet('alpha'),
  },
  {
    id: 'merida',
    name: 'Merida',
    pieces: lichessSet('merida'),
  },
  {
    id: 'staunty',
    name: 'Staunty',
    pieces: lichessSet('staunty'),
  },
  {
    id: 'tatiana',
    name: 'Tatiana',
    pieces: lichessSet('tatiana'),
  },
  {
    id: 'leipzig',
    name: 'Leipzig',
    pieces: lichessSet('leipzig'),
  },
  {
    id: 'governor',
    name: 'Governor',
    pieces: lichessSet('governor'),
  },
  {
    id: 'california',
    name: 'California',
    pieces: lichessSet('california'),
  },
];

export const PIECE_SET_MAP = Object.fromEntries(PIECE_SETS.map(s => [s.id, s]));

export function getPieceSet(setId) {
  return PIECE_SET_MAP[setId] || PIECE_SETS[0];
}

// Get piece image URL for a specific set, color and type
export function getPieceImageUrl(setId, color, type) {
  const set = getPieceSet(setId);
  return set.pieces[color]?.[type] || '';
}
