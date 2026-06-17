import React, { useEffect, useRef, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import DashboardLayout from '../components/DashboardLayout';
import { ArrowRight, Target, CheckCircle2, XCircle, Star, Award, RotateCcw, Home, ClipboardList, HelpCircle, Eye, Loader2, Play, AlertTriangle, Shuffle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { translateError } from '../lib/errorTranslator';
import {
    getNextPuzzle,
    getPuzzleById,
    updatePuzzleReview,
    toggleFavorite,
    getUserPlaylists,
    getFavoritePuzzles,
    deletePuzzle
} from '../services/puzzleService';
import { incrementTotalSolved, getUserProfile } from '../services/userService';
import { useNavigate, useLocation } from 'react-router-dom';
import { getBoardTheme } from '../lib/boardThemes';
import { getPieceSet } from '../lib/pieceSets';

// Import chessground CSS
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

function getRecommendedPlaylist(playlists) {
    const activePlaylists = playlists.filter(p => p.total > 0);
    if (activePlaylists.length === 0) return null;

    const now = new Date();
    const getDueCount = (pl) => {
        return pl.puzzles.filter(p => {
            if (!p.nextDueDate) return true;
            const dueMillis = p.nextDueDate.toMillis?.() || p.nextDueDate.seconds * 1000 || new Date(p.nextDueDate).getTime();
            return dueMillis <= now.getTime();
        }).length;
    };
    const getNewCount = (pl) => {
        return pl.puzzles.filter(p => p.status === 'new').length;
    };

    // Priority 1: highest dueCount > 0
    let highestDue = 0;
    let dueRecommended = null;
    activePlaylists.forEach(pl => {
        const due = getDueCount(pl);
        if (due > highestDue) {
            highestDue = due;
            dueRecommended = pl;
        }
    });
    if (dueRecommended !== null) return dueRecommended.playlistIndex;

    // Priority 2: highest newCount > 0
    let highestNew = 0;
    let newRecommended = null;
    activePlaylists.forEach(pl => {
        const newC = getNewCount(pl);
        if (newC > highestNew) {
            highestNew = newC;
            newRecommended = pl;
        }
    });
    if (newRecommended !== null) return newRecommended.playlistIndex;

    // Priority 3: lowest progress (weighted mastery percentage)
    let lowestProgress = 101;
    let progressRecommended = null;
    activePlaylists.forEach(pl => {
        if (pl.progress < lowestProgress) {
            lowestProgress = pl.progress;
            progressRecommended = pl;
        }
    });
    if (progressRecommended !== null) return progressRecommended.playlistIndex;

    return null;
}

export default function TrainingArena() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
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
    const [unfavoriteToDelete, setUnfavoriteToDelete] = useState(null);

    // Board customization
    const [boardTheme, setBoardTheme] = useState(getBoardTheme('classic'));
    const [pieceSet, setPieceSet] = useState(getPieceSet('cburnett'));
    const [autoNext, setAutoNext] = useState(false);
    const [showCoordinates, setShowCoordinates] = useState(true);

    // One-Time session state variables
    const [isOneTime, setIsOneTime] = useState(false);
    const [sessionQueue, setSessionQueue] = useState([]);
    const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
    const [sessionResults, setSessionResults] = useState([]);
    const [sessionFinished, setSessionFinished] = useState(false);

    // Hint and Solution tracking refs to avoid stale closures in chessground callbacks
    const hintUsedRef = useRef(false);
    const solutionUsedRef = useRef(false);


    // Playlist Selector state variables
    const [showSelector, setShowSelector] = useState(false);
    const [playlistsData, setPlaylistsData] = useState([]);
    const [favoritesList, setFavoritesList] = useState([]);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [selectorLoading, setSelectorLoading] = useState(true);

    // Selection tabs and onboarding
    const [activeTab, setActiveTab] = useState('srs');
    const [onboardStep, setOnboardStep] = useState(null);
    const [recommendedIndex, setRecommendedIndex] = useState(null);

    // Sync state to ref (avoids stale closures in Chessground callbacks)
    useEffect(() => {
        puzzleRef.current = currentPuzzle;
        setIsFavorited(currentPuzzle?.isFavorite ?? false);
    }, [currentPuzzle]);

    // ─── Load user preferences on mount ──────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        getUserProfile(user.uid).then(profile => {
            if (profile?.settings?.boardTheme) setBoardTheme(getBoardTheme(profile.settings.boardTheme));
            if (profile?.settings?.pieceSet) setPieceSet(getPieceSet(profile.settings.pieceSet));
            if (profile?.settings?.autoNext !== undefined) setAutoNext(profile.settings.autoNext);
            if (profile?.settings?.showCoordinates !== undefined) setShowCoordinates(profile.settings.showCoordinates);
        }).catch(() => {});
    }, [user]);

    // Fetch favorites count on mount
    useEffect(() => {
        if (!user) return;
        getFavoritePuzzles(user.uid).then(favs => {
            setFavoritesList(favs);
            setFavoritesCount(favs.length);
        }).catch(e => {
            console.error('Failed to load favorites count on mount:', e);
        });
    }, [user]);

    // ─── On Mount: check for parameters and load decks ─────────────────
    useEffect(() => {
        if (!user) return;
        const params = new URLSearchParams(location.search);
        const specificId = params.get('puzzleId');
        const sessionParam = params.get('session');
        const playlistParam = params.get('playlistId');
        const openingParam = params.get('opening');

        // Check onboarding status
        const onboarded = localStorage.getItem('chess_op_srs_onboarded');
        if (!onboarded) {
            setOnboardStep(0);
        } else {
            setOnboardStep(null);
        }

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
        } else if (playlistParam || openingParam) {
            setLoading(true);
            Promise.all([
                getUserPlaylists(user.uid),
                getFavoritePuzzles(user.uid)
            ]).then(([pls, favs]) => {
                setPlaylistsData(pls);
                setFavoritesList(favs);
                setFavoritesCount(favs.length);
                const recIdx = getRecommendedPlaylist(pls);
                setRecommendedIndex(recIdx);
                
                let targetPuzzles = [];
                if (playlistParam) {
                    if (playlistParam === 'favorites') {
                        targetPuzzles = favs;
                    } else {
                        const plIndex = parseInt(playlistParam, 10);
                        const pl = pls.find(p => p.playlistIndex === plIndex);
                        if (pl) targetPuzzles = pl.puzzles;
                    }
                } else if (openingParam) {
                    const allPuzzles = [...pls.flatMap(p => p.puzzles), ...favs];
                    targetPuzzles = allPuzzles.filter(p => {
                        const mainOpening = p.opening.split(':')[0].split(',')[0].split(' - ')[0].trim().toLowerCase();
                        return mainOpening === openingParam.toLowerCase() || p.opening.toLowerCase().includes(openingParam.toLowerCase());
                    });
                }

                if (targetPuzzles.length > 0) {
                    const sequentialIds = targetPuzzles.map(p => p.id);
                    
                    sessionStorage.setItem('oneTimePlaylist', JSON.stringify(sequentialIds));
                    sessionStorage.removeItem('oneTimeSessionResults');
                    
                    setIsOneTime(true);
                    setSessionQueue(sequentialIds);
                    setCurrentSessionIndex(0);
                    setSessionResults([]);
                    setSessionFinished(false);
                    setShowSelector(false);
                    loadSpecificPuzzle(sequentialIds[0]);
                } else {
                    setShowSelector(true);
                    setLoading(false);
                }
            }).catch(e => {
                console.error('Failed to load query deck:', e);
                setShowSelector(true);
                setLoading(false);
            });
        } else {
            setIsOneTime(false);
            setSessionQueue([]);
            setSessionResults([]);
            setSessionFinished(false);
            setCurrentPuzzle(null);
            setShowSelector(true);
            setLoading(false);
            setSelectorLoading(true);
            Promise.all([
                getUserPlaylists(user.uid),
                getFavoritePuzzles(user.uid)
            ]).then(([pls, favs]) => {
                setPlaylistsData(pls);
                setFavoritesList(favs);
                setFavoritesCount(favs.length);
                const recIdx = getRecommendedPlaylist(pls);
                setRecommendedIndex(recIdx);
                setSelectorLoading(false);
            }).catch(e => {
                console.error('Failed to load selector data:', e);
                setSelectorLoading(false);
            });
        }
    }, [user, location.search, location.key]);

    const getDueCount = (puzzles) => {
        if (!puzzles) return 0;
        const now = new Date();
        return puzzles.filter(p => {
            if (!p.nextDueDate) return true;
            const dueMillis = p.nextDueDate.toMillis?.() || p.nextDueDate.seconds * 1000 || new Date(p.nextDueDate).getTime();
            return dueMillis <= now.getTime();
        }).length;
    };

    const handleSelectPlaylist = (type, puzzles, mode = 'standard') => {
        if (!puzzles || puzzles.length === 0) return;
        
        let selectedIds = [];
        if (mode === 'srs') {
            const now = new Date();
            const due = [];
            const nonDue = [];
            
            puzzles.forEach(p => {
                const dueMillis = p.nextDueDate 
                    ? (p.nextDueDate.toMillis?.() || p.nextDueDate.seconds * 1000 || new Date(p.nextDueDate).getTime())
                    : now.getTime();
                if (dueMillis <= now.getTime()) {
                    due.push(p);
                } else {
                    nonDue.push(p);
                }
            });

            let selectedPuzzles = [];

            // Scenario 4: Tiny Playlist (< 10 puzzles total)
            if (puzzles.length < 10) {
                selectedPuzzles = [...puzzles];
            } else {
                // Shuffle candidate pools first
                const shuffledDue = [...due].sort(() => 0.5 - Math.random());
                const shuffledNonDue = [...nonDue].sort(() => 0.5 - Math.random());

                if (shuffledDue.length >= 7 && shuffledNonDue.length >= 3) {
                    // Scenario 1: Optimal Split (Standard Case)
                    const selectedDue = shuffledDue.slice(0, 7);
                    const selectedNonDue = shuffledNonDue.slice(0, 3);
                    selectedPuzzles = [...selectedDue, ...selectedNonDue];
                } else if (shuffledDue.length >= 7 && shuffledNonDue.length < 3) {
                    // Scenario 2: Backlog Overload (High Due)
                    const selectedNonDue = [...shuffledNonDue];
                    const selectedDue = shuffledDue.slice(0, 10 - selectedNonDue.length);
                    selectedPuzzles = [...selectedDue, ...selectedNonDue];
                } else {
                    // Scenario 3: Clean Backlog (Low Due)
                    const selectedDue = [...shuffledDue];
                    const selectedNonDue = shuffledNonDue.slice(0, 10 - selectedDue.length);
                    selectedPuzzles = [...selectedDue, ...selectedNonDue];
                }
            }

            // Shuffle final mixed deck to prevent due reviews from playing sequentially before non-due
            const finalShuffled = [...selectedPuzzles].sort(() => 0.5 - Math.random());
            selectedIds = finalShuffled.map(p => p.id);
        } else if (mode === 'random10') {
            selectedIds = [...puzzles].sort(() => 0.5 - Math.random()).slice(0, 10).map(p => p.id);
        } else {
            selectedIds = puzzles.map(p => p.id);
        }

        if (selectedIds.length === 0) return;
        
        sessionStorage.setItem('oneTimePlaylist', JSON.stringify(selectedIds));
        sessionStorage.removeItem('oneTimeSessionResults');
        
        setIsOneTime(true);
        setSessionQueue(selectedIds);
        setCurrentSessionIndex(0);
        setSessionResults([]);
        setSessionFinished(false);
        setShowSelector(false);
        
        loadSpecificPuzzle(selectedIds[0]);
    };

    const handleSelectRandom10 = () => {
        const allPuzzles = [
            ...(playlistsData || []).flatMap(p => p?.puzzles || []),
            ...favoritesList
        ];
        const uniquePuzzles = [];
        const seen = new Set();
        allPuzzles.forEach(p => {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                uniquePuzzles.push(p);
            }
        });
        if (uniquePuzzles.length === 0) return;
        handleSelectPlaylist('random10', uniquePuzzles, 'random10');
    };

    const handleSelectAllRepertoire = () => {
        const playlistPuzzles = (playlistsData || []).flatMap(p => p?.puzzles || []);
        const allPuzzles = [...playlistPuzzles, ...favoritesList];
        const uniquePuzzles = [];
        const seen = new Set();
        allPuzzles.forEach(p => {
            if (!seen.has(p.id)) {
                seen.add(p.id);
                uniquePuzzles.push(p);
            }
        });
        if (uniquePuzzles.length === 0) return;
        handleSelectPlaylist('all', uniquePuzzles, 'standard');
    };

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
            if (currentPuzzle) {
                const alreadyLogged = sessionResults.some(r => r.id === currentPuzzle.id);
                if (!alreadyLogged) {
                    const outcome = (hintUsedRef.current || solutionUsedRef.current) ? 'assisted' : 'skipped';
                    logSessionResult(currentPuzzle.id, outcome);
                } else if (status !== 'success') {
                    if (hintUsedRef.current || solutionUsedRef.current || status === 'solution_revealed') {
                        logSessionResult(currentPuzzle.id, 'assisted');
                    }
                }
            }
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
            setToastError('Incomplete puzzle data found. Please use "Reset All Puzzle Data" in Settings and re-analyse.');
            return false;
        }
        const pColor = puzzle.playerColor || puzzle.color || puzzle.userColor || 'white';
        const normalized = { ...puzzle, color: pColor };
        setCurrentPuzzle(normalized);
        setOrientation(pColor);
        chessRef.current.load(normalized.fen);
        hintUsedRef.current = false;
        solutionUsedRef.current = false;
        return true;
    }

    const handleHint = () => {
        if (!currentPuzzle || !cgRef.current) return;
        hintUsedRef.current = true;
        const bestMoveFrom = currentPuzzle.correctMove.substring(0, 2);
        cgRef.current.setShapes([{ orig: bestMoveFrom, brush: 'yellow' }]);
    };

    const handleShowSolution = () => {
        if (!currentPuzzle || !cgRef.current) return;
        solutionUsedRef.current = true;
        if (isOneTime) {
            logSessionResult(currentPuzzle.id, 'assisted');
        }
        const bestMoveFrom = currentPuzzle.correctMove.substring(0, 2);
        const bestMoveTo = currentPuzzle.correctMove.substring(2, 4);
        cgRef.current.setShapes([
            { orig: bestMoveFrom, dest: bestMoveTo, brush: 'green' }
        ]);
        setStatus('solution_revealed');
    };

    const handleDoAgain = () => {
        if (!currentPuzzle || !cgRef.current) return;
        chessRef.current.load(currentPuzzle.fen);
        cgRef.current.set({
            fen: currentPuzzle.fen,
            turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
            movable: { color: currentPuzzle.color, dests: getLegalMoves() },
            drawable: { shapes: [] }
        });
        setStatus('active');
    };


    // ─── Board: initialize or reconfigure when puzzle changes ───────────────
    useEffect(() => {
        if (!boardRef.current || !currentPuzzle) return;

        if (!cgRef.current) {
            cgRef.current = Chessground(boardRef.current, {
                fen: currentPuzzle.fen,
                orientation: orientation,
                turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                animation: { enabled: true, duration: 200 },
                coordinates: showCoordinates,
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
    }, [currentPuzzle?.id, orientation, showCoordinates]); // Reconfigure on puzzle, orientation, or coordinates change

    function configureBoard(puzzle) {
        cgRef.current.set({
            fen: puzzle.fen,
            orientation: puzzle.color,
            turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
            lastMove: null,
            coordinates: showCoordinates,
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
                const outcome = (hintUsedRef.current || solutionUsedRef.current) ? 'assisted' : 'solved';
                logSessionResult(puzzle.id, outcome);
            }

            try { await updatePuzzleReview(user.uid, puzzle.id, true, 0); }
            catch (e) { console.warn('updatePuzzleReview failed:', e); }

            try { await incrementTotalSolved(user.uid); }
            catch (e) { console.warn('incrementTotalSolved failed:', e); }

            // Handle auto-next puzzle progression
            if (autoNext) {
                const isLastInSession = isOneTime && (currentSessionIndex + 1 === sessionQueue.length);
                if (isLastInSession) {
                    setSessionFinished(true);
                } else {
                    loadNextPuzzle(false);
                }
            }

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
                const outcome = (hintUsedRef.current || solutionUsedRef.current) ? 'assisted' : 'skipped';
                logSessionResult(puzzle.id, outcome);
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
    function logSessionResult(puzzleId, resultType) {
        setSessionResults(prev => {
            if (prev.some(r => r.id === puzzleId)) {
                return prev.map(r => r.id === puzzleId ? { ...r, result: resultType } : r);
            }
            const puzzle = puzzleRef.current;
            const name = puzzle?.customName || puzzle?.opening || 'Puzzle';
            const theme = puzzle?.theme || 'Blunder';
            const res = [...prev, { id: puzzleId, name, theme, result: resultType }];
            sessionStorage.setItem('oneTimeSessionResults', JSON.stringify(res));
            return res;
        });
    }

    const handleConfirmUnfavoriteDelete = async () => {
        if (!unfavoriteToDelete) return;
        try {
            await deletePuzzle(user.uid, unfavoriteToDelete.id);
            setFavoritesCount(prev => Math.max(0, prev - 1));
            setUnfavoriteToDelete(null);
            // Proceed to the next puzzle in the session
            await loadNextPuzzle(false);
        } catch (e) {
            setToastError(translateError(e));
            setTimeout(() => setToastError(null), 3000);
        }
    };

    const handleCancelUnfavorite = () => {
        setUnfavoriteToDelete(null);
    };

    async function handleToggleFavorite() {
        const puzzle = puzzleRef.current;
        if (!puzzle || favoriteLoading) return;

        const newFavState = !isFavorited;
        setToastError(null);

        if (newFavState) {
            if (favoritesCount >= 10) {
                setToastError('Favorites limit reached! Maximum 10 starred puzzles allowed.');
                setTimeout(() => setToastError(null), 5000);
                return;
            }
        } else {
            // Check playlists occupancy locally
            try {
                const playlists = await getUserPlaylists(user.uid);
                const count0 = playlists.find(g => g.playlistIndex === 0)?.puzzles.length || 0;
                const count1 = playlists.find(g => g.playlistIndex === 1)?.puzzles.length || 0;
                const count2 = playlists.find(g => g.playlistIndex === 2)?.puzzles.length || 0;
                if (count0 >= 20 && count1 >= 20 && count2 >= 20) {
                    setUnfavoriteToDelete(puzzle);
                    return;
                }
            } catch (e) {
                console.warn('Playlists occupancy pre-check failed:', e);
            }
        }

        setFavoriteLoading(true);
        setIsFavorited(newFavState);

        try {
            await toggleFavorite(user.uid, puzzle.id, newFavState);
            setFavoritesCount(prev => newFavState ? prev + 1 : Math.max(0, prev - 1));
        } catch (e) {
            setIsFavorited(!newFavState);
            if (e.message === 'PLAYLISTS_FULL') {
                setUnfavoriteToDelete(puzzle);
            } else {
                setToastError(translateError(e));
                setTimeout(() => setToastError(null), 5000);
            }
        } finally {
            setFavoriteLoading(false);
        }
    }


    const handleTrainMorePuzzles = () => {
        navigate('/dashboard/train', { replace: true });
        setIsOneTime(false);
        setSessionQueue([]);
        setSessionResults([]);
        setSessionFinished(false);
        setCurrentSessionIndex(0);
        setShowSelector(true);
    };

    // If one-time session completes, show dashboard
    if (sessionFinished) {
        const totalCorrect = sessionResults.filter(r => {
            const resType = r.result === true ? 'solved' : (r.result === false ? 'skipped' : r.result);
            return resType === 'solved';
        }).length;
        const totalPuzzles = sessionQueue.length || 1;

        const assistedCount = sessionResults.filter(r => {
            const resType = r.result === true ? 'solved' : (r.result === false ? 'skipped' : r.result);
            return resType === 'assisted';
        }).length;
        const skippedCount = Math.max(0, totalPuzzles - totalCorrect - assistedCount);

        const C = 2 * Math.PI * 60;
        const solvedLen = (totalCorrect / totalPuzzles) * C;
        const assistedLen = (assistedCount / totalPuzzles) * C;
        const skippedLen = (skippedCount / totalPuzzles) * C;

        return (
            <DashboardLayout>
                <div className="max-w-3xl mx-auto py-8">
                    <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                        {/* Glowing background accent */}
                        <div className="absolute inset-0 bg-gradient-to-br from-chess-accent/10 to-transparent pointer-events-none" />

                        {/* Celebration icon */}
                        <div className="w-20 h-20 bg-chess-accent/15 text-chess-accent rounded-full flex items-center justify-center mb-6 shadow-xl shadow-chess-accent/10">
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
                                {skippedLen > 0 && (
                                    <circle
                                        cx="72"
                                        cy="72"
                                        r="60"
                                        className="stroke-red-500/30 fill-transparent"
                                        strokeWidth="8"
                                        strokeDasharray={`${skippedLen} ${C}`}
                                        strokeDashoffset={-(solvedLen + assistedLen)}
                                        strokeLinecap="round"
                                    />
                                )}
                                {assistedLen > 0 && (
                                    <circle
                                        cx="72"
                                        cy="72"
                                        r="60"
                                        className="stroke-amber-400 fill-transparent"
                                        strokeWidth="8"
                                        strokeDasharray={`${assistedLen} ${C}`}
                                        strokeDashoffset={-solvedLen}
                                        strokeLinecap="round"
                                    />
                                )}
                                {solvedLen > 0 && (
                                    <circle
                                        cx="72"
                                        cy="72"
                                        r="60"
                                        className="stroke-emerald-400 fill-transparent"
                                        strokeWidth="8"
                                        strokeDasharray={`${solvedLen} ${C}`}
                                        strokeDashoffset={0}
                                        strokeLinecap="round"
                                    />
                                )}
                            </svg>
                            <div className="absolute flex flex-col items-center">
                                <span className="text-3xl font-bold text-white">{totalCorrect} / {totalPuzzles}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-chess-text-secondary mt-1">Correct</span>
                            </div>
                        </div>

                        {/* Results list */}
                        <div className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 max-h-[300px] overflow-y-auto mb-8 space-y-2 text-left">
                            <h3 className="text-xs uppercase tracking-wider font-bold text-chess-text-secondary mb-3 px-2">Puzzle-by-Puzzle Details</h3>
                            {sessionResults.map((r, i) => {
                                const resType = r.result === true ? 'solved' : (r.result === false ? 'skipped' : r.result);
                                return (
                                    <div key={i} className="flex items-center justify-between p-3 bg-white/[0.01] border border-white/5 rounded-xl">
                                        <div>
                                            <p className="text-white font-bold text-sm truncate max-w-[240px] sm:max-w-[400px]">
                                                {r.name}
                                            </p>
                                        </div>
                                        {resType === 'solved' && (
                                            <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                                                <CheckCircle2 size={13} /> Solved
                                            </span>
                                        )}
                                        {resType === 'assisted' && (
                                            <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-lg">
                                                <HelpCircle size={13} /> Solved with Hint/Solution
                                            </span>
                                        )}
                                        {resType === 'skipped' && (
                                            <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/40 text-xs font-bold px-2.5 py-1 rounded-lg">
                                                <XCircle size={13} /> Skipped
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Navigation buttons */}
                        <div className="flex flex-wrap items-center justify-center gap-4 w-full">
                            <button
                                onClick={handleTrainMorePuzzles}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-450 hover:to-teal-550 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 shadow-lg shadow-emerald-500/15 flex items-center gap-2"
                            >
                                <Play size={16} fill="currentColor" /> Train More Puzzles
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

                    <div className="w-full flex-1 flex items-center justify-center p-4 bg-chess-panel border border-white/5 rounded-2xl relative">
                        {/* Dynamic board theme + piece set CSS */}
                        <style>{`
                            .cg-wrap piece.white.pawn { background-image: url('${pieceSet.pieces.w.p}') !important; }
                            .cg-wrap piece.white.knight { background-image: url('${pieceSet.pieces.w.n}') !important; }
                            .cg-wrap piece.white.bishop { background-image: url('${pieceSet.pieces.w.b}') !important; }
                            .cg-wrap piece.white.rook { background-image: url('${pieceSet.pieces.w.r}') !important; }
                            .cg-wrap piece.white.queen { background-image: url('${pieceSet.pieces.w.q}') !important; }
                            .cg-wrap piece.white.king { background-image: url('${pieceSet.pieces.w.k}') !important; }
                            .cg-wrap piece.black.pawn { background-image: url('${pieceSet.pieces.b.p}') !important; }
                            .cg-wrap piece.black.knight { background-image: url('${pieceSet.pieces.b.n}') !important; }
                            .cg-wrap piece.black.bishop { background-image: url('${pieceSet.pieces.b.b}') !important; }
                            .cg-wrap piece.black.rook { background-image: url('${pieceSet.pieces.b.r}') !important; }
                            .cg-wrap piece.black.queen { background-image: url('${pieceSet.pieces.b.q}') !important; }
                            .cg-wrap piece.black.king { background-image: url('${pieceSet.pieces.b.k}') !important; }
                            cg-board {
                                background-image: repeating-conic-gradient(${boardTheme.darkSquare} 0% 25%, ${boardTheme.lightSquare} 25% 50%) !important;
                                background-size: 25% 25% !important;
                            }
                            ${showCoordinates === false ? '.cg-wrap coords { display: none !important; }' : ''}
                        `}</style>
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
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm p-3 rounded-xl flex items-start gap-2.5 animate-in">
                            <AlertTriangle className="shrink-0 mt-0.5" size={16} />
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
                                        disabled={favoriteLoading || (!isFavorited && favoritesCount >= 10)}
                                        title={isFavorited 
                                            ? 'Remove from Favorites' 
                                            : favoritesCount >= 10 
                                                ? 'Favorites limit reached (10/10)' 
                                                : 'Add to Favorites'
                                        }
                                        className={`p-2 rounded-lg transition-all ${
                                            isFavorited
                                                ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                                                : !isFavorited && favoritesCount >= 10
                                                    ? 'text-chess-text-secondary/35 cursor-not-allowed opacity-45'
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
                                    {status === 'solution_revealed' && <span className="text-yellow-450 flex items-center justify-center gap-2">Solution Revealed</span>}
                                </h2>

                                <p className="text-chess-text-secondary">
                                    {currentPuzzle.rating ? `Rating: ${currentPuzzle.rating}` : 'Unrated Puzzle'}
                                </p>

                                {currentPuzzle.recurrentCount > 0 && (
                                    <div className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold animate-pulse">
                                        <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                                        <span>Recurrent Blunder (Failed in {currentPuzzle.recurrentCount} game scans)</span>
                                    </div>
                                )}

                                {status === 'solution_revealed' && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-semibold text-white">
                                        Solution: <span className="text-chess-accent font-mono font-bold tracking-wider">{currentPuzzle.correctMove.substring(0, 2)} → {currentPuzzle.correctMove.substring(2, 4)}</span>
                                    </div>
                                )}

                                {/* Action Buttons Panel */}
                                <div className="w-full space-y-3 pt-2">
                                    {status === 'active' && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={handleHint}
                                                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                                            >
                                                <HelpCircle size={16} className="text-amber-400 animate-pulse" />
                                                Get Hint
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleShowSolution}
                                                className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-405 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm"
                                            >
                                                <Eye size={16} />
                                                Show Solution
                                            </button>
                                        </div>
                                    )}

                                    {(status === 'failure' || status === 'solution_revealed') && (
                                        <button
                                            type="button"
                                            onClick={handleDoAgain}
                                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-sm"
                                        >
                                            <RotateCcw size={16} className="text-chess-accent" />
                                            Try Again (Do Again)
                                        </button>
                                    )}

                                    {(status === 'success' || status === 'failure' || status === 'solution_revealed') && (
                                        <button
                                            onClick={() => loadNextPuzzle(false)}
                                            className="w-full py-4 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                        >
                                            <ArrowRight /> {isOneTime && (currentSessionIndex + 1 === sessionQueue.length) ? 'Finish Session' : 'Next Puzzle'}
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="text-chess-text-secondary">
                                <Target size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No puzzles found. Analyse some games first!</p>
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

            {/* Selection Popup */}
            {showSelector && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer" onClick={() => navigate('/dashboard')} />

                    {/* Card Container */}
                    <div className="relative w-full max-w-2xl bg-chess-panel/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                        {/* Glow effect */}
                        <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/20 to-brand-med/20 rounded-3xl blur-[1px] -z-10" />

                        {onboardStep !== null ? (
                            /* Onboarding walkthrough slides */
                            <div className="flex flex-col items-center text-center py-6">
                                <div className="w-16 h-16 bg-chess-accent/15 border border-chess-accent/20 rounded-2xl flex items-center justify-center mb-6">
                                    {onboardStep === 0 && <Award size={32} className="text-chess-accent" />}
                                    {onboardStep === 1 && <Target size={32} className="text-chess-accent" />}
                                    {onboardStep === 2 && <AlertTriangle size={32} className="text-amber-400" />}
                                </div>
                                
                                <h3 className="text-2xl font-serif font-bold text-white mb-3">
                                    {onboardStep === 0 && "Welcome to Spaced Repetition"}
                                    {onboardStep === 1 && "SRS vs. Standard Training"}
                                    {onboardStep === 2 && "Deduplication & Alerts"}
                                </h3>
                                
                                <p className="text-chess-text-secondary text-sm max-w-md mb-8 leading-relaxed">
                                    {onboardStep === 0 && "Train smarter. Spaced Repetition automatically schedules reviews based on your performance, so you study positions right before you forget them."}
                                    {onboardStep === 1 && "Standard mode trains items in order. SRS mode prioritizes your overdue blunders first, making your practice sessions far more rewarding."}
                                    {onboardStep === 2 && "Scanning matches silently updates duplicate puzzles and boosts their weight. Look out for the recurrent blunder warning inside training!"}
                                </p>

                                {/* Step indicator dots */}
                                <div className="flex items-center gap-2 mb-8">
                                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${onboardStep === 0 ? 'bg-chess-accent w-6' : 'bg-white/20'}`} />
                                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${onboardStep === 1 ? 'bg-chess-accent w-6' : 'bg-white/20'}`} />
                                    <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${onboardStep === 2 ? 'bg-chess-accent w-6' : 'bg-white/20'}`} />
                                </div>

                                <div className="flex items-center justify-between w-full pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => {
                                            localStorage.setItem('chess_op_srs_onboarded', 'true');
                                            setOnboardStep(null);
                                        }}
                                        className="text-sm font-semibold text-chess-text-secondary hover:text-white"
                                    >
                                        Skip Guide
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (onboardStep < 2) {
                                                setOnboardStep(onboardStep + 1);
                                            } else {
                                                localStorage.setItem('chess_op_srs_onboarded', 'true');
                                                setOnboardStep(null);
                                            }
                                        }}
                                        className="bg-chess-accent hover:bg-chess-accent-hover text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
                                    >
                                        {onboardStep === 2 ? "Get Started" : "Next Step"}
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="absolute top-6 right-6">
                                    <button
                                        onClick={() => setOnboardStep(0)}
                                        title="View Training Guide"
                                        className="text-chess-text-secondary hover:text-white p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                                    >
                                        <HelpCircle size={16} /> Guide
                                    </button>
                                </div>

                                <div className="flex flex-col items-center text-center mb-6">
                                    <div className="w-16 h-16 bg-chess-accent/15 border border-chess-accent/20 rounded-2xl flex items-center justify-center mb-4">
                                        <Target size={32} className="text-chess-accent" />
                                    </div>
                                    <h2 className="text-3xl font-serif font-bold text-white mb-2">Select Training Deck</h2>
                                    <p className="text-chess-text-secondary text-sm max-w-md">
                                        Choose which playlist you want to train. Solve positions correctly to build your mastery and streak.
                                    </p>
                                </div>

                                {/* Tab Headers */}
                                <div className="flex bg-white/5 p-1 rounded-xl mb-6 w-full max-w-md mx-auto border border-white/5">
                                    <button
                                        onClick={() => setActiveTab('srs')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                                            activeTab === 'srs'
                                                ? 'bg-chess-accent text-white shadow-lg shadow-chess-accent/15'
                                                : 'text-chess-text-secondary hover:text-white'
                                        }`}
                                    >
                                        Spaced Repetition (SRS)
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('standard')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg ${
                                            activeTab === 'standard'
                                                ? 'bg-chess-accent text-white shadow-lg shadow-chess-accent/15'
                                                : 'text-chess-text-secondary hover:text-white'
                                        }`}
                                    >
                                        Standard Playlists
                                    </button>
                                </div>

                                {selectorLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                                        <Loader2 className="animate-spin text-chess-accent" size={32} />
                                        <p className="text-chess-text-secondary text-sm">Loading playlists...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {activeTab === 'srs' ? (
                                            /* SRS TAB VIEW */
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {playlistsData.map((pl) => {
                                                    const isEmpty = pl.total === 0;
                                                    const dueCount = getDueCount(pl.puzzles);
                                                    const isRec = pl.playlistIndex === recommendedIndex;
                                                    return (
                                                        <button
                                                            key={pl.playlistIndex}
                                                            onClick={() => handleSelectPlaylist(pl.playlistIndex.toString(), pl.puzzles, 'srs')}
                                                            disabled={isEmpty}
                                                            className={`relative flex items-center justify-between p-5 rounded-2xl border text-left group ${
                                                                isEmpty 
                                                                    ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed' 
                                                                    : 'border-white/10 bg-white/[0.02] hover:border-chess-accent/40 hover:bg-chess-accent/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                            }`}
                                                        >
                                                            {isRec && (
                                                                <div className="absolute -top-2 left-4 bg-emerald-500/20 border border-emerald-500/30 text-emerald-455 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                                                                    Recommended
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1 mr-4">
                                                                <h4 className={`font-bold truncate ${isEmpty ? 'text-white/60' : 'text-white group-hover:text-chess-accent transition-colors'}`}>
                                                                    {pl.title}
                                                                </h4>
                                                                <p className="text-xs text-chess-text-secondary mt-1">
                                                                    {isEmpty ? 'No reviews due' : `${dueCount} reviews due today`}
                                                                </p>
                                                            </div>
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                isEmpty ? 'border-white/5 bg-white/5 text-white/40' : 'border-white/10 bg-white/5 text-chess-text-secondary group-hover:bg-chess-accent group-hover:text-white group-hover:border-transparent'
                                                            }`}>
                                                                <Play size={14} fill={isEmpty ? "none" : "currentColor"} />
                                                            </div>
                                                        </button>
                                                    );
                                                })}

                                                {/* Favorites in SRS tab */}
                                                <button
                                                    onClick={() => handleSelectPlaylist('favorites', favoritesList, 'srs')}
                                                    disabled={favoritesCount === 0}
                                                    className={`relative flex items-center justify-between p-5 rounded-2xl border text-left group ${
                                                        favoritesCount === 0 
                                                            ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed' 
                                                            : 'border-white/10 bg-white/[0.02] hover:border-yellow-450/45 hover:bg-yellow-400/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1 mr-4">
                                                        <h4 className={`font-bold truncate ${favoritesCount === 0 ? 'text-white/60' : 'text-white group-hover:text-yellow-400 transition-colors'}`}>
                                                            Starred / Favorites
                                                        </h4>
                                                        <p className="text-xs text-chess-text-secondary mt-1">
                                                            {favoritesCount === 0 ? 'No reviews due' : `${getDueCount(favoritesList)} reviews due today`}
                                                        </p>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                        favoritesCount === 0 ? 'border-white/5 bg-white/5 text-white/40' : 'border-white/10 bg-white/5 text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-transparent'
                                                    }`}>
                                                        <Play size={14} fill={favoritesCount === 0 ? "none" : "currentColor"} />
                                                    </div>
                                                </button>
                                            </div>
                                        ) : (
                                            /* STANDARD TAB VIEW */
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {playlistsData.map((pl) => {
                                                    const isEmpty = pl.total === 0;
                                                    return (
                                                        <button
                                                            key={pl.playlistIndex}
                                                            onClick={() => handleSelectPlaylist(pl.playlistIndex.toString(), pl.puzzles, 'standard')}
                                                            disabled={isEmpty}
                                                            className={`relative flex items-center justify-between p-5 rounded-2xl border text-left group ${
                                                                isEmpty 
                                                                    ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed' 
                                                                    : 'border-white/10 bg-white/[0.02] hover:border-chess-accent/40 hover:bg-chess-accent/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1 mr-4">
                                                                <h4 className={`font-bold truncate ${isEmpty ? 'text-white/60' : 'text-white group-hover:text-chess-accent transition-colors'}`}>
                                                                    {pl.title}
                                                                </h4>
                                                                <p className="text-xs text-chess-text-secondary mt-1">
                                                                    {pl.total} puzzles · {pl.progress}% mastery
                                                                </p>
                                                            </div>
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                                isEmpty ? 'border-white/5 bg-white/5 text-white/40' : 'border-white/10 bg-white/5 text-chess-text-secondary group-hover:bg-chess-accent group-hover:text-white group-hover:border-transparent'
                                                            }`}>
                                                                <Play size={14} fill={isEmpty ? "none" : "currentColor"} />
                                                            </div>
                                                        </button>
                                                    );
                                                })}

                                                {/* Favorites in Standard Tab */}
                                                <button
                                                    onClick={() => handleSelectPlaylist('favorites', favoritesList, 'standard')}
                                                    disabled={favoritesCount === 0}
                                                    className={`relative flex items-center justify-between p-5 rounded-2xl border text-left group ${
                                                        favoritesCount === 0 
                                                            ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed' 
                                                            : 'border-white/10 bg-white/[0.02] hover:border-yellow-450/45 hover:bg-yellow-400/5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1 mr-4">
                                                        <h4 className={`font-bold truncate ${favoritesCount === 0 ? 'text-white/60' : 'text-white group-hover:text-yellow-400 transition-colors'}`}>
                                                            Starred / Favorites
                                                        </h4>
                                                        <p className="text-xs text-chess-text-secondary mt-1">
                                                            {favoritesCount} favorited puzzles
                                                        </p>
                                                    </div>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                                        favoritesCount === 0 ? 'border-white/5 bg-white/5 text-white/40' : 'border-white/10 bg-white/5 text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-transparent'
                                                    }`}>
                                                        <Play size={14} fill={favoritesCount === 0 ? "none" : "currentColor"} />
                                                    </div>
                                                </button>
                                            </div>
                                        )}

                                        {/* Footer Actions */}
                                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
                                            {activeTab === 'standard' ? (
                                                <>
                                                    <button
                                                        onClick={handleSelectRandom10}
                                                        disabled={(playlistsData || []).flatMap(p => p?.puzzles || []).length === 0 && favoritesCount === 0}
                                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 cursor-pointer"
                                                    >
                                                        <Shuffle size={16} />
                                                        Quick 10 Shuffle
                                                    </button>
                                                    <button
                                                        onClick={handleSelectAllRepertoire}
                                                        disabled={(playlistsData || []).flatMap(p => p?.puzzles || []).length === 0}
                                                        className="flex-1 py-3 bg-chess-accent hover:bg-chess-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 cursor-pointer"
                                                    >
                                                        <ClipboardList size={16} />
                                                        Train All Repertoire
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        const allPuzzles = [
                                                            ...(playlistsData || []).flatMap(p => p?.puzzles || []),
                                                            ...favoritesList
                                                        ];
                                                        const uniquePuzzles = [];
                                                        const seen = new Set();
                                                        allPuzzles.forEach(p => {
                                                            if (!seen.has(p.id)) {
                                                                seen.add(p.id);
                                                                uniquePuzzles.push(p);
                                                            }
                                                        });
                                                        handleSelectPlaylist('all-srs', uniquePuzzles, 'srs');
                                                    }}
                                                    disabled={(playlistsData || []).flatMap(p => p?.puzzles || []).length === 0 && favoritesCount === 0}
                                                    className="flex-1 py-3 bg-chess-accent hover:bg-chess-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 cursor-pointer"
                                                >
                                                    <ClipboardList size={16} />
                                                    Train All SRS Queue
                                                </button>
                                            )}
                                            
                                            <button
                                                onClick={() => navigate('/dashboard')}
                                                className="py-3 px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                Back to Dashboard
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Unfavoriting Deletion Warning Modal */}
            {unfavoriteToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={handleCancelUnfavorite} />

                    {/* Modal Card */}
                    <div className="bg-chess-panel border border-red-500/30 max-w-md w-full rounded-2xl shadow-2xl p-6 relative overflow-hidden z-10">
                        {/* Accent background glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />

                        <div className="flex items-center gap-3 text-red-400 mb-4">
                            <AlertTriangle size={32} />
                            <h3 className="text-xl font-bold font-serif text-white">Delete Puzzle</h3>
                        </div>

                        <p className="text-chess-text-secondary text-sm mb-4 leading-relaxed">
                            All training playlists are full (20/20 each). Unfavoriting this puzzle will permanently delete it. Do you want to proceed?
                        </p>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={handleCancelUnfavorite}
                                className="px-4 py-2 text-sm text-chess-text-secondary hover:text-white rounded-lg transition-colors"
                            >
                                Cancel (Keep Starred)
                            </button>
                            <button
                                onClick={handleConfirmUnfavoriteDelete}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-600/15"
                            >
                                Yes, Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </DashboardLayout>
    );
}
