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
        p: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
        n: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
        b: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
        r: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
        q: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
        k: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
      },
      b: {
        p: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
        n: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
        b: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
        r: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
        q: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
        k: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
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
