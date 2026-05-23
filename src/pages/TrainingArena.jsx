import React, { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import DashboardLayout from '../components/DashboardLayout';
import { ArrowRight, Target, CheckCircle2, XCircle, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    getNextPuzzle,
    getPuzzleById,
    updatePuzzleReview,
    toggleFavorite
} from '../services/puzzleService';
import { incrementTotalSolved } from '../services/userService';

// Import chessground CSS
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export default function TrainingArena() {
    const { user } = useAuth();
    const boardRef = useRef(null);
    const cgRef = useRef(null);
    const chessRef = useRef(new Chess());
    const puzzleRef = useRef(null);

    const [currentPuzzle, setCurrentPuzzle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('active');
    const [orientation, setOrientation] = useState('white');
    const [stats, setStats] = useState({ solved: 0, streak: 0 });
    const [isFavorited, setIsFavorited] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const [toastError, setToastError] = useState(null);
    const [seenPuzzleIds, setSeenPuzzleIds] = useState([]);

    // Sync state to ref (avoids stale closures in Chessground callbacks)
    useEffect(() => {
        puzzleRef.current = currentPuzzle;
        setIsFavorited(currentPuzzle?.isFavorite ?? false);
    }, [currentPuzzle]);

    // ─── On Mount: check for ?puzzleId= in URL ──────────────────────────────
    useEffect(() => {
        if (!user) return;
        // Read DIRECTLY from window.location so we always get the real URL,
        // not React's potentially-stale searchParams state.
        const params = new URLSearchParams(window.location.search);
        const specificId = params.get('puzzleId');

        if (specificId) {
            loadSpecificPuzzle(specificId);
        } else {
            loadNextPuzzle();
        }
    }, [user]);

    // ─── Load a specific puzzle by Firestore document ID ────────────────────
    async function loadSpecificPuzzle(puzzleId) {
        setLoading(true);
        setStatus('active');
        try {
            const puzzle = await getPuzzleById(puzzleId);
            if (puzzle) {
                const success = applyPuzzle(puzzle);
                if (!success) {
                    await loadNextPuzzle();
                }
            } else {
                console.warn('Specific puzzle not found, falling back to next puzzle');
                await loadNextPuzzle();
            }

        } catch (e) {
            console.error('loadSpecificPuzzle failed:', e);
            await loadNextPuzzle();
        } finally {
            setLoading(false);
        }
    }

    // ─── Load next puzzle in rotation ───────────────────────────────────────
    async function loadNextPuzzle(retry = false) {
        if (!user) return;
        setLoading(true);
        setStatus('active');
        try {
            const excludeIds = retry ? [] : seenPuzzleIds;
            const puzzle = await getNextPuzzle(user.uid, excludeIds);

            if (puzzle) {
                applyPuzzle(puzzle);
                if (!retry) {
                    setSeenPuzzleIds(prev => [...prev, puzzle.id]);
                } else {
                    setSeenPuzzleIds([puzzle.id]);
                }
            } else {
                if (seenPuzzleIds.length > 0 && !retry) {
                    setSeenPuzzleIds([]);
                    await loadNextPuzzle(true);
                }
            }
        } catch (error) {
            console.error('Failed to load puzzle:', error);
        } finally {
            setLoading(false);
        }
    }

    // ─── Shared: set puzzle state + chess engine ─────────────────────────────
    function applyPuzzle(puzzle) {
        if (!puzzle.fen) {
            console.error('Puzzle data is incomplete (missing FEN):', puzzle);
            setToastError('Incomplete puzzle data found. Please use "Reset All Puzzle Data" in Settings and re-analyze.');
            return false;
        }
        const pColor = puzzle.playerColor || puzzle.color || 'white';
        const normalized = { ...puzzle, color: pColor };
        setCurrentPuzzle(normalized);
        setOrientation(pColor);
        chessRef.current.load(normalized.fen);
        return true;
    }


    // ─── Board: initialize or reconfigure when puzzle changes ───────────────
    useEffect(() => {
        if (!boardRef.current || !currentPuzzle) return;

        if (!cgRef.current) {
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
    }, [currentPuzzle?.id, orientation]); // Only reconfigure on new puzzle, not on metadata changes like isFavorite

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
            drawable: { shapes: [] }
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
        const puzzle = puzzleRef.current;
        if (!puzzle) return;

        const moves = chessRef.current.moves({ verbose: true });
        const isPromotion = moves.some(m => m.from === from && m.to === to && m.promotion);
        const uciMove = from + to + (isPromotion ? 'q' : '');
        const isCorrect = uciMove === puzzle.correctMove;

        if (isCorrect) {
            setStatus('success');
            chessRef.current.move({ from, to, promotion: 'q' });
            cgRef.current.set({
                fen: chessRef.current.fen(),
                movable: { color: null, dests: new Map() }
            });
            setStats(prev => ({ solved: prev.solved + 1, streak: prev.streak + 1 }));

            try { await updatePuzzleReview(user.uid, puzzle.id, true, 0); }
            catch (e) { console.warn('updatePuzzleReview failed:', e); }

            try { await incrementTotalSolved(user.uid); }
            catch (e) { console.warn('incrementTotalSolved failed:', e); }

        } else {
            setStatus('failure');
            setStats(prev => ({ ...prev, streak: 0 }));

            const bestMoveFrom = puzzle.correctMove.substring(0, 2);
            const bestMoveTo = puzzle.correctMove.substring(2, 4);
            cgRef.current.setShapes([
                { orig: from, dest: to, brush: 'red' },
                { orig: bestMoveFrom, dest: bestMoveTo, brush: 'green' }
            ]);

            try { await updatePuzzleReview(user.uid, puzzle.id, false, 0); }
            catch (e) { console.warn('updatePuzzleReview failed:', e); }

            setTimeout(() => {
                cgRef.current.set({
                    fen: puzzle.fen,
                    turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                    movable: { color: puzzle.color, dests: getLegalMoves() },
                    drawable: { shapes: [] }
                });
                setStatus('active');
            }, 1500);
        }
    }

    async function handleToggleFavorite() {
        const puzzle = puzzleRef.current;
        if (!puzzle || favoriteLoading) return;

        setFavoriteLoading(true);
        const newFavState = !isFavorited;
        setIsFavorited(newFavState);
        setToastError(null);

        try {
            await toggleFavorite(user.uid, puzzle.id, newFavState);
            // Do NOT call setCurrentPuzzle here — it would re-trigger the board useEffect
            // and reset the board position. isFavorited state already handles the UI.

        } catch (e) {
            console.error('toggleFavorite failed:', e.code, e.message);
            setIsFavorited(!newFavState);
            setToastError(e.code === 'permission-denied'
                ? 'Permission denied — check your Firestore rules.'
                : `Star failed: ${e.message}`);
            setTimeout(() => setToastError(null), 5000);
        } finally {
            setFavoriteLoading(false);
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

                    {/* Toast Error */}
                    {toastError && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl flex items-start gap-2">
                            <span className="shrink-0 mt-0.5">⚠️</span>
                            <span>{toastError}</span>
                        </div>
                    )}

                    {/* Status Card */}
                    <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        {loading ? (
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-chess-accent"></div>
                        ) : currentPuzzle ? (
                            <>
                                {/* Puzzle name + favorite button */}
                                <div className="w-full flex items-start justify-between">
                                    <div className="text-left">
                                        <p className="text-chess-text-secondary text-xs uppercase tracking-widest mb-1">Current Puzzle</p>
                                        <p className="text-white font-bold text-sm truncate max-w-[220px]">
                                            {currentPuzzle.customName || currentPuzzle.opening || 'Opening Puzzle'}
                                        </p>
                                    </div>
                                    {/* Star / Favorite Button */}
                                    <button
                                        onClick={handleToggleFavorite}
                                        disabled={favoriteLoading}
                                        title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                                        className={`p-2 rounded-lg transition-all ${
                                            isFavorited
                                                ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                                                : 'text-chess-text-secondary hover:text-yellow-400 hover:bg-yellow-400/10'
                                        } ${favoriteLoading ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <Star size={22} fill={isFavorited ? 'currentColor' : 'none'} />
                                    </button>
                                </div>

                                <h2 className="text-2xl font-bold text-white w-full text-center">
                                    {status === 'active' && 'Solve this!'}
                                    {status === 'success' && <span className="text-green-400 flex items-center justify-center gap-2"><CheckCircle2 /> Correct!</span>}
                                    {status === 'failure' && <span className="text-red-400 flex items-center justify-center gap-2"><XCircle /> Incorrect</span>}
                                </h2>

                                <p className="text-chess-text-secondary">
                                    {currentPuzzle.rating ? `Rating: ${currentPuzzle.rating}` : 'Unrated Puzzle'}
                                </p>

                                <div className="pt-4 w-full">
                                    <button
                                        onClick={() => loadNextPuzzle(false)}
                                        className="w-full py-4 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                    >
                                        <ArrowRight /> Next Puzzle
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
