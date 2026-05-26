import React, { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import DashboardLayout from '../components/DashboardLayout';
import { ArrowRight, Target, CheckCircle2, XCircle, Star, Award, RotateCcw, Home, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
    getNextPuzzle,
    getPuzzleById,
    updatePuzzleReview,
    toggleFavorite,
    getUserPlaylists
} from '../services/puzzleService';
import { incrementTotalSolved } from '../services/userService';
import { useNavigate } from 'react-router-dom';

// Import chessground CSS
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export default function TrainingArena() {
    const { user } = useAuth();
    const navigate = useNavigate();
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

    // One-Time session state variables
    const [isOneTime, setIsOneTime] = useState(false);
    const [sessionQueue, setSessionQueue] = useState([]);
    const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
    const [sessionResults, setSessionResults] = useState([]);
    const [sessionFinished, setSessionFinished] = useState(false);

    // Sync state to ref (avoids stale closures in Chessground callbacks)
    useEffect(() => {
        puzzleRef.current = currentPuzzle;
        setIsFavorited(currentPuzzle?.isFavorite ?? false);
    }, [currentPuzzle]);

    // ─── On Mount: check for ?puzzleId= or ?session= in URL ─────────────────
    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(window.location.search);
        const specificId = params.get('puzzleId');
        const sessionParam = params.get('session');

        if (sessionParam === 'one-time') {
            setIsOneTime(true);
            const queueStr = sessionStorage.getItem('oneTimePlaylist');
            if (queueStr) {
                const queue = JSON.parse(queueStr);
                setSessionQueue(queue);
                setCurrentSessionIndex(0);
                setSessionResults([]);
                setSessionFinished(false);
                if (queue.length > 0) {
                    loadSpecificPuzzle(queue[0]);
                } else {
                    loadNextPuzzle();
                }
            } else {
                loadNextPuzzle();
            }
        } else if (specificId) {
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
        
        // Handle One-Time Session progression
        if (isOneTime && !retry) {
            const nextIdx = currentSessionIndex + 1;
            if (nextIdx < sessionQueue.length) {
                setCurrentSessionIndex(nextIdx);
                await loadSpecificPuzzle(sessionQueue[nextIdx]);
            } else {
                setSessionFinished(true);
            }
            return;
        }

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
        const pColor = puzzle.playerColor || puzzle.color || puzzle.userColor || 'white';
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

            if (isOneTime) {
                logSessionResult(puzzle.id, true);
            }

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

            if (isOneTime) {
                logSessionResult(puzzle.id, false);
            }

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

    // Helper to log one-time results
    function logSessionResult(puzzleId, isSuccess) {
        setSessionResults(prev => {
            if (prev.some(r => r.id === puzzleId)) {
                return prev.map(r => r.id === puzzleId ? { ...r, result: isSuccess } : r);
            }
            const puzzle = puzzleRef.current;
            const name = puzzle?.customName || puzzle?.opening || 'Puzzle';
            const theme = puzzle?.theme || 'Blunder';
            const res = [...prev, { id: puzzleId, name, theme, result: isSuccess }];
            sessionStorage.setItem('oneTimeSessionResults', JSON.stringify(res));
            return res;
        });
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
        } catch (e) {
            console.error('toggleFavorite failed:', e.code, e.message);
            setIsFavorited(!newFavState);
            setToastError(e.message === 'FAVORITES_LIMIT_EXCEEDED'
                ? 'Favorites limit reached! Maximum 10 starred puzzles allowed.'
                : `Star failed: ${e.message}`);
            setTimeout(() => setToastError(null), 5000);
        } finally {
            setFavoriteLoading(false);
        }
    }

    // Retries another one-time session of 10 random puzzles without leaving
    const handleRetrySession = async () => {
        setLoading(true);
        setSessionFinished(false);
        setSessionResults([]);
        try {
            const playlists = await getUserPlaylists(user.uid);
            const allPuzzles = playlists.flatMap(g => g.puzzles);
            if (allPuzzles.length > 0) {
                const shuffled = [...allPuzzles].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, 10).map(p => p.id);
                setSessionQueue(selected);
                setCurrentSessionIndex(0);
                sessionStorage.setItem('oneTimePlaylist', JSON.stringify(selected));
                await loadSpecificPuzzle(selected[0]);
            } else {
                setSessionFinished(false);
                setIsOneTime(false);
                await loadNextPuzzle();
            }
        } catch (e) {
            console.error('Failed to retry session:', e);
        } finally {
            setLoading(false);
        }
    };

    // If one-time session completes, show dashboard
    if (sessionFinished) {
        const totalCorrect = sessionResults.filter(r => r.result).length;
        const totalPuzzles = sessionQueue.length;
        const scorePercentage = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;

        return (
            <DashboardLayout>
                <div className="max-w-3xl mx-auto py-8">
                    <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                        {/* Glowing background accent */}
                        <div className="absolute inset-0 bg-gradient-to-br from-chess-accent/10 to-transparent pointer-events-none" />

                        {/* Celebration icon */}
                        <div className="w-20 h-20 bg-chess-accent/15 text-chess-accent rounded-full flex items-center justify-center mb-6 shadow-xl shadow-chess-accent/10 animate-bounce">
                            <Award size={40} />
                        </div>

                        <h1 className="text-3xl font-serif font-bold text-white mb-2">Session Completed!</h1>
                        <p className="text-chess-text-secondary text-sm mb-6 max-w-md">
                            Congratulations! You have completed your one-time 10-puzzle blitz run. Review your results below.
                        </p>

                        {/* Score summary Speed dial */}
                        <div className="relative w-36 h-36 flex items-center justify-center mb-8">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="72"
                                    cy="72"
                                    r="60"
                                    className="stroke-white/5 fill-transparent"
                                    strokeWidth="8"
                                />
                                <circle
                                    cx="72"
                                    cy="72"
                                    r="60"
                                    className="stroke-emerald-400 fill-transparent transition-all duration-1000"
                                    strokeWidth="8"
                                    strokeDasharray={2 * Math.PI * 60}
                                    strokeDashoffset={2 * Math.PI * 60 - (scorePercentage / 100) * (2 * Math.PI * 60)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-bold text-white">{totalCorrect} / {totalPuzzles}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-chess-text-secondary mt-1">Solved</span>
                            </div>
                        </div>

                        {/* Results list */}
                        <div className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 max-h-[300px] overflow-y-auto mb-8 space-y-2 text-left">
                            <h3 className="text-xs uppercase tracking-wider font-bold text-chess-text-secondary mb-3 px-2">Puzzle-by-Puzzle Details</h3>
                            {sessionResults.map((r, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                                    <div>
                                        <p className="text-white font-bold text-sm truncate max-w-[240px] sm:max-w-[400px]">
                                            {r.name}
                                        </p>
                                        <p className="text-[10px] text-chess-text-secondary font-medium uppercase mt-0.5 tracking-wider">
                                            {r.theme}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-lg border ${
                                        r.result 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450' 
                                            : 'bg-red-500/10 border-red-500/20 text-red-405'
                                    }`}>
                                        {r.result ? 'Correct ✓' : 'Incorrect ✗'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                            <button
                                onClick={handleRetrySession}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-450 hover:to-teal-550 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/15 flex items-center gap-2"
                            >
                                <RotateCcw size={16} /> Try Another 10 Puzzles
                            </button>
                            <button
                                onClick={() => navigate('/dashboard/repertoire')}
                                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <ClipboardList size={16} /> Repertoire Page
                            </button>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                <Home size={16} /> Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-8">

                {/* Board Column */}
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    {/* Linear session progress bar at top */}
                    {isOneTime && (
                        <div className="w-full max-w-[600px] bg-chess-panel border border-white/5 p-4 rounded-2xl flex flex-col gap-2 shadow-lg">
                            <div className="flex justify-between items-center text-xs text-chess-text-secondary font-bold uppercase tracking-wider">
                                <span>One-Time Session</span>
                                <span>Puzzle {currentSessionIndex + 1} of {sessionQueue.length}</span>
                            </div>
                            <div className="w-full bg-black/25 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${((currentSessionIndex + 1) / sessionQueue.length) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="w-full flex-1 flex items-center justify-center p-4 bg-chess-panel border border-white/5 rounded-2xl">
                        <div
                            ref={boardRef}
                            className="w-full max-w-[600px] aspect-square rounded-lg shadow-2xl overflow-hidden"
                        />
                    </div>
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
                                    <div className="text-left min-w-0 flex-1 mr-2">
                                        <p className="text-chess-text-secondary text-xs uppercase tracking-widest mb-1">Current Puzzle</p>
                                        <p className="text-white font-bold text-sm truncate" title={currentPuzzle.customName || currentPuzzle.opening}>
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
                                        <ArrowRight /> {isOneTime && (currentSessionIndex + 1 === sessionQueue.length) ? 'Finish Session' : 'Next Puzzle'}
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
