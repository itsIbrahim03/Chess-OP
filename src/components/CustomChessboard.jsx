
import { Chess } from 'chess.js';
import { useMemo } from 'react';

// Piece Images (Standard Lichess/Cburnett style)
const PIECE_IMAGES = {
    w: {
        p: "https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg",
        k: "https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg",
    },
    b: {
        p: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg",
        n: "https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg",
        b: "https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg",
        r: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg",
        q: "https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg",
        k: "https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg",
    },
};

export function CustomChessboard({ fen, boardWidth = 280, orientation = 'white' }) {
    // Use chess.js to derive the board array from the FEN
    const board = useMemo(() => {
        try {
            const chess = new Chess(fen);
            return chess.board(); // 8x8 array of { type: 'p', color: 'w' } | null
        } catch (e) {
            console.error("CustomChessboard: Invalid FEN", fen, e);
            return new Chess().board(); // Fallback to start
        }
    }, [fen]);

    const squareSize = boardWidth / 8;
    const isFlipped = orientation === 'black';

    // Generate ranks and files based on orientation
    const rows = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0].reverse() : [7, 6, 5, 4, 3, 2, 1, 0]; // 0-7 vs 7-0? 
    // chess.board() returns logic generic: [0][0] is a8.
    // We need to render rows 0 to 7. 
    // If white (default): Ranks 8 -> 1. (Row 0 is Rank 8).
    // If we map board.map((row, rIndex)) we get Rank 8, 7, 6... which is correct for White orientation.

    const renderedRows = isFlipped ? [...board].reverse() : board;
    // If flipped (Black bottom), we want Rank 1 at top? No, Rank 1 at bottom.
    // Standard: Rank 8 top. 
    // Flipped: Rank 1 top. 
    // board[0] is Rank 8. board[7] is Rank 1.
    // So if flipped, we want board[7] rendered first.

    return (
        <div
            style={{
                width: boardWidth,
                height: boardWidth,
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gridTemplateRows: "repeat(8, 1fr)",
                border: "1px solid #333",
            }}
        >
            {renderedRows.map((row, rIndex) => {
                // Handle row flip logic for file mapping if needed, but 2D array is simpler.
                // If we flipped the rows array, we simply map.
                // We need to handle internal row flip if 'flipped' (reverse columns?).
                // If Black is bottom: Rank 1 (Row 7) is Top. 
                // And h1 (Col 7) is Left? No, h gets flipped to left.
                // Standard (White): a8 (0,0) is Top-Left.
                // Flipped (Black): h1 (7,7) is Top-Left.

                const currentRow = isFlipped ? [...row].reverse() : row;
                const actualRowIndex = isFlipped ? 7 - rIndex : rIndex;

                return currentRow.map((piece, cIndex) => {
                    const actualColIndex = isFlipped ? 7 - cIndex : cIndex;

                    // Color logic: (row + col) % 2 === 0 ? Light : Dark?
                    // a8 (0,0) is Light. 0+0=0. Correct.
                    // a1 (7,0) is Dark. 7+0=7. Odd=Dark.
                    // Wait, Standard Chess Board: a1 is Black (Dark).
                    // a8 is White (Light).
                    // My math: 0+0=0 (Light). Correct.

                    // NOTE: We used 'renderedRows', so rIndex is visual row (0..7).
                    // We need actual algebraic color.
                    // Square color depends on actual rank/file coordinates.
                    // OR simply visual grid coordinates:
                    // (rIndex + cIndex) % 2 === 0 ? Light : Dark.
                    const isLight = (rIndex + cIndex) % 2 === 0;
                    const bg = isLight ? "#f0d9b5" : "#b58863"; // Classic Wood Colors

                    return (
                        <div
                            key={`${rIndex}-${cIndex}`}
                            style={{
                                width: squareSize,
                                height: squareSize,
                                backgroundColor: bg,
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                position: "relative",
                            }}
                        >
                            {piece && (
                                <img
                                    src={PIECE_IMAGES[piece.color][piece.type]}
                                    alt={`${piece.color}${piece.type}`}
                                    style={{ width: "90%", height: "90%", objectFit: "contain" }}
                                />
                            )}

                            {/* Optional: Coordinates */}
                            {cIndex === 0 && (
                                <span style={{ position: 'absolute', top: 0, left: 1, fontSize: 10, color: isLight ? "#b58863" : "#f0d9b5", fontWeight: 'bold' }}>
                                    {isFlipped ? rIndex + 1 : 8 - rIndex}
                                    {/* White: Row 0 is Rank 8. Black: Row 0 is Rank 1. */}
                                </span>
                            )}
                            {rIndex === 7 && (
                                <span style={{ position: 'absolute', bottom: 0, right: 1, fontSize: 10, color: isLight ? "#b58863" : "#f0d9b5", fontWeight: 'bold' }}>
                                    {String.fromCharCode(97 + (isFlipped ? 7 - cIndex : cIndex))}
                                </span>
                            )}
                        </div>
                    );
                });
            })}
        </div>
    );
}

export default CustomChessboard;
