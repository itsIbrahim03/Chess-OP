import React, { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import DashboardLayout from '../components/DashboardLayout';
import { ArrowRight, RotateCw, Target, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNextPuzzle, updatePuzzleReview } from '../services/puzzleService';

// Import chessground CSS
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export default function TrainingArena() {
    const { user } = useAuth();
    const boardRef = useRef(null);
    const cgRef = useRef(null);
    const chessRef = useRef(new Chess());

    // Use Ref to hold current puzzle to avoid stale closures in Chessground callbacks
    const puzzleRef = useRef(null);

    const [currentPuzzle, setCurrentPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('active'); // active, success, failure
    const [orientation, setOrientation] = useState('white');
    const [stats, setStats] = useState({ solved: 0, streak: 0 });

    // Track seen puzzles in this session to ensure full rotation (Deck Shuffle)
    const [seenPuzzleIds, setSeenPuzzleIds] = useState([]);

    // Sync state to Ref
    useEffect(() => {
        puzzleRef.current = currentPuzzle;
    }, [currentPuzzle]);

    // Load first puzzle on mount
    useEffect(() => {
        loadNextPuzzle();
    }, [user]);

    async function loadNextPuzzle(retry = false) {
        if (!user) return;
        setLoading(true);
        setStatus('active');

        try {
            // Pass array of all seen IDs to exclude them
            // If retry is true, we cleared the list, so pass empty
            const excludeIds = retry ? [] : seenPuzzleIds;

            const puzzle = await getNextPuzzle(user.uid, excludeIds);

            if (puzzle) {
                // Ensure we use the correct field for color
                const pColor = puzzle.playerColor || puzzle.color || 'white';
                const normalizedPuzzle = { ...puzzle, color: pColor };

                setCurrentPuzzle(normalizedPuzzle);
                setOrientation(pColor);

                // Add to seen list
                if (!retry) {
                    setSeenPuzzleIds(prev => [...prev, puzzle.id]);
                } else {
                    // If retrying (reset), start new list
                    setSeenPuzzleIds([puzzle.id]);
                }

                // Initialize internal chess logic with puzzle FEN
                chessRef.current.load(normalizedPuzzle.fen);

                if (cgRef.current) {
                    configureBoard(normalizedPuzzle);
                }
            } else {
                // No puzzles found excluding the seen ones? 
                if (seenPuzzleIds.length > 0 && !retry) {
                    // We've seen them all! Reset the cycle.
                    console.log("[Arena] All puzzles seen. Resuffling deck.");
                    setSeenPuzzleIds([]);
                    // Recursively call with retry=true (which uses empty exclude list)
                    await loadNextPuzzle(true);
                } else {
                    console.log("[Arena] No puzzles found at all.");
                }
            }
        } catch (error) {
            console.error("Failed to load puzzle:", error);
        } finally {
            setLoading(false);
        }
    }

    // Initialize/Reconfigure board
    useEffect(() => {
        if (!boardRef.current || !currentPuzzle) return;

        if (!cgRef.current) {
            // First initialization
            cgRef.current = Chessground(boardRef.current, {
                fen: currentPuzzle.fen,
                orientation: orientation,
                turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                animation: { enabled: true, duration: 200 },
                movable: {
                    free: false,
                    color: currentPuzzle.color,
                    dests: getLegalMoves(),
                    events: { after: onMove }
                },
                highlight: { lastMove: true, check: true }
            });
        } else {
            configureBoard(currentPuzzle);
        }
    }, [currentPuzzle, orientation]);

    function configureBoard(puzzle) {
        cgRef.current.set({
            fen: puzzle.fen,
            orientation: puzzle.color,
            turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
            lastMove: null,
            movable: {
                color: puzzle.color,
                dests: getLegalMoves()
            },
            drawable: { shapes: [] } // Clear arrows
        });
    }

    function getLegalMoves() {
        const dests = new Map();
        chessRef.current.moves({ verbose: true }).forEach(move => {
            if (!dests.has(move.from)) dests.set(move.from, []);
            dests.get(move.from).push(move.to);
        });
        return dests;
    }

    async function onMove(from, to) {
        // ALWAYS use the Ref to get the latest puzzle state
        const puzzle = puzzleRef.current;
        if (!puzzle) return;

        // 1. Check for promotion (auto-queen for simplicity)
        const moves = chessRef.current.moves({ verbose: true });
        const isPromotion = moves.some(m => m.from === from && m.to === to && m.promotion);

        // Construct UCI move for comparison
        const uciMove = from + to + (isPromotion ? 'q' : '');

        // 2. Validate against solution
        const isCorrect = uciMove === puzzle.correctMove;

        if (isCorrect) {
            // --- SUCCESS ---
            setStatus('success');

            // Execute move on internal logic
            chessRef.current.move({ from, to, promotion: 'q' });

            // Freeze board
            cgRef.current.set({
                fen: chessRef.current.fen(),
                movable: { color: null, dests: new Map() }
            });

            // Update Stats
            setStats(prev => ({
                solved: prev.solved + 1,
                streak: prev.streak + 1
            }));

            // Save (Suppress errors if permissions fail)
            try {
                await updatePuzzleReview(user.uid, puzzle.id, true, 0);
            } catch (e) { }

        } else {
            // --- FAILURE ---
            setStatus('failure');

            // Reset Streak
            setStats(prev => ({ ...prev, streak: 0 }));

            // Show Critical Feedback
            const bestMoveFrom = puzzle.correctMove.substring(0, 2);
            const bestMoveTo = puzzle.correctMove.substring(2, 4);

            cgRef.current.setShapes([
                { orig: from, dest: to, brush: 'red' },       // User's bad move
                { orig: bestMoveFrom, dest: bestMoveTo, brush: 'green' } // The correct move
            ]);

            // Save (Suppress errors)
            try {
                await updatePuzzleReview(user.uid, puzzle.id, false, 0);
            } catch (e) { }

            // Snap back after delay
            setTimeout(() => {
                cgRef.current.set({
                    fen: puzzle.fen,
                    turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                    movable: {
                        color: puzzle.color,
                        dests: getLegalMoves()
                    },
                    drawable: { shapes: [] }
                });
                setStatus('active');
            }, 1500);
        }
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-8">

                {/* Board Column */}
                <div className="flex-1 flex items-center justify-center p-4 bg-chess-panel border border-white/5 rounded-2xl">
                    <div
                        ref={boardRef}
                        className="w-full max-w-[600px] aspect-square rounded-lg shadow-2xl overflow-hidden"
                    />
                </div>

                {/* Sidebar Column */}
                <div className="w-full lg:w-96 flex flex-col gap-4">

                    {/* Status Card */}
                    <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        {loading ? (
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-chess-accent"></div>
                        ) : currentPuzzle ? (
                            <>
                                <h2 className="text-2xl font-bold text-white">
                                    {status === 'active' && 'Solve this!'}
                                    {status === 'success' && <span className="text-green-400 flex items-center gap-2"><CheckCircle2 /> Correct!</span>}
                                    {status === 'failure' && <span className="text-red-400 flex items-center gap-2"><XCircle /> Incorrect</span>}
                                </h2>

                                <p className="text-chess-text-secondary">
                                    {currentPuzzle.rating ? `Rating: ${currentPuzzle.rating}` : 'Unrated Puzzle'}
                                </p>

                                <div className="pt-8 w-full">
                                    <button
                                        onClick={() => loadNextPuzzle(false)}
                                        className="w-full py-4 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <ArrowRight />
                                        Next Puzzle
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-chess-text-secondary">
                                <Target size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No puzzles found. Analyze some games first!</p>
                            </div>
                        )}
                    </div>

                    {/* Stats Card */}
                    <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl">
                        <h3 className="text-sm font-bold text-chess-text-secondary uppercase mb-4">Session Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-white/5 rounded-lg">
                                <div className="text-2xl font-bold text-white">{stats.solved}</div>
                                <div className="text-xs text-chess-text-secondary">Solved</div>
                            </div>
                            <div className="p-3 bg-white/5 rounded-lg">
                                <div className="text-2xl font-bold text-green-400">{stats.streak}</div>
                                <div className="text-xs text-chess-text-secondary">Streak</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}
