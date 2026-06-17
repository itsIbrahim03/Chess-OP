import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/userService';
import { Chess } from 'chess.js';
import {
    Cpu, Sparkles, AlertCircle, CheckCircle, XCircle, Home, Brain,
    Zap, Flame, Clock, Calendar, Hash, Save, Upload, FileText, Search, Play,
    ChevronDown, Folder, AlertTriangle, Loader2
} from 'lucide-react';
import { getUserPlaylists, getPendingPuzzles, clearPendingPuzzles, getUserPuzzleStats, savePendingPuzzles, processScanDuplicates, normalizeFen } from '../services/puzzleService';
import { backgroundAnalysisService } from '../services/backgroundAnalysisService';
import { getPieceImageUrl } from '../lib/pieceSets';
import { engineService } from '../services/engineService';
import { OpeningDetector } from '../lib/openingDetector';
import { gameAnalyzer } from '../lib/gameAnalyzer';
import ThemedDialog from '../components/ThemedDialog';
import Toast from '../components/Toast';
import { translateError } from '../lib/errorTranslator';

export default function AnalysisBoard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Settings & Personalization
    const [lichessUsername, setLichessUsername] = useState('');
    const [engineDepth, setEngineDepth] = useState(14);
    
    // Ingestion States
    const [timeControls, setTimeControls] = useState(['blitz', 'rapid', 'classical']);
    const [dateRange, setDateRange] = useState('30'); // '7', '30', '90', 'all'
    const [maxGames, setMaxGames] = useState(20); // 10, 20, 50
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ stage: '', progress: 0 });
    const [results, setResults] = useState(null);
    const [ingestError, setIngestError] = useState(null);

    // Manual Import States
    const [pgnInput, setPgnInput] = useState('');
    const [savePuzzleColor, setSavePuzzleColor] = useState('white');
    const [saveStatus, setSaveStatus] = useState({ type: '', text: '' });
    const [pieceSet, setPieceSet] = useState('cburnett');

    // Toast Notification state
    const [toastMessage, setToastMessage] = useState(null);
    const [toastType, setToastType] = useState('success');

    // Playlists capacity states
    const [playlistsSpace, setPlaylistsSpace] = useState({ total: 0, isFull: false });
    const [hasPendingPuzzles, setHasPendingPuzzles] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [totalPuzzlesCount, setTotalPuzzlesCount] = useState(0);

    // Themed Confirm/Alert Dialog State
    const [confirmConfig, setConfirmConfig] = useState({
        show: false,
        title: '',
        message: '',
        type: 'confirm',
        onConfirm: null,
        onCancel: null
    });

    const showConfirm = (message, onConfirm = () => {}, onCancel = null, title = 'Confirm Action', type = 'confirm') => {
        setConfirmConfig({
            show: true,
            title,
            message,
            type,
            onConfirm: () => {
                onConfirm();
                setConfirmConfig(prev => ({ ...prev, show: false }));
            },
            onCancel: () => {
                if (onCancel) onCancel();
                setConfirmConfig(prev => ({ ...prev, show: false }));
            }
        });
    };

    // Subscribe to background service status
    useEffect(() => {
        const unsubscribe = backgroundAnalysisService.subscribe(state => {
            setAnalyzing(state.isRunning);
            if (state.isRunning) {
                setProgress(state.progress);
            } else {
                if (state.results) setResults(state.results);
                if (state.error) setIngestError(translateError(state.error));
            }
        });
        return () => unsubscribe();
    }, []);

    // Load profile and playlist capacities on mount
    useEffect(() => {
        if (user?.uid) {
            getUserProfile(user.uid).then(profile => {
                setLichessUsername(profile?.lichessUsername || '');
                if (profile?.settings?.pieceSet) {
                    setPieceSet(profile.settings.pieceSet);
                }
                if (profile?.settings?.engineDepth) {
                    setEngineDepth(profile.settings.engineDepth);
                }
            }).catch(() => {});

            getUserPlaylists(user.uid).then(allPlaylists => {
                const totalCurrent = allPlaylists
                    .filter(pl => pl.playlistIndex <= 2)
                    .reduce((sum, pl) => sum + pl.total, 0);
                setPlaylistsSpace({
                    total: totalCurrent,
                    isFull: totalCurrent >= 60
                });
            }).catch(err => console.error(err));

            getUserPuzzleStats(user.uid).then(stats => {
                setTotalPuzzlesCount(stats.total);
            }).catch(err => console.error(err));

            getPendingPuzzles(user.uid).then(pending => {
                setHasPendingPuzzles(pending && pending.length > 0);
            }).catch(() => {});
        }
    }, [user?.uid, location.search]);

    // Update puzzle counts and stats instantly when repertoire changes in Ingestion Wizard modal
    useEffect(() => {
        const handleRepertoireUpdate = () => {
            if (!user?.uid) return;
            getUserPlaylists(user.uid).then(allPlaylists => {
                const totalCurrent = allPlaylists
                    .filter(pl => pl.playlistIndex <= 2)
                    .reduce((sum, pl) => sum + pl.total, 0);
                setPlaylistsSpace({
                    total: totalCurrent,
                    isFull: totalCurrent >= 60
                });
            }).catch(err => console.error(err));

            getUserPuzzleStats(user.uid).then(stats => {
                setTotalPuzzlesCount(stats.total);
            }).catch(err => console.error(err));

            getPendingPuzzles(user.uid).then(pending => {
                setHasPendingPuzzles(pending && pending.length > 0);
            }).catch(() => {});
        };

        window.addEventListener('repertoire-updated', handleRepertoireUpdate);
        return () => {
            window.removeEventListener('repertoire-updated', handleRepertoireUpdate);
        };
    }, [user?.uid]);

    // Handle Time Control selections
    const handleToggleTimeControl = (tc) => {
        if (timeControls.includes(tc)) {
            setTimeControls(timeControls.filter(item => item !== tc));
        } else {
            setTimeControls([...timeControls, tc]);
        }
    };

    // Run Lichess scanner via Background Service
    const handleAnalyze = async () => {
        if (!lichessUsername) {
            setIngestError('No Lichess username linked. Please link your account first.');
            return;
        }
        if (timeControls.length === 0) {
            setIngestError('Please select at least one Time Control to scan.');
            return;
        }
        if (totalPuzzlesCount >= 70) {
            setIngestError('Scan blocked: Your repertoire is at maximum capacity (70/70 puzzles). Clear some puzzles or playlists to scan again.');
            return;
        }
        if (saveStatus.type === 'loading') {
            setIngestError('Scan blocked: A manual import is currently running. Please wait.');
            return;
        }

        // Check for pending unsaved puzzles first
        try {
            const pending = await getPendingPuzzles(user.uid);
            if (pending && pending.length > 0) {
                setHasPendingPuzzles(true);
                navigate('?review=true');
                return;
            }
        } catch (err) {
            console.warn('Failed to check pending puzzles before scan:', err);
        }

        setIngestError(null);
        setResults(null);
        backgroundAnalysisService.start(user.uid, {
            timeControls,
            dateRange,
            maxGames
        });
    };

    // Run manual PGN analysis for opening blunders (moves 1-10)
    const handleManualAnalyze = async () => {
        if (analyzing) {
            setSaveStatus({ type: 'error', text: 'Cannot start analysis while another scan is running.' });
            return;
        }
        if (!pgnInput.trim()) {
            setSaveStatus({ type: 'error', text: 'Please enter PGN text to analyze.' });
            return;
        }

        // Validate PGN structure
        try {
            const testChess = new Chess();
            testChess.loadPgn(pgnInput.trim());
            if (testChess.history().length === 0) {
                setSaveStatus({ type: 'error', text: 'The PGN contains no moves. Please enter a valid PGN.' });
                return;
            }
        } catch {
            setSaveStatus({ type: 'error', text: 'Invalid PGN format.' });
            return;
        }

        // Get current stats and remaining capacity
        setSaveStatus({ type: 'loading', text: 'Checking repertoire capacity...' });
        let remainingSpace = 0;
        try {
            const stats = await getUserPuzzleStats(user.uid);
            remainingSpace = Math.max(0, 70 - stats.total);
            setTotalPuzzlesCount(stats.total);
        } catch (err) {
            console.error('Failed to get user stats:', err);
        }

        if (remainingSpace <= 0) {
            showConfirm(
                'Import Locked: Your repertoire is at the maximum limit of 70 unique puzzles. Clear some puzzles or playlists to scan again.',
                () => {},
                null,
                'Repertoire Full',
                'warning'
            );
            setSaveStatus({ type: 'error', text: 'Repertoire capacity full (70/70).' });
            return;
        }

        setSaveStatus({ type: 'loading', text: 'Analyzing game opening (moves 1-10)...' });
        setAnalyzing(true);
        try {
            // Initialize engine
            engineService.init();
            // Wait for engine to be ready
            await new Promise(resolve => setTimeout(resolve, 500));

            const game = {
                id: `manual-${Date.now()}`,
                pgn: pgnInput.trim(),
                opening: null
            };

            // Analyze first 10 moves using the user's custom engine depth setting
            const puzzles = await gameAnalyzer.analyze(game, savePuzzleColor, engineDepth, remainingSpace);

            if (puzzles.length === 0) {
                setSaveStatus({ type: 'success', text: 'Analysis finished: No blunders found.' });
                showConfirm(
                    'No blunder puzzles were found in the first 10 moves (opening phase) of this game.',
                    () => {},
                    null,
                    'No Blunders Found',
                    'info'
                );
            } else {
                // Scenario 2: Deduplicate within the local game queue
                const uniqueToGame = [];
                puzzles.forEach(puzzle => {
                    const normFen = normalizeFen(puzzle.fen);
                    const localDup = uniqueToGame.find(p => normalizeFen(p.fen) === normFen);
                    if (localDup) {
                        localDup.recurrentCount = (localDup.recurrentCount || 0) + 1;
                    } else {
                        uniqueToGame.push(puzzle);
                    }
                });

                // Silently resolve duplicate puzzles in background (Scenario 3 / Scenario 1)
                const uniqueNewPuzzles = await processScanDuplicates(user.uid, uniqueToGame);
                
                if (uniqueNewPuzzles.length === 0) {
                    setSaveStatus({ type: 'success', text: 'Position already in Repertoire. puzzle weight boosted!' });
                    setToastMessage('Position already in Repertoire. Puzzle weight boosted!');
                    setToastType('success');
                    window.dispatchEvent(new CustomEvent('repertoire-updated'));
                    setPgnInput('');
                } else {
                    setSaveStatus({ type: 'success', text: `Analysis complete! Found ${uniqueNewPuzzles.length} blunder puzzle(s).` });
                    await savePendingPuzzles(user.uid, uniqueNewPuzzles);
                    window.dispatchEvent(new CustomEvent('repertoire-updated'));
                    setPgnInput('');
                    navigate('?review=true');
                }
            }
        } catch (err) {
            const translated = translateError(err);
            if (err.message === 'REPERTOIRE_LIMIT_EXCEEDED' || translated.includes('Repertoire Capacity Reached')) {
                setConfirmConfig({
                    show: true,
                    title: 'Repertoire Capacity Reached',
                    message: 'Your deck is currently capped at its maximum limit of 70 unique positions. Please review, master, or delete existing blunders before importing new ones.',
                    type: 'error',
                    confirmText: 'OK',
                    onConfirm: () => setConfirmConfig({ show: false, title: '', message: '', type: 'info' }),
                    onCancel: () => setConfirmConfig({ show: false, title: '', message: '', type: 'info' })
                });
                setSaveStatus({ type: '', text: '' });
            } else {
                setSaveStatus({ type: 'error', text: translated });
            }
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDismissPending = async () => {
        setShowDiscardConfirm(false);
        setSaveStatus({ type: 'loading', text: 'Discarding pending puzzles...' });
        try {
            await clearPendingPuzzles(user.uid);
            setHasPendingPuzzles(false);
            setSaveStatus({ type: 'success', text: 'Pending puzzles discarded.' });
            setTimeout(() => setSaveStatus({ type: '', text: '' }), 3000);
        } catch (err) {
            setSaveStatus({ type: 'error', text: translateError(err) });
            setTimeout(() => setSaveStatus({ type: '', text: '' }), 3000);
        }
    };


    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto pb-12 px-4 sm:px-6">
                {totalPuzzlesCount >= 70 && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md">
                        <div className="bg-chess-panel border border-red-500/30 max-w-md w-full rounded-2xl shadow-2xl p-8 relative overflow-hidden z-10 text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
                            <div className="w-16 h-16 bg-red-500/15 border border-red-500/25 text-red-400 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/5">
                                <AlertTriangle size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-serif font-bold text-white tracking-wide mb-2">Repertoire Capacity Reached</h3>
                                <p className="text-sm text-red-400 font-bold mb-1">Capacity: 70/70 Puzzles</p>
                                <p className="text-chess-text-secondary text-xs leading-relaxed mt-4 max-w-xs mx-auto">
                                    You have reached the maximum limit of 70 unique puzzles in your repertoire. 
                                    To scan new games or manually import positions, you must first delete some existing puzzles.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/dashboard/repertoire')}
                                className="mt-2 w-full py-3 bg-chess-accent hover:bg-chess-accent-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-chess-accent/15 transition-all hover:-translate-y-0.5"
                            >
                                Go to My Repertoire
                            </button>
                        </div>
                    </div>
                )}
                
                {/* Header Block */}
                <div className="mb-10 text-left relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-chess-accent/10 rounded-full blur-3xl pointer-events-none -z-10" />
                    <div className="flex items-center gap-3.5 mb-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-chess-accent/15 border border-chess-accent/20 flex items-center justify-center text-chess-accent shadow-lg shadow-chess-accent/5">
                            <Cpu size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-3.5xl font-serif font-bold text-white tracking-wide">Analysis Manager</h1>
                            <p className="text-chess-text-secondary text-sm">Automate match scanning or ingest custom board states to build your repertoires.</p>
                        </div>
                    </div>
                </div>

                <div className={`flex flex-col lg:flex-row gap-8 ${hasPendingPuzzles ? 'hidden' : ''}`}>
                    
                    {/* LEFT COLUMN: Lichess Automatic Scanner */}
                    <div className="flex-1 flex flex-col gap-6">
                        
                        {/* Connection Warning / Status */}
                        {!lichessUsername && (
                            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shrink-0">
                                        <AlertCircle className="text-amber-500" size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white mb-0.5">Lichess Account Required</h4>
                                        <p className="text-sm text-chess-text-secondary">
                                            You must link a Lichess username to run game scans. You can link your username in the Settings panel.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/dashboard/settings')}
                                    className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/15 hover:-translate-y-0.5"
                                >
                                    Configure Lichess Link
                                </button>
                            </div>
                        )}

                        {/* Scan Area Switcher (Configuration, Scanning, or Results) */}
                        {analyzing ? (
                            /* PROGRESS INDICATOR */
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-xl flex flex-col justify-center min-h-[350px] relative overflow-hidden">
                                <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/10 to-brand-med/10 rounded-3xl blur-[1px] -z-10" />
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="w-14 h-14 border-2 border-chess-accent border-t-transparent animate-spin rounded-full shrink-0 flex items-center justify-center shadow-lg shadow-chess-accent/10">
                                        <Cpu size={24} className="text-chess-accent animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white mb-1">Scanning Games</h3>
                                        <p className="text-chess-text-secondary text-sm font-medium">{progress.stage}</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-black/35 rounded-full h-4 overflow-hidden border border-white/5 p-0.5">
                                    <div
                                        className="h-full bg-gradient-to-r from-chess-accent to-emerald-500 transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(235,94,85,0.4)]"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs font-bold text-chess-text-secondary mt-3 px-1">
                                    <span className="uppercase tracking-wider text-[10px]">Stockfish centipawn analyzer active</span>
                                    <span>{Math.round(progress.progress)}% Complete</span>
                                </div>
                            </div>
                        ) : results ? (
                            /* SCAN RESULTS */
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden animate-in">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />
                                <div className="flex items-center gap-3.5 mb-8">
                                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5">
                                        <CheckCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-wide">Ingestion Complete</h3>
                                        <p className="text-chess-text-secondary text-sm font-medium">Summary of parsed matches and newly generated puzzles</p>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col justify-center transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5">
                                        <p className="text-[10px] text-chess-text-secondary font-extrabold uppercase tracking-widest mb-1.5">Games Fetched</p>
                                        <p className="text-3.5xl font-mono font-extrabold text-white">{results.gamesFetched}</p>
                                    </div>
                                    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col justify-center transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5">
                                        <p className="text-[10px] text-chess-text-secondary font-extrabold uppercase tracking-widest mb-1.5">Games Analysed</p>
                                        <p className="text-3.5xl font-mono font-extrabold text-chess-accent">{results.gamesAnalyzed}</p>
                                    </div>
                                    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col justify-center transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5">
                                        <p className="text-[10px] text-chess-text-secondary font-extrabold uppercase tracking-widest mb-1.5">New Puzzles</p>
                                        <p className="text-3.5xl font-mono font-extrabold text-emerald-450">{results.puzzlesGenerated}</p>
                                    </div>
                                    <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 flex flex-col justify-center transition-all duration-300 hover:bg-white/[0.04] hover:border-white/10 hover:-translate-y-0.5">
                                        <p className="text-[10px] text-chess-text-secondary font-extrabold uppercase tracking-widest mb-1.5">Skipped (Dupes)</p>
                                        <p className="text-3.5xl font-mono font-extrabold text-white/50">{results.gamesSkipped}</p>
                                    </div>
                                </div>

                                {results.errors && results.errors.length > 0 && (
                                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-8 flex items-start gap-3">
                                        <XCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <p className="text-sm font-bold text-white">Scanner warning</p>
                                            <p className="text-xs text-chess-text-secondary mt-0.5">
                                                {results.errors.length} game(s) had move errors or incomplete PGN data. They will be retried automatically in subsequent scans.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="flex-1 py-3.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-chess-accent/15 cursor-pointer active:scale-[0.98] duration-200 hover:-translate-y-0.5"
                                    >
                                        <Home size={16} />
                                        Return to Dashboard
                                    </button>
                                    <button
                                        onClick={() => {
                                            setResults(null);
                                            setIngestError(null);
                                        }}
                                        className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] duration-200 hover:-translate-y-0.5"
                                    >
                                        <Play size={16} fill="currentColor" />
                                        Scan More Games
                                    </button>
                                </div>
                            </div>
                        ) : ingestError ? (
                            /* ERROR BLOCK */
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-xl relative overflow-hidden animate-in">
                                <div className="absolute -inset-px bg-gradient-to-r from-red-500/10 to-transparent rounded-3xl blur-[1px] -z-10" />
                                <div className="flex items-center gap-3.5 mb-6">
                                    <div className="w-12 h-12 bg-red-500/15 border border-red-500/25 rounded-2xl flex items-center justify-center text-red-400">
                                        <XCircle size={26} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-white">Scanner Error</h3>
                                        <p className="text-chess-text-secondary text-sm">The game ingestion scanner failed to finish</p>
                                    </div>
                                </div>
                                <p className="text-chess-text-secondary text-sm mb-8 bg-red-500/5 border border-red-500/10 p-4 rounded-xl leading-relaxed font-mono text-xs">
                                    {ingestError}
                                </p>
                                <button
                                    onClick={() => setIngestError(null)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all"
                                >
                                    Go Back
                                </button>
                            </div>
                        ) : (
                            /* CONFIGURATION CARD */
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-chess-accent/[0.03] rounded-full blur-3xl pointer-events-none" />

                                <h3 className="text-2.5xl font-bold font-serif text-white mb-8 flex items-center gap-3">
                                    <Cpu size={24} className="text-chess-accent" />
                                    <span>Lichess Scan Parameters</span>
                                </h3>



                                {playlistsSpace.isFull && (
                                    <div className="mb-8 flex items-start gap-4 bg-amber-500/10 border border-amber-500/25 p-5 rounded-2xl text-amber-500">
                                        <AlertCircle size={22} className="shrink-0 mt-0.5" />
                                        <div>
                                            <h5 className="font-bold text-white text-base">Standard Playlists Capacity Full (60/60 Puzzles)</h5>
                                            <p className="text-sm text-chess-text-secondary mt-1">
                                                Your standard training playlists have reached their limit of 60 puzzles. New scanned puzzles can only be saved to your Favorites set (max 10).
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    {/* 1. Time Control Picker */}
                                    <div className="space-y-3">
                                        <label className="text-base font-bold text-white flex items-center gap-2">
                                            <Clock size={18} className="text-chess-accent" />
                                            <span>Target Time Controls</span>
                                        </label>
                                        <p className="text-sm text-chess-text-secondary mb-4">Select the match formats you wish to scan for blunders:</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {[
                                                { id: 'bullet', label: 'Bullet', icon: <Zap size={20} /> },
                                                { id: 'blitz', label: 'Blitz', icon: <Flame size={20} /> },
                                                { id: 'rapid', label: 'Rapid', icon: <Clock size={20} /> },
                                                { id: 'classical', label: 'Classical', icon: <Cpu size={20} /> }
                                            ].map(tc => {
                                                const isSelected = timeControls.includes(tc.id);
                                                return (
                                                    <button
                                                        key={tc.id}
                                                        type="button"
                                                        onClick={() => handleToggleTimeControl(tc.id)}
                                                        className={`p-4 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-3 hover:scale-[1.02] cursor-pointer ${
                                                            isSelected
                                                                ? 'border-chess-accent bg-chess-accent/15 text-white shadow-md shadow-chess-accent/5'
                                                                : 'border-white/5 bg-black/20 text-chess-text-secondary hover:border-white/10 hover:text-white'
                                                        }`}
                                                    >
                                                        <div className={isSelected ? 'text-chess-accent' : 'text-chess-text-secondary opacity-60'}>
                                                            {tc.icon}
                                                        </div>
                                                        <span className="text-sm font-bold">{tc.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Custom Date Range Pill Selector */}
                                    <div className="space-y-3 pt-3">
                                        <label className="text-base font-bold text-white flex items-center gap-2">
                                            <Calendar size={18} className="text-chess-accent" />
                                            <span>Scan History Horizon</span>
                                        </label>
                                        <p className="text-sm text-chess-text-secondary mb-4">Filter games played within this timeframe:</p>
                                        <div className="flex flex-wrap gap-2.5 p-2 bg-black/25 rounded-2xl border border-white/5 w-fit">
                                            {[
                                                { value: '7', label: '7 Days' },
                                                { value: '30', label: '30 Days' },
                                                { value: '90', label: '90 Days' },
                                                { value: 'all', label: 'All Time' }
                                            ].map(opt => {
                                                const isSelected = dateRange === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setDateRange(opt.value)}
                                                        className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-chess-accent text-white shadow-sm'
                                                                : 'text-chess-text-secondary hover:text-white bg-transparent'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 3. Custom Limit Selector */}
                                    <div className="space-y-3 pt-3">
                                        <label className="text-base font-bold text-white flex items-center gap-2">
                                            <Hash size={18} className="text-chess-accent" />
                                            <span>Scan Capacity Limit</span>
                                        </label>
                                        <p className="text-sm text-chess-text-secondary mb-4">Maximum number of games to analyze in this batch:</p>
                                        <div className="flex flex-wrap gap-2.5 p-2 bg-black/25 rounded-2xl border border-white/5 w-fit">
                                            {[
                                                { value: 1, label: '1 Game' },
                                                { value: 5, label: '5 Games' },
                                                { value: 10, label: '10 Games' },
                                                { value: 20, label: '20 Games' },
                                                { value: 50, label: '50 Games' }
                                            ].map(opt => {
                                                const isSelected = maxGames === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setMaxGames(opt.value)}
                                                        className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                                                            isSelected
                                                                ? 'bg-chess-accent text-white shadow-sm'
                                                                : 'text-chess-text-secondary hover:text-white bg-transparent'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Scan trigger */}
                                <button
                                    onClick={handleAnalyze}
                                    disabled={!lichessUsername || timeControls.length === 0 || saveStatus.type === 'loading' || totalPuzzlesCount >= 70}
                                    className="mt-10 w-full py-3.5 bg-chess-accent hover:bg-chess-accent-hover disabled:bg-white/5 disabled:to-white/5 disabled:text-white/20 text-white text-sm rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-chess-accent/15 disabled:shadow-none hover:-translate-y-0.5 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] duration-200"
                                >
                                    <Play size={16} fill="currentColor" />
                                    {saveStatus.type === 'loading' ? 'Manual Import Active...' : totalPuzzlesCount >= 70 ? 'Repertoire Full (70/70)' : 'Scan & Analyze Games'}
                                </button>
                            </div>
                        )}

                        {/* Scanner guide */}
                        {!analyzing && !results && !ingestError && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                                <h3 className="font-bold text-white mb-2 text-sm flex items-center gap-2">
                                    <Sparkles size={16} className="text-chess-accent" />
                                    <span>How scanning works</span>
                                </h3>
                                <ul className="space-y-2.5 text-xs text-chess-text-secondary">
                                    <li className="flex items-start gap-2">
                                        <span className="text-chess-accent select-none mt-0.5">•</span>
                                        We fetch matches matching your selections directly from Lichess's public API.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-chess-accent select-none mt-0.5">•</span>
                                        Stockfish runs client-side to find positions where you made a mistake (≥ 1.0 centipawn evaluation loss).
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-chess-accent select-none mt-0.5">•</span>
                                        Custom chess cards are generated for each blunder, placing them directly into your training deck.
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Manual Import (PGN) */}
                    <div className="w-full lg:w-[400px] shrink-0">
                        <div className="bg-chess-panel border border-white/5 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col relative">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-chess-accent/[0.02] rounded-full blur-2xl pointer-events-none" />

                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5">
                                <Upload size={18} className="text-chess-accent" />
                                <span>Manual Position Import</span>
                            </h3>

                            {/* Status Notification */}
                            {saveStatus.text && (
                                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 mb-4 animate-in ${
                                    saveStatus.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                                        : saveStatus.type === 'error'
                                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                            : 'bg-white/5 border-white/10 text-chess-text-secondary'
                                }`}>
                                    <span>{saveStatus.text}</span>
                                </div>
                            )}

                            {/* Input Form Fields */}
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label htmlFor="pgnInput" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">PGN Text</label>
                                    <textarea
                                        id="pgnInput"
                                        value={pgnInput}
                                        onChange={(e) => setPgnInput(e.target.value)}
                                        placeholder="1. e4 e5 2. Nf3 Nc6..."
                                        className="w-full h-24 bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs p-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-all resize-none scrollbar-thin font-mono"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Side to Analyze</label>
                                    <div className="grid grid-cols-3 gap-1 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setSavePuzzleColor('white')}
                                            title="White to Play"
                                            className={`py-3 px-1 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                                                savePuzzleColor === 'white'
                                                    ? 'bg-chess-accent text-white shadow'
                                                    : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <img
                                                src={getPieceImageUrl(pieceSet, 'w', 'k')}
                                                alt="White King"
                                                className="w-9 h-9 object-contain drop-shadow"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSavePuzzleColor('black')}
                                            title="Black to Play"
                                            className={`py-3 px-1 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                                                savePuzzleColor === 'black'
                                                    ? 'bg-chess-accent text-white shadow'
                                                    : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <img
                                                src={getPieceImageUrl(pieceSet, 'b', 'k')}
                                                alt="Black King"
                                                className="w-9 h-9 object-contain drop-shadow"
                                            />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSavePuzzleColor('both')}
                                            title="Both Sides"
                                            className={`py-3 px-1 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                                                savePuzzleColor === 'both'
                                                    ? 'bg-chess-accent text-white shadow'
                                                    : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="flex items-center -space-x-2 shrink-0">
                                                <img
                                                    src={getPieceImageUrl(pieceSet, 'w', 'k')}
                                                    alt="White King"
                                                    className="w-7 h-7 object-contain drop-shadow relative z-10"
                                                />
                                                <img
                                                    src={getPieceImageUrl(pieceSet, 'b', 'k')}
                                                    alt="Black King"
                                                    className="w-7 h-7 object-contain drop-shadow"
                                                />
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleManualAnalyze}
                                disabled={saveStatus.type === 'loading' || analyzing || totalPuzzlesCount >= 70}
                                className="mt-6 w-full py-3.5 bg-chess-accent hover:bg-chess-accent-hover text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {analyzing ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Analyzing Game...
                                    </>
                                ) : (
                                    <>
                                        <Brain size={16} />
                                        Start Analysis
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                </div>

                {hasPendingPuzzles && (
                    <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden max-w-2xl mx-auto text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -inset-px bg-gradient-to-r from-amber-500/10 to-transparent rounded-3xl blur-[1px] -z-10" />
                        
                        <div className="w-16 h-16 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5">
                            <Brain size={32} className="animate-pulse" />
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-serif font-bold text-white tracking-wide mb-2">Unsaved Scans Pending</h3>
                            <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md mx-auto">
                                You have unsaved blunder puzzles from your previous Lichess scan. 
                                To maintain training deck organization and prevent capacity limit overflows, manual imports and new automatic scans are paused until you save or discard these puzzles.
                            </p>
                        </div>

                        {saveStatus.text && (
                            <div className={`w-full max-w-sm p-3 rounded-xl border text-xs flex items-center justify-center gap-2 animate-in ${
                                saveStatus.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                                    : saveStatus.type === 'error'
                                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                        : 'bg-white/5 border-white/10 text-chess-text-secondary'
                            }`}>
                                <span>{saveStatus.text}</span>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center pt-2">
                            <button
                                onClick={() => navigate('?review=true')}
                                className="px-6 py-3.5 bg-chess-accent hover:bg-chess-accent-hover text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-chess-accent/15 cursor-pointer active:scale-[0.98] duration-200 hover:-translate-y-0.5"
                            >
                                Review & Save Puzzles
                            </button>
                            <button
                                onClick={() => setShowDiscardConfirm(true)}
                                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/10 cursor-pointer active:scale-[0.98] duration-200 hover:-translate-y-0.5"
                            >
                                Discard Unsaved Puzzles
                            </button>
                        </div>
                    </div>
                )}

                {showDiscardConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setShowDiscardConfirm(false)} />

                        {/* Modal Card */}
                        <div className="bg-chess-panel border border-amber-500/30 max-w-md w-full rounded-2xl shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
                            {/* Accent background glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />

                            <div className="flex items-center gap-3 text-amber-500 mb-4">
                                <AlertTriangle size={32} />
                                <h3 className="text-xl font-bold font-serif text-white">Discard Unsaved Puzzles</h3>
                            </div>

                            <p className="text-chess-text-secondary text-sm mb-3 leading-relaxed">
                                Are you sure you want to discard these pending blunder puzzles? They will be permanently removed from your cache.
                            </p>

                            <p className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-3 rounded-xl text-xs font-semibold leading-relaxed mb-6">
                                ⚠️ Note: Discarding allows you to scan new games. The system will treat these games as unscanned in your future analyses.
                            </p>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowDiscardConfirm(false)}
                                    className="px-4 py-2 text-sm text-chess-text-secondary hover:text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDismissPending}
                                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-amber-500/15 flex items-center gap-2 cursor-pointer"
                                >
                                    Yes, Discard Puzzles
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Themed Alert/Confirm Modal */}
                <ThemedDialog
                    open={confirmConfig.show}
                    title={confirmConfig.title}
                    message={confirmConfig.message}
                    type={confirmConfig.type}
                    onConfirm={confirmConfig.onConfirm}
                    onCancel={confirmConfig.onCancel}
                />

                {/* Toast Notification */}
                {toastMessage && (
                    <Toast
                        message={toastMessage}
                        type={toastType}
                        onClose={() => setToastMessage(null)}
                    />
                )}

            </div>
        </DashboardLayout>
    );
}
