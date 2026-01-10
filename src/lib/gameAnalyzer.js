import { Chess } from 'chess.js';
import { OpeningDetector } from './openingDetector';
import { engineService } from '../services/engineService';

/**
 * Core engine to analyze games and find blunders/critical opening moments.
 * Implements the "Smart Hybrid Model":
 * 1. Moves 1-10 only.
 * 2. Opening Book Check (Theory).
 * 3. Stockfish Check (Tactics) on deviation.
 */
export class GameAnalyzer {
    /**
     * Analyzes a single game for tactical mistakes at critical junctures.
     * @param {Object} game - Game object from Lichess (with pgn).
     * @param {string} playerColor - 'white' or 'black'.
     * @returns {Promise<Array>} - Array of found puzzles.
     */
    async analyze(game, playerColor) {
        const chess = new Chess();
        const puzzles = [];

        try {
            chess.loadPgn(game.pgn);
            // Limit analysis to the first 10 moves (20 plies) as per "Core Analysis Pipeline"
            const maxPlies = Math.min(chess.history().length, 20);

            // NEW APPROACH (V3): Single Source of Truth
            // We load the PGN into 'chess'. It validates the game.
            // We then RESET 'chess' and replay the moves one by one.
            // This guarantees that the move being analyzed is legal and the FEN is correct.

            // 1. Extract valid history from the loaded game
            const history = chess.history({ verbose: true });

            // 2. Reset the board to start from scratch
            chess.reset();

            // OPTIMIZATION: Calculate skip usage
            let skipUntilIndex = 0;
            if (game.opening && typeof game.opening.ply === 'number') {
                skipUntilIndex = Math.max(0, game.opening.ply - 2);
            }

            for (let i = 0; i < maxPlies; i++) {
                const move = history[i];

                // FEN BEFORE the move (This is the puzzle start position)
                const fenBefore = chess.fen();

                // EXECUTE MOVE on the main instance (Guaranteed to work as it came from history)
                try {
                    const result = chess.move(move.san);
                    if (!result) throw new Error("Move execution returned null");
                } catch (e) {
                    console.error(`Fatal Replay Error at move ${i}: ${move.san}`, e);
                    break;
                }

                const fenAfter = chess.fen();

                // SKIP LOGIC
                if (i < skipUntilIndex) {
                    continue;
                }

                // CHECK PLAYER TURN
                // If it's White's turn (i=0,2...), playerColor must be white to analyze user blunder.
                // If i=0 (White), and player is White -> TRUE.
                const isPlayerTurn = (move.color === 'w' && playerColor === 'white') ||
                    (move.color === 'b' && playerColor === 'black');

                if (!isPlayerTurn) {
                    continue;
                }

                // FALLBACK BOOK CHECK
                if (OpeningDetector.isInBook(fenAfter)) {
                    continue;
                }

                // --- ANALYSIS ---

                // 1. Pre-Move Analysis (Best Move)
                const preMoveAnalysis = await engineService.evaluatePosition(fenBefore, 15);

                // 2. Post-Move Analysis (User Accuracy)
                const postMoveAnalysis = await engineService.evaluatePosition(fenAfter, 12);
                const userMoveScore = -postMoveAnalysis.score;

                // 3. Loss Calculation
                const evalLoss = preMoveAnalysis.score - userMoveScore;

                if (evalLoss > 100) {
                    // Check if already lost (-2.5)
                    if (preMoveAnalysis.score < -250) {
                        continue;
                    }

                    // RESOLVE OPENING NAME
                    // Prioritize Lichess Data -> Then Internal Detection -> Then Default
                    let openingName = "Unknown Opening";
                    if (game.opening && game.opening.name) {
                        openingName = game.opening.name;
                    } else {
                        const detected = OpeningDetector.detect(fenBefore);
                        if (detected) openingName = detected.name;
                    }

                    puzzles.push({
                        id: `${game.id}-${i}`,
                        fen: fenBefore, // Use Full, Valid FEN from chess.js
                        correctMove: preMoveAnalysis.bestMove,
                        playerMove: move.lan,
                        playedSan: move.san,
                        openingName: openingName,
                        evaluation: userMoveScore,
                        bestEvaluation: preMoveAnalysis.score,
                        evalLoss: evalLoss,
                        gameUrl: `https://lichess.org/${game.id}#${i}`,
                        tags: ["Opening Blunder"],
                        playerColor: playerColor
                    });
                }
            }

            return puzzles;
        } catch (error) {
            console.error("Game analysis failed:", error);
            return [];
        }
    }
}

export const gameAnalyzer = new GameAnalyzer();
