
import { Chess } from 'chess.js';
import { useMemo } from 'react';
import { getBoardTheme } from '../lib/boardThemes';
import { getPieceSet } from '../lib/pieceSets';



export function CustomChessboard({ fen, boardWidth = 280, orientation = 'white', themeId = 'classic', pieceSetId = 'cburnett' }) {
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

    const theme = getBoardTheme(themeId);
    const pieceSet = getPieceSet(pieceSetId);

    const squareSize = boardWidth / 8;
    const isFlipped = orientation === 'black';

    const renderedRows = isFlipped ? [...board].reverse() : board;
    // If flipped (Black bottom), we want Rank 1 at bottom.
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

                return currentRow.map((piece, cIndex) => {

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
                    const bg = isLight ? theme.lightSquare : theme.darkSquare;

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
                                    src={pieceSet.pieces[piece.color][piece.type]}
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
