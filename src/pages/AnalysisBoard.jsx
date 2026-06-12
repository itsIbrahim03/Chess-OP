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
import { saveCustomPuzzle, getUserPlaylists, createPlaylist, getPendingPuzzles, clearPendingPuzzles } from '../services/puzzleService';
import { backgroundAnalysisService } from '../services/backgroundAnalysisService';
import { getPieceImageUrl } from '../lib/pieceSets';
import { engineService } from '../services/engineService';
import { OpeningDetector } from '../lib/openingDetector';

export default function AnalysisBoard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Settings & Personalization
    const [lichessUsername, setLichessUsername] = useState('');
    
    // Ingestion States
    const [timeControls, setTimeControls] = useState(['blitz', 'rapid', 'classical']);
    const [dateRange, setDateRange] = useState('30'); // '7', '30', '90', 'all'
    const [maxGames, setMaxGames] = useState(20); // 10, 20, 50
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ stage: '', progress: 0 });
    const [results, setResults] = useState(null);
    const [ingestError, setIngestError] = useState(null);

    // Manual Import States
    const [importTab, setImportTab] = useState('fen'); // 'fen' | 'pgn'
    const [fenInput, setFenInput] = useState('');
    const [pgnInput, setPgnInput] = useState('');
    const [savePuzzleColor, setSavePuzzleColor] = useState('white');
    const [savePuzzleName, setSavePuzzleName] = useState('');
    const [savePuzzleOpening, setSavePuzzleOpening] = useState('');
    const [savePlaylistIdx, setSavePlaylistIdx] = useState('0'); // '0' | '1' | '2' | 'fav'
    const [saveStatus, setSaveStatus] = useState({ type: '', text: '' });
    const [pieceSet, setPieceSet] = useState('cburnett');
    const [isPlaylistDropdownOpen, setIsPlaylistDropdownOpen] = useState(false);

    // Playlists capacity states
    const [playlistsSpace, setPlaylistsSpace] = useState({ total: 0, isFull: false });
    const [availablePlaylists, setAvailablePlaylists] = useState([]);
    const [totalPlaylistsCount, setTotalPlaylistsCount] = useState(0);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [hasPendingPuzzles, setHasPendingPuzzles] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

    // Subscribe to background service status
    useEffect(() => {
        const unsubscribe = backgroundAnalysisService.subscribe(state => {
            setAnalyzing(state.isRunning);
            if (state.isRunning) {
                setProgress(state.progress);
            } else {
                if (state.results) setResults(state.results);
                if (state.error) setIngestError(state.error);
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
            }).catch(() => {});

            getUserPlaylists(user.uid).then(allPlaylists => {
                setTotalPlaylistsCount(allPlaylists.length);
                const totalCurrent = allPlaylists
                    .filter(pl => pl.playlistIndex <= 2)
                    .reduce((sum, pl) => sum + pl.total, 0);
                setPlaylistsSpace({
                    total: totalCurrent,
                    isFull: totalCurrent >= 60
                });

                const available = allPlaylists.filter(pl => pl.total < 20).map(pl => ({
                    index: pl.playlistIndex,
                    title: pl.title,
                    total: pl.total
                }));
                setAvailablePlaylists(available);
                if (available.length > 0) {
                    setSavePlaylistIdx(available[0].index.toString());
                } else {
                    setSavePlaylistIdx('fav');
                }
            }).catch(err => console.error(err));

            getPendingPuzzles(user.uid).then(pending => {
                setHasPendingPuzzles(pending && pending.length > 0);
            }).catch(() => {});
        }
    }, [user?.uid, location.search]);

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
        if (playlistsSpace.isFull) {
            setIngestError('Scan blocked: Your playlists are at full capacity (60/60). Please review or clear standard playlists first.');
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

    // Save puzzle manually
    const handleSavePuzzle = async () => {
        let targetFen = '';
        let pgnOpening = '';

        if (importTab === 'fen') {
            if (!fenInput.trim()) {
                setSaveStatus({ type: 'error', text: 'Please enter a FEN string' });
                return;
            }
            try {
                const testChess = new Chess(fenInput.trim());
                targetFen = testChess.fen();
            } catch {
                setSaveStatus({ type: 'error', text: 'Invalid FEN string' });
                return;
            }
        } else {
            if (!pgnInput.trim()) {
                setSaveStatus({ type: 'error', text: 'Please enter a PGN string' });
                return;
            }
            try {
                const testChess = new Chess();
                testChess.loadPgn(pgnInput.trim());
                targetFen = testChess.fen();
                
                const headers = testChess.header();
                pgnOpening = headers.Opening || headers.opening || '';
            } catch {
                setSaveStatus({ type: 'error', text: 'Invalid PGN string' });
                return;
            }
        }

        try {
            // Ensure targetFen turn matches savePuzzleColor
            const fenParts = targetFen.split(' ');
            if (fenParts[1] !== (savePuzzleColor === 'white' ? 'w' : 'b')) {
                fenParts[1] = savePuzzleColor === 'white' ? 'w' : 'b';
                fenParts[4] = '0';
                fenParts[5] = '1';
                targetFen = fenParts.join(' ');
            }

            // Validate position after turn sync
            try {
                const testChess = new Chess(targetFen);
                if (testChess.isGameOver()) {
                    setSaveStatus({ type: 'error', text: 'The position is already checkmate, stalemate, or drawn.' });
                    return;
                }
            } catch {
                setSaveStatus({ type: 'error', text: 'Invalid position for the selected turn color.' });
                return;
            }

            setSaveStatus({ type: 'loading', text: 'Analyzing position...' });

            // Let the engine calculate the best move
            engineService.init();
            const analysis = await engineService.evaluatePosition(targetFen, 12);
            const calculatedMove = analysis?.bestMove;

            if (!calculatedMove || calculatedMove === '(none)') {
                setSaveStatus({ type: 'error', text: 'Engine failed to find a valid move for this position.' });
                return;
            }

            let finalPlIdx = savePlaylistIdx;
            const isFav = savePlaylistIdx === 'fav';

            if (savePlaylistIdx === 'create_new') {
                if (!newPlaylistName.trim()) {
                    setSaveStatus({ type: 'error', text: 'Please enter a name for the new playlist.' });
                    return;
                }
                setSaveStatus({ type: 'loading', text: 'Creating new playlist...' });
                const newIdx = await createPlaylist(user.uid, newPlaylistName);
                finalPlIdx = newIdx.toString();
                setNewPlaylistName('');
            }

            setSaveStatus({ type: 'loading', text: 'Saving puzzle...' });
            const playlistIndex = isFav ? 0 : parseInt(finalPlIdx, 10);

            let resolvedOpening = savePuzzleOpening.trim();
            if (!resolvedOpening) {
                resolvedOpening = pgnOpening;
            }
            if (!resolvedOpening) {
                try {
                    const detected = OpeningDetector.detect(targetFen);
                    if (detected) {
                        resolvedOpening = detected.name;
                    }
                } catch (e) {
                    console.warn('Failed to detect opening from FEN:', e);
                }
            }
            if (!resolvedOpening) {
                resolvedOpening = 'Custom Import';
            }

            await saveCustomPuzzle(user.uid, {
                fen: targetFen,
                correctMove: calculatedMove,
                customName: savePuzzleName.trim() || 'Custom Position',
                opening: resolvedOpening,
                theme: 'Custom Ingestion',
                userColor: savePuzzleColor,
                isFavorite: isFav,
                playlistIndex
            });

            // Refresh playlists data
            try {
                const allPlaylists = await getUserPlaylists(user.uid);
                setTotalPlaylistsCount(allPlaylists.length);
                const totalCurrent = allPlaylists
                    .filter(pl => pl.playlistIndex <= 2)
                    .reduce((sum, pl) => sum + pl.total, 0);
                setPlaylistsSpace({
                    total: totalCurrent,
                    isFull: totalCurrent >= 60
                });

                const available = allPlaylists.filter(pl => pl.total < 20).map(pl => ({
                    index: pl.playlistIndex,
                    title: pl.title,
                    total: pl.total
                }));
                setAvailablePlaylists(available);
                setSavePlaylistIdx(finalPlIdx);
            } catch (e) {
                console.error('Failed to reload playlists after save:', e);
            }

            setSaveStatus({ type: 'success', text: `Puzzle saved successfully! Best move: ${calculatedMove}` });
            setSavePuzzleName('');
            setSavePuzzleOpening('');
            setFenInput('');
            setPgnInput('');
            setTimeout(() => {
                setSaveStatus({ type: '', text: '' });
            }, 4000);
        } catch (err) {
            console.error('Failed to save manual puzzle:', err);
            setSaveStatus({ type: 'error', text: `Failed to save: ${err.message}` });
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
            console.error('Failed to clear pending puzzles:', err);
            setSaveStatus({ type: 'error', text: 'Failed to discard puzzles. Please try again.' });
            setTimeout(() => setSaveStatus({ type: '', text: '' }), 3000);
        }
    };

    const selectedPlaylist = savePlaylistIdx === 'fav'
        ? { title: 'Starred / Favorites', total: null }
        : savePlaylistIdx === 'create_new'
            ? { title: 'Create New Playlist...', total: null }
            : availablePlaylists.find(pl => pl.index.toString() === savePlaylistIdx);

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto pb-12 px-4 sm:px-6">
                
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
                                    <div className="mb-8 flex items-start gap-4 bg-red-500/10 border border-red-500/25 p-5 rounded-2xl text-red-400">
                                        <AlertCircle size={22} className="shrink-0 mt-0.5" />
                                        <div>
                                            <h5 className="font-bold text-white text-base">Playlists Capacity Full (60/60 Puzzles)</h5>
                                            <p className="text-sm text-chess-text-secondary mt-1">
                                                Your training decks have reached their maximum combined limit of 60 puzzles. Please clear or master some puzzles to free up space before scanning new matches.
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
                                    disabled={!lichessUsername || timeControls.length === 0 || playlistsSpace.isFull}
                                    className="mt-10 w-full py-3.5 bg-chess-accent hover:bg-chess-accent-hover disabled:bg-white/5 disabled:to-white/5 disabled:text-white/20 text-white text-sm rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-chess-accent/15 disabled:shadow-none hover:-translate-y-0.5 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] duration-200"
                                >
                                    <Play size={16} fill="currentColor" />
                                    {playlistsSpace.isFull ? 'Scanning Disabled (Capacity Reached)' : 'Scan & Analyze Games'}
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
                                        Stockfish runs client-side to find positions where you made a mistake (≥ 1.0 ELO evaluation loss).
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-chess-accent select-none mt-0.5">•</span>
                                        Custom chess cards are generated for each blunder, placing them directly into your training deck.
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Manual Import (PGN / FEN) */}
                    <div className="w-full lg:w-[400px] shrink-0">
                        <div className="bg-chess-panel border border-white/5 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col relative">
                            <div className="absolute top-0 right-0 w-48 h-48 bg-chess-accent/[0.02] rounded-full blur-2xl pointer-events-none" />

                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5">
                                <Upload size={18} className="text-chess-accent" />
                                <span>Manual Position Import</span>
                            </h3>

                            {/* FEN/PGN mini-tab switcher */}
                            <div className="flex p-1 bg-black/25 border border-white/5 rounded-xl mb-5">
                                <button
                                    type="button"
                                    onClick={() => { setImportTab('fen'); setSaveStatus({ type: '', text: '' }); }}
                                    className={`flex-1 py-2 font-bold text-xs flex items-center justify-center gap-1.5 rounded-lg transition-all ${
                                        importTab === 'fen' 
                                            ? 'bg-chess-accent text-white shadow'
                                            : 'text-chess-text-secondary hover:text-white'
                                    }`}
                                >
                                    <Search size={14} /> FEN String
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setImportTab('pgn'); setSaveStatus({ type: '', text: '' }); }}
                                    className={`flex-1 py-2 font-bold text-xs flex items-center justify-center gap-1.5 rounded-lg transition-all ${
                                        importTab === 'pgn' 
                                            ? 'bg-chess-accent text-white shadow'
                                            : 'text-chess-text-secondary hover:text-white'
                                    }`}
                                >
                                    <FileText size={14} /> Full PGN
                                </button>
                            </div>

                            {/* Status Notification */}
                            {saveStatus.text && (
                                <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 mb-4 animate-in ${
                                    saveStatus.type === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                                        : saveStatus.type === 'error'
                                            ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                            : 'bg-white/5 border-white/10 text-chess-text-secondary'
                                }`}>
                                    <span>{saveStatus.text}</span>
                                </div>
                            )}

                            {/* Input Form Fields */}
                            <div className="space-y-4">
                                {importTab === 'fen' ? (
                                    <div className="space-y-1.5">
                                        <label htmlFor="fenInput" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">FEN String</label>
                                        <input
                                            id="fenInput"
                                            type="text"
                                            value={fenInput}
                                            onChange={(e) => setFenInput(e.target.value)}
                                            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                                            className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-3 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-all font-mono"
                                        />
                                    </div>
                                ) : (
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
                                )}

                                <div className="space-y-1.5">
                                    <label htmlFor="puzzleName" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Puzzle Title</label>
                                    <input
                                        id="puzzleName"
                                        type="text"
                                        value={savePuzzleName}
                                        onChange={(e) => setSavePuzzleName(e.target.value)}
                                        placeholder="e.g. Pin on the knight"
                                        className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label htmlFor="puzzleOpening" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Opening Name / Tag</label>
                                    <input
                                        id="puzzleOpening"
                                        type="text"
                                        value={savePuzzleOpening}
                                        onChange={(e) => setSavePuzzleOpening(e.target.value)}
                                        placeholder="e.g. Caro-Kann Defense"
                                        className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Side to Move</label>
                                    <div className="grid grid-cols-2 gap-3 bg-black/20 p-1.5 rounded-xl border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setSavePuzzleColor('white')}
                                            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                savePuzzleColor === 'white'
                                                    ? 'bg-chess-accent text-white shadow font-bold'
                                                    : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <img
                                                src={getPieceImageUrl(pieceSet, 'w', 'k')}
                                                alt="White King"
                                                className="w-6 h-6 object-contain drop-shadow"
                                            />
                                            <span>White to Play</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSavePuzzleColor('black')}
                                            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                                savePuzzleColor === 'black'
                                                    ? 'bg-chess-accent text-white shadow font-bold'
                                                    : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <img
                                                src={getPieceImageUrl(pieceSet, 'b', 'k')}
                                                alt="Black King"
                                                className="w-6 h-6 object-contain drop-shadow"
                                            />
                                            <span>Black to Play</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 relative">
                                    <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Add to Playlist</label>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setIsPlaylistDropdownOpen(!isPlaylistDropdownOpen)}
                                        className="w-full bg-chess-bg border border-white/10 hover:border-chess-accent/30 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white flex justify-between items-center transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {savePlaylistIdx === 'fav' ? (
                                                <span className="text-yellow-400">⭐</span>
                                            ) : savePlaylistIdx === 'create_new' ? (
                                                <span className="text-chess-accent">➕</span>
                                            ) : (
                                                <Folder size={14} className="text-chess-accent" />
                                            )}
                                            <span className="font-semibold text-chess-text-primary text-left">
                                                {savePlaylistIdx === 'fav' ? 'Starred / Favorites' : (savePlaylistIdx === 'create_new' ? 'Create New Playlist...' : (selectedPlaylist?.title || 'Select Playlist'))}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {savePlaylistIdx !== 'fav' && savePlaylistIdx !== 'create_new' && selectedPlaylist && (
                                                <span className="text-[10px] text-chess-text-secondary">({selectedPlaylist.total}/20)</span>
                                            )}
                                            <ChevronDown size={14} className={`text-chess-text-secondary transition-transform duration-200 ${isPlaylistDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {isPlaylistDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsPlaylistDropdownOpen(false)} />
                                            <div className="absolute z-20 mt-1 w-full bg-chess-panel border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                                {availablePlaylists.map(pl => (
                                                    <button
                                                        key={pl.index}
                                                        type="button"
                                                        onClick={() => {
                                                            setSavePlaylistIdx(pl.index.toString());
                                                            setIsPlaylistDropdownOpen(false);
                                                        }}
                                                        className={`w-full py-2 px-2.5 text-left text-xs font-semibold rounded-lg transition-all flex justify-between items-center cursor-pointer ${
                                                            savePlaylistIdx === pl.index.toString()
                                                                ? 'bg-chess-accent/15 text-white'
                                                                : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Folder size={14} className="opacity-70 text-chess-accent" />
                                                            <span>{pl.title}</span>
                                                        </div>
                                                        <span className="text-[10px] opacity-65">({pl.total}/20)</span>
                                                    </button>
                                                ))}
                                                {totalPlaylistsCount < 3 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSavePlaylistIdx('create_new');
                                                            setIsPlaylistDropdownOpen(false);
                                                        }}
                                                        className={`w-full py-2 px-2.5 text-left text-xs font-semibold rounded-lg transition-all flex justify-between items-center cursor-pointer ${
                                                            savePlaylistIdx === 'create_new'
                                                                ? 'bg-chess-accent/15 text-white font-bold'
                                                                : 'text-chess-text-secondary hover:text-white hover:bg-white/5'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 text-chess-accent font-bold">
                                                            <span>➕</span>
                                                            <span>Create New Playlist...</span>
                                                        </div>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSavePlaylistIdx('fav');
                                                        setIsPlaylistDropdownOpen(false);
                                                    }}
                                                    className={`w-full py-2 px-2.5 text-left text-xs font-semibold rounded-lg transition-all flex justify-between items-center cursor-pointer ${
                                                        savePlaylistIdx === 'fav'
                                                            ? 'bg-yellow-500/10 text-yellow-400 font-bold'
                                                            : 'text-chess-text-secondary hover:text-yellow-400 hover:bg-yellow-500/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span>⭐</span>
                                                        <span>Starred / Favorites</span>
                                                    </div>
                                                    <span className="text-[10px] opacity-65">(Max 10)</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {savePlaylistIdx === 'create_new' && (
                                    <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                                        <label htmlFor="newPlaylistName" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">New Playlist Name</label>
                                        <input
                                            id="newPlaylistName"
                                            type="text"
                                            value={newPlaylistName}
                                            onChange={(e) => setNewPlaylistName(e.target.value)}
                                            placeholder="Enter playlist name..."
                                            className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                        />
                                    </div>
                                )}


                            </div>

                            <button
                                onClick={handleSavePuzzle}
                                disabled={saveStatus.type === 'loading'}
                                className="mt-6 w-full py-3.5 bg-chess-accent hover:bg-chess-accent-hover text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
                            >
                                <Save size={16} /> Save to Playlist
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
                                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
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

            </div>
        </DashboardLayout>
    );
}
