import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/userService';
import { getBoardTheme } from '../lib/boardThemes';
import { getPieceSet } from '../lib/pieceSets';
import { engineService } from '../services/engineService';
import {
    Play, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    RotateCcw, Upload, FileText, Search, ShieldAlert, Cpu, Sparkles, HelpCircle, Star, Save,
    Clock, Calendar, Hash, Home, AlertCircle, XCircle, CheckCircle, ArrowRight, History
} from 'lucide-react';
import { saveCustomPuzzle } from '../services/puzzleService';
import { analyzeUserGames } from '../services/analysisOrchestrator';

// Import chessground CSS
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

export default function AnalysisBoard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Tab State
    const [activeAnalysisTab, setActiveAnalysisTab] = useState(location.state?.activeTab || 'ingest');
    const [sidebarTab, setSidebarTab] = useState('history'); // history | import | save

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveAnalysisTab(location.state.activeTab);
        }
    }, [location.state]);
    
    // Board references
    const boardRef = useRef(null);
    const cgRef = useRef(null);
    const chessRef = useRef(new Chess());
    
    // Settings & Personalization states
    const [boardTheme, setBoardTheme] = useState(null);
    const [pieceSet, setPieceSet] = useState(null);
    const [userSettings, setUserSettings] = useState(null);

    // Board states
    const [fen, setFen] = useState(chessRef.current.fen());
    const [orientation, setOrientation] = useState('white');
    const [history, setHistory] = useState([]); // List of FEN states + move notation
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
    
    // Tabs & Inputs
    const [activeTab, setActiveTab] = useState('pgn'); // pgn | fen
    const [fenInput, setFenInput] = useState('');
    const [pgnInput, setPgnInput] = useState('');
    const [importError, setImportError] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const playTimerRef = useRef(null);

    // Custom Puzzle Saving state
    const [savePuzzleColor, setSavePuzzleColor] = useState('white');
    const [savePuzzleName, setSavePuzzleName] = useState('');
    const [savePuzzleOpening, setSavePuzzleOpening] = useState('');
    const [savePuzzleMove, setSavePuzzleMove] = useState('');
    const [savePlaylistIdx, setSavePlaylistIdx] = useState('0'); // '0' | '1' | '2' | 'fav'
    const [saveStatus, setSaveStatus] = useState({ type: '', text: '' });

    // Engine states
    const [engineEnabled, setEngineEnabled] = useState(true);
    const [engineOutput, setEngineOutput] = useState([]); // Top PV lines
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Lichess Ingestion States
    const [lichessUsername, setLichessUsername] = useState('');
    const [timeControls, setTimeControls] = useState(['blitz', 'rapid', 'classical']);
    const [dateRange, setDateRange] = useState('30'); // '7', '30', '90', 'all'
    const [maxGames, setMaxGames] = useState(10); // 10, 20, 50
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ stage: '', progress: 0 });
    const [results, setResults] = useState(null);
    const [ingestError, setIngestError] = useState(null);

    const handleToggleTimeControl = (tc) => {
        if (timeControls.includes(tc)) {
            setTimeControls(timeControls.filter(item => item !== tc));
        } else {
            setTimeControls([...timeControls, tc]);
        }
    };

    const handleAnalyze = async () => {
        if (!lichessUsername) {
            setIngestError('No Lichess username linked. Please link your account first.');
            return;
        }
        if (timeControls.length === 0) {
            setIngestError('Please select at least one Time Control to scan.');
            return;
        }

        setAnalyzing(true);
        setIngestError(null);
        setResults(null);
        setProgress({ stage: 'Starting analysis...', progress: 0 });

        try {
            const finalResults = await analyzeUserGames(
                user.uid,
                (progressUpdate) => {
                    setProgress(progressUpdate);
                    if (progressUpdate.results) {
                        setResults(progressUpdate.results);
                    }
                },
                {
                    timeControls,
                    dateRange,
                    maxGames
                }
            );

            setResults(finalResults);
        } catch (err) {
            console.error('Analysis failed:', err);
            setIngestError(err.message || 'An error occurred during game scanning.');
        } finally {
            setAnalyzing(false);
        }
    };

    // ─── 1. Load User Theme/Piece Set Customizations ────────────────────────
    useEffect(() => {
        if (user?.uid) {
            getUserProfile(user.uid).then(profile => {
                setUserSettings(profile.settings);
                setBoardTheme(getBoardTheme(profile.settings?.boardTheme || 'classic'));
                setPieceSet(getPieceSet(profile.settings?.pieceSet || 'cburnett'));
                setLichessUsername(profile.lichessUsername || '');
            }).catch(() => {
                // Fallbacks
                setBoardTheme(getBoardTheme('classic'));
                setPieceSet(getPieceSet('cburnett'));
            });


        } else {
            setBoardTheme(getBoardTheme('classic'));
            setPieceSet(getPieceSet('cburnett'));
        }
    }, [user?.uid]);

    useEffect(() => {
        if (engineOutput.length > 0 && !savePuzzleMove) {
            setSavePuzzleMove(engineOutput[0].moveUci || '');
        }
    }, [engineOutput, savePuzzleMove]);

    // Reset move recommendation selection when FEN changes
    useEffect(() => {
        setSavePuzzleMove('');
    }, [fen]);

    const handleSavePuzzle = async () => {
        if (!savePuzzleMove.trim()) {
            setSaveStatus({ type: 'error', text: 'Please specify the correct move (e.g. e2e4)' });
            return;
        }

        try {
            setSaveStatus({ type: 'loading', text: 'Saving puzzle...' });
            
            const isFav = savePlaylistIdx === 'fav';
            const playlistIndex = isFav ? 0 : parseInt(savePlaylistIdx, 10);

            await saveCustomPuzzle(user.uid, {
                fen,
                correctMove: savePuzzleMove.trim(),
                customName: savePuzzleName.trim() || 'Custom Position',
                opening: savePuzzleOpening.trim() || 'Custom Analysis',
                theme: 'Custom Ingestion',
                userColor: savePuzzleColor,
                isFavorite: isFav,
                playlistIndex
            });

            setSaveStatus({ type: 'success', text: 'Puzzle saved successfully!' });
            setSavePuzzleName('');
            setSavePuzzleOpening('');
            setSavePuzzleMove('');
            setTimeout(() => {
                setSaveStatus({ type: '', text: '' });
            }, 3000);
        } catch (err) {
            console.error('Failed to save manual puzzle:', err);
            setSaveStatus({ type: 'error', text: `Failed to save: ${err.message}` });
        }
    };

    // ─── 2. Initialize Stockfish Engine ─────────────────────────────────────
    useEffect(() => {
        engineService.init();
        return () => {
            engineService.terminate();
        };
    }, []);

    // ─── 3. Chessground Legal Moves Calculator ──────────────────────────────
    const getLegalMoves = useCallback(() => {
        const dests = new Map();
        chessRef.current.moves({ verbose: true }).forEach(move => {
            if (!dests.has(move.from)) {
                dests.set(move.from, []);
            }
            dests.get(move.from).push(move.to);
        });
        return dests;
    }, []);

    // ─── 4. Run Stockfish Analysis on current FEN ───────────────────────────
    useEffect(() => {
        if (!engineEnabled || !fen) {
            setEngineOutput([]);
            setIsAnalyzing(false);
            engineService.sendCommand('stop'); // Stop calculations to free CPU
            return;
        }

        // Initialize engine fresh
        engineService.init();

        setIsAnalyzing(true);
        // Clear previous calculations
        setEngineOutput([]);

        // Send options to Stockfish
        engineService.sendCommand('stop');
        engineService.sendCommand('setoption name MultiPV value 3'); // Top 3 moves
        engineService.sendCommand(`position fen ${fen}`);
        engineService.sendCommand(`go depth ${userSettings?.engineDepth || 14}`);

        const tempOutput = {};

        const parseEngineOutput = (msg) => {
            const message = typeof msg === 'string' ? msg : msg.data;
            if (!message.startsWith('info') || !message.includes('multipv')) return;

            // Extract depth, multipv rank, score type (cp or mate), score value, and pv line
            const multipvMatch = message.match(/multipv (\d+)/);
            if (!multipvMatch) return;
            const rank = parseInt(multipvMatch[1], 10);

            // Parse Evaluation
            let scoreLabel = '0.00';
            let numericScore = 0;
            const cpMatch = message.match(/score cp (-?\d+)/);
            const mateMatch = message.match(/score mate (-?\d+)/);

            if (cpMatch) {
                const cp = parseInt(cpMatch[1], 10);
                numericScore = cp / 100;
                // Reverse score if turn is Black (since Stockfish scores relative to side to move)
                const isBlackTurn = chessRef.current.turn() === 'b';
                const scoreSign = isBlackTurn ? -numericScore : numericScore;
                scoreLabel = scoreSign > 0 ? `+${scoreSign.toFixed(2)}` : scoreSign.toFixed(2);
            } else if (mateMatch) {
                const mate = parseInt(mateMatch[1], 10);
                numericScore = mate > 0 ? 1000 : -1000;
                scoreLabel = `M${Math.abs(mate)}`;
            }

            // Parse PV Moves
            const pvIndex = message.indexOf(' pv ');
            if (pvIndex === -1) return;
            const pvMoves = message.substring(pvIndex + 4).trim().split(' ');

            // Convert first move to SAN for easy reading
            let firstMoveSan = '';
            if (pvMoves.length > 0) {
                const tempChess = new Chess(fen);
                const uciMove = pvMoves[0];
                try {
                    const from = uciMove.substring(0, 2);
                    const to = uciMove.substring(2, 4);
                    const promotion = uciMove.length > 4 ? uciMove.substring(4, 5) : undefined;
                    const res = tempChess.move({ from, to, promotion });
                    firstMoveSan = res ? res.san : uciMove;
                } catch {
                    firstMoveSan = uciMove;
                }
            }

            // Store current best updates
            tempOutput[rank] = {
                rank,
                moveUci: pvMoves[0],
                moveSan: firstMoveSan,
                scoreLabel,
                scoreValue: numericScore,
                line: pvMoves.slice(0, 5).join(' ') // Show first 5 moves of PV
            };

            // Update state with sorted output array
            setEngineOutput(Object.values(tempOutput).sort((a, b) => a.rank - b.rank));
        };

        const unsubscribe = engineService.onMessage(parseEngineOutput);

        return () => {
            unsubscribe();
            engineService.sendCommand('stop');
        };
    }, [fen, engineEnabled, userSettings?.engineDepth]);

    // ─── 5. Chessground Move Callback ───────────────────────────────────────
    const onMove = (orig, dest) => {
        const chess = chessRef.current;
        const moveObj = { from: orig, to: dest };
        
        // Handle Pawn Promotion auto-Queen
        const isPawn = chess.get(orig)?.type === 'p';
        const rank = dest[1];
        if (isPawn && (rank === '8' || rank === '1')) {
            moveObj.promotion = 'q';
        }

        try {
            const move = chess.move(moveObj);
            
            // Build move log history
            const newHistory = history.slice(0, currentMoveIndex + 1);
            newHistory.push({
                fen: chess.fen(),
                san: move.san,
                color: move.color
            });

            setHistory(newHistory);
            setCurrentMoveIndex(newHistory.length - 1);
            setFen(chess.fen());
            setImportError(null);
        } catch {
            // Revert board to match chess.js state if move was invalid
            if (cgRef.current) {
                cgRef.current.set({ fen: chess.fen() });
            }
        }
    };

    // ─── 6. Initialize / Reconfigure Chessground ───────────────────────────
    useEffect(() => {
        if (!boardRef.current) return;

        if (!cgRef.current) {
            cgRef.current = Chessground(boardRef.current, {
                fen: fen,
                orientation: orientation,
                turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                animation: { enabled: true, duration: 200 },
                movable: {
                    free: false,
                    color: 'both',
                    dests: getLegalMoves(),
                    events: { after: onMove }
                },
                highlight: { lastMove: true, check: true }
            });
        } else {
            cgRef.current.set({
                fen: fen,
                orientation: orientation,
                turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                movable: { dests: getLegalMoves() }
            });
        }
    }, [fen, orientation, getLegalMoves]);

    // ─── 7. Navigation Actions ──────────────────────────────────────────────
    const jumpToMove = (index) => {
        if (index < -1 || index >= history.length) return;
        
        const targetFen = index === -1 ? new Chess().fen() : history[index].fen;
        
        // Update chess.js instance
        chessRef.current = new Chess(targetFen);
        
        setCurrentMoveIndex(index);
        setFen(targetFen);
    };

    const handleStepBack = () => jumpToMove(currentMoveIndex - 1);
    const handleStepForward = () => jumpToMove(currentMoveIndex + 1);
    const handleJumpToStart = () => jumpToMove(-1);
    const handleJumpToEnd = () => jumpToMove(history.length - 1);
    
    const handleReset = () => {
        setIsPlaying(false);
        chessRef.current = new Chess();
        setHistory([]);
        setCurrentMoveIndex(-1);
        setFen(chessRef.current.fen());
        setImportError(null);
    };

    // Auto Play navigation
    useEffect(() => {
        if (isPlaying) {
            playTimerRef.current = setInterval(() => {
                if (currentMoveIndex < history.length - 1) {
                    handleStepForward();
                } else {
                    setIsPlaying(false);
                }
            }, 1500);
        } else {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        }

        return () => {
            if (playTimerRef.current) clearInterval(playTimerRef.current);
        };
    }, [isPlaying, currentMoveIndex, history.length]);

    // Flip Board
    const handleFlipBoard = () => {
        setOrientation(prev => prev === 'white' ? 'black' : 'white');
    };

    // ─── 8. Position / Game Ingestion ───────────────────────────────────────
    const handleLoadFen = () => {
        if (!fenInput.trim()) return;
        try {
            const chess = new Chess(fenInput.trim());
            chessRef.current = chess;
            setHistory([]);
            setCurrentMoveIndex(-1);
            setFen(chess.fen());
            setImportError(null);
        } catch {
            setImportError('Invalid FEN String. Check layout and ranks.');
        }
    };

    const handleLoadPgn = () => {
        if (!pgnInput.trim()) return;
        try {
            const chess = new Chess();
            chess.loadPgn(pgnInput.trim());

            // Build history list from PGN moves
            const moves = chess.history({ verbose: true });
            const pgnHistory = [];
            const tempChess = new Chess();

            moves.forEach(m => {
                tempChess.move(m.san);
                pgnHistory.push({
                    fen: tempChess.fen(),
                    san: m.san,
                    color: m.color
                });
            });

            chessRef.current = chess;
            setHistory(pgnHistory);
            setCurrentMoveIndex(pgnHistory.length - 1);
            setFen(chess.fen());
            setImportError(null);
        } catch {
            setImportError('Failed to parse PGN. Check move syntax and headers.');
        }
    };
    // ─── 9. Compute Evaluation Score for Visual Gauge ───────────────────────
    const topScore = engineOutput[0]?.scoreValue ?? 0;
    const scorePercentage = useMemo(() => {
        if (!engineEnabled || engineOutput.length === 0) return 50;
        const label = engineOutput[0].scoreLabel;
        if (label.startsWith('M')) {
            return label.includes('-') ? 0 : 100;
        }
        const score = parseFloat(label);
        if (isNaN(score)) return 50;
        const clamped = Math.max(-5, Math.min(5, score));
        return ((clamped + 5) / 10) * 100;
    }, [engineOutput, engineEnabled]);

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto select-none">
                
                {/* ─── Tab Switcher ────────────────────────────────────────────────── */}
                <div className="flex border-b border-white/5 mb-8">
                    <button
                        onClick={() => { setActiveAnalysisTab('board'); setIngestError(null); }}
                        className={`px-6 py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                            activeAnalysisTab === 'board'
                                ? 'border-chess-accent text-white'
                                : 'border-transparent text-chess-text-secondary hover:text-white'
                        }`}
                    >
                        <Search size={16} className={activeAnalysisTab === 'board' ? 'text-chess-accent' : 'text-chess-text-secondary'} />
                        Interactive Analysis Board
                    </button>
                    <button
                        onClick={() => { setActiveAnalysisTab('ingest'); setIngestError(null); }}
                        className={`px-6 py-3.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                            activeAnalysisTab === 'ingest'
                                ? 'border-chess-accent text-white'
                                : 'border-transparent text-chess-text-secondary hover:text-white'
                        }`}
                    >
                        <Upload size={16} className={activeAnalysisTab === 'ingest' ? 'text-chess-accent' : 'text-chess-text-secondary'} />
                        Lichess Analyser
                    </button>
                </div>

                {activeAnalysisTab === 'board' ? (
                    /* ─── 1. INTERACTIVE BOARD TAB ──────────────────────────────────── */
                    <div className="flex flex-col lg:flex-row gap-6 pb-12 h-full">
                        
                        {/* Board Column */}
                        <div className="flex-1 flex flex-col gap-4">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-serif font-bold text-white">Analysis Board</h1>
                                    <p className="text-chess-text-secondary text-sm">Practice positions, analyse PGNs, and consult Stockfish</p>
                                </div>
                                <button
                                    onClick={handleFlipBoard}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all text-xs flex items-center gap-1.5"
                                >
                                    Flip Board 🔄
                                </button>
                            </div>

                            {/* Chessground Board wrapper */}
                            <div className="w-full flex-1 min-h-[400px] lg:min-h-[500px] flex items-center justify-center p-4 bg-chess-panel border border-white/5 rounded-2xl relative gap-4">
                                {/* Dynamic Custom Styles */}
                                {boardTheme && pieceSet && (
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
                                        .cg-wrap square.white { background-color: ${boardTheme.lightSquare} !important; }
                                        .cg-wrap square.black { background-color: ${boardTheme.darkSquare} !important; }
                                        .cg-wrap coords { display: ${userSettings?.showCoordinates === false ? 'none' : 'block'} !important; }
                                    `}</style>
                                )}

                                {/* Real-time Evaluation Bar */}
                                {engineEnabled && (
                                    <div className="w-3.5 h-[360px] sm:h-[450px] bg-zinc-700 rounded-full relative overflow-hidden border border-white/10 shrink-0 hidden sm:block">
                                        <div 
                                            className="absolute bottom-0 w-full bg-white transition-all duration-700 ease-out" 
                                            style={{ height: `${scorePercentage}%` }}
                                        />
                                        {/* Center marker */}
                                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-red-500/50" />
                                    </div>
                                )}

                                {/* Chessground Container */}
                                <div
                                    ref={boardRef}
                                    className="w-full max-w-[450px] aspect-square rounded-xl shadow-2xl overflow-hidden"
                                />
                            </div>
                        </div>

                        {/* Sidebar Column */}
                        <div className="w-full lg:w-[420px] flex flex-col gap-4 shrink-0">
                            
                            {/* Stockfish Engine Panel */}
                            <div className="bg-chess-panel border border-white/5 p-5 rounded-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="text-chess-accent" size={20} />
                                        <h2 className="font-bold text-white text-base">Engine Analysis</h2>
                                    </div>
                                    <button
                                        onClick={() => setEngineEnabled(prev => !prev)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            engineEnabled 
                                                ? 'bg-chess-accent/10 border border-chess-accent/30 text-chess-accent'
                                                : 'bg-white/5 border border-white/10 text-chess-text-secondary'
                                        }`}
                                    >
                                        {engineEnabled ? 'Active' : 'Disabled'}
                                    </button>
                                </div>

                                {engineEnabled ? (
                                    <div className="space-y-4">
                                        {/* Current Score */}
                                        <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 px-4 py-3 rounded-xl">
                                            <span className="text-xs text-chess-text-secondary font-bold">EVALUATION</span>
                                            {isAnalyzing && engineOutput.length === 0 ? (
                                                <div className="flex items-center gap-1.5 text-xs text-chess-text-secondary">
                                                    <div className="w-2.5 h-2.5 border border-chess-accent border-t-transparent animate-spin rounded-full" />
                                                    Analysing...
                                                </div>
                                            ) : (
                                                <span className={`text-base font-mono font-bold ${topScore >= 0 ? 'text-white' : 'text-red-400'}`}>
                                                    {engineOutput[0]?.scoreLabel || '0.00'}
                                                </span>
                                            )}
                                        </div>

                                        {/* MultiPV Suggestions List */}
                                        <div className="space-y-2">
                                            <span className="text-[10px] text-chess-text-secondary uppercase tracking-widest font-bold">TOP ENGINE RECOMMENDATIONS</span>
                                            {engineOutput.length === 0 ? (
                                                <p className="text-xs text-chess-text-secondary py-3 text-center bg-white/[0.01] rounded-xl border border-white/5">
                                                    {isAnalyzing ? 'Evaluating moves...' : 'Engine idle.'}
                                                </p>
                                            ) : (
                                                engineOutput.map(out => (
                                                    <div 
                                                        key={out.rank}
                                                        className="flex items-center justify-between p-3 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl text-xs transition-colors cursor-pointer group"
                                                        onClick={() => {
                                                            const from = out.moveUci.substring(0, 2);
                                                            const to = out.moveUci.substring(2, 4);
                                                            onMove(from, to);
                                                        }}
                                                        title="Click to play move on board"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-5 h-5 rounded-md bg-chess-accent/15 border border-chess-accent/20 text-chess-accent font-bold flex items-center justify-center text-[10px]">
                                                                {out.rank}
                                                            </span>
                                                            <span className="font-bold text-white group-hover:text-chess-accent transition-colors font-mono text-sm">
                                                                {out.moveSan}
                                                            </span>
                                                            <span className="text-chess-text-secondary font-mono text-[11px] truncate max-w-[160px]">
                                                                {out.line}...
                                                            </span>
                                                        </div>
                                                        <span className={`font-mono font-bold ${out.scoreValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {out.scoreLabel}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-chess-text-secondary text-xs">
                                        CONSULT ENGINE TO VIEW EVALUATIONS
                                    </div>
                                )}
                            </div>

                            {/* Consolidated Control Panel */}
                            <div className="bg-chess-panel border border-white/5 rounded-2xl flex flex-col h-[480px] overflow-hidden">
                                {/* Tab Switcher */}
                                <div className="flex border-b border-white/5 bg-white/[0.01]">
                                    <button
                                        type="button"
                                        onClick={() => setSidebarTab('history')}
                                        className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                            sidebarTab === 'history'
                                                ? 'border-chess-accent text-chess-accent bg-white/[0.02]'
                                                : 'border-transparent text-chess-text-secondary hover:text-white'
                                        }`}
                                    >
                                        <History size={14} /> Move Log
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSidebarTab('import')}
                                        className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                            sidebarTab === 'import'
                                                ? 'border-chess-accent text-chess-accent bg-white/[0.02]'
                                                : 'border-transparent text-chess-text-secondary hover:text-white'
                                        }`}
                                    >
                                        <Upload size={14} /> Import
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSidebarTab('save')}
                                        className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                            sidebarTab === 'save'
                                                ? 'border-chess-accent text-chess-accent bg-white/[0.02]'
                                                : 'border-transparent text-chess-text-secondary hover:text-white'
                                        }`}
                                    >
                                        <Save size={14} /> Save Puzzle
                                    </button>
                                </div>

                                {/* Tab Body */}
                                <div className="p-5 flex-1 flex flex-col min-h-0 justify-between">
                                    {sidebarTab === 'history' && (
                                        <div className="flex-1 flex flex-col min-h-0">
                                            <div className="flex items-center justify-between mb-3 shrink-0">
                                                <span className="text-[10px] text-chess-text-secondary uppercase tracking-widest font-bold">Move Log</span>
                                                {history.length > 0 && (
                                                    <button 
                                                        onClick={handleReset}
                                                        className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
                                                    >
                                                        Clear Board
                                                    </button>
                                                )}
                                            </div>

                                            {history.length === 0 ? (
                                                <div className="flex-1 flex items-center justify-center text-center text-xs text-chess-text-secondary">
                                                    Drag pieces to make moves and record history
                                                </div>
                                            ) : (
                                                <div className="flex-1 overflow-y-auto max-h-56 grid grid-cols-2 gap-x-6 gap-y-1.5 pr-2 py-2 scrollbar-thin">
                                                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                                                        const moveNum = i + 1;
                                                        const wIdx = i * 2;
                                                        const bIdx = i * 2 + 1;

                                                        return (
                                                            <div key={i} className="flex items-center gap-2 text-xs font-mono">
                                                                <span className="text-chess-text-secondary w-6 text-right shrink-0">{moveNum}.</span>
                                                                
                                                                {/* White move */}
                                                                <button 
                                                                    onClick={() => jumpToMove(wIdx)}
                                                                    className={`px-1.5 py-0.5 rounded transition-all font-bold ${
                                                                        currentMoveIndex === wIdx 
                                                                            ? 'bg-chess-accent text-white' 
                                                                            : 'text-white hover:bg-white/5'
                                                                    }`}
                                                                >
                                                                    {history[wIdx].san}
                                                                </button>

                                                                {/* Black move if exists */}
                                                                {bIdx < history.length && (
                                                                    <button 
                                                                        onClick={() => jumpToMove(bIdx)}
                                                                        className={`px-1.5 py-0.5 rounded transition-all font-bold ${
                                                                            currentMoveIndex === bIdx 
                                                                                ? 'bg-chess-accent text-white' 
                                                                                : 'text-white hover:bg-white/5'
                                                                        }`}
                                                                    >
                                                                        {history[bIdx].san}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Navigation Panel */}
                                            <div className="flex justify-center items-center gap-1 mt-4 pt-3 border-t border-white/5 shrink-0">
                                                <button 
                                                    onClick={handleJumpToStart} 
                                                    disabled={currentMoveIndex === -1}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                                    title="Jump to Start"
                                                >
                                                    <ChevronsLeft size={16} />
                                                </button>
                                                <button 
                                                    onClick={handleStepBack} 
                                                    disabled={currentMoveIndex === -1}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                                    title="Step Back"
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => setIsPlaying(prev => !prev)}
                                                    disabled={history.length === 0}
                                                    className="p-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg disabled:opacity-30 disabled:hover:bg-chess-accent transition-all"
                                                    title={isPlaying ? "Pause autoplay" : "Autoplay moves"}
                                                >
                                                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                                                </button>
                                                <button 
                                                    onClick={handleStepForward} 
                                                    disabled={currentMoveIndex === history.length - 1}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                                    title="Step Forward"
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                                <button 
                                                    onClick={handleJumpToEnd} 
                                                    disabled={currentMoveIndex === history.length - 1}
                                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                                                    title="Jump to End"
                                                >
                                                    <ChevronsRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {sidebarTab === 'import' && (
                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex border-b border-white/5 mb-4 select-none">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setActiveTab('pgn'); setImportError(null); }}
                                                        className={`flex-1 pb-2 font-bold text-xs flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                                            activeTab === 'pgn' 
                                                                ? 'border-chess-accent text-chess-accent'
                                                                : 'border-transparent text-chess-text-secondary hover:text-white'
                                                        }`}
                                                    >
                                                        <FileText size={14} /> Import PGN
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setActiveTab('fen'); setImportError(null); }}
                                                        className={`flex-1 pb-2 font-bold text-xs flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                                            activeTab === 'fen' 
                                                                ? 'border-chess-accent text-chess-accent'
                                                                : 'border-transparent text-chess-text-secondary hover:text-white'
                                                        }`}
                                                    >
                                                        <Search size={14} /> Import FEN
                                                    </button>
                                                </div>

                                                {importError && (
                                                    <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-start gap-2">
                                                        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                                                        <span>{importError}</span>
                                                    </div>
                                                )}

                                                {activeTab === 'pgn' ? (
                                                    <div className="space-y-3">
                                                        <textarea
                                                            value={pgnInput}
                                                            onChange={(e) => setPgnInput(e.target.value)}
                                                            placeholder="Paste PGN text here (e.g. 1. e4 e5 2. Nf3 Nc6 ...)"
                                                            className="w-full h-44 bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs p-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors scrollbar-thin resize-none"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        <input
                                                            type="text"
                                                            value={fenInput}
                                                            onChange={(e) => setFenInput(e.target.value)}
                                                            placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                                                            className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-4">
                                                {activeTab === 'pgn' ? (
                                                    <button
                                                        onClick={handleLoadPgn}
                                                        disabled={!pgnInput.trim()}
                                                        className="w-full py-2.5 bg-chess-accent hover:bg-chess-accent-hover disabled:opacity-50 disabled:hover:bg-chess-accent text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        <Upload size={14} /> Load Game PGN
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={handleLoadFen}
                                                        disabled={!fenInput.trim()}
                                                        className="w-full py-2.5 bg-chess-accent hover:bg-chess-accent-hover disabled:opacity-50 disabled:hover:bg-chess-accent text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        <Upload size={14} /> Load Position FEN
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {sidebarTab === 'save' && (
                                        <div className="flex-1 flex flex-col justify-between min-h-0">
                                            <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
                                                {saveStatus.text && (
                                                    <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                                                        saveStatus.type === 'success'
                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                                                            : saveStatus.type === 'error'
                                                                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                                                                : 'bg-white/5 border-white/10 text-chess-text-secondary'
                                                    }`}>
                                                        <span>{saveStatus.text}</span>
                                                    </div>
                                                )}

                                                {/* Puzzle Name */}
                                                <div className="space-y-1">
                                                    <label htmlFor="saveNameInput" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">PUZZLE TITLE / DESCRIPTION</label>
                                                    <input
                                                        id="saveNameInput"
                                                        type="text"
                                                        value={savePuzzleName}
                                                        onChange={(e) => setSavePuzzleName(e.target.value)}
                                                        placeholder="e.g. Simple tactics check"
                                                        className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                                    />
                                                </div>

                                                {/* Opening / Group Name */}
                                                <div className="space-y-1">
                                                    <label htmlFor="saveOpeningInput" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">OPENING / GROUP NAME</label>
                                                    <input
                                                        id="saveOpeningInput"
                                                        type="text"
                                                        value={savePuzzleOpening}
                                                        onChange={(e) => setSavePuzzleOpening(e.target.value)}
                                                        placeholder="e.g. Sicilian Defense"
                                                        className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Side to Move */}
                                                    <div className="space-y-1">
                                                        <label htmlFor="saveColorSelect" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">SIDE TO MOVE</label>
                                                        <select
                                                            id="saveColorSelect"
                                                            value={savePuzzleColor}
                                                            onChange={(e) => setSavePuzzleColor(e.target.value)}
                                                            className="w-full bg-chess-bg border border-white/10 rounded-xl text-xs py-2 px-3 text-white focus:outline-none focus:border-chess-accent cursor-pointer"
                                                        >
                                                            <option value="white">White to Move</option>
                                                            <option value="black">Black to Move</option>
                                                        </select>
                                                    </div>

                                                    {/* Destination Group */}
                                                    <div className="space-y-1">
                                                        <label htmlFor="savePlaylistSelect" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">ADD TO LIST</label>
                                                        <select
                                                            id="savePlaylistSelect"
                                                            value={savePlaylistIdx}
                                                            onChange={(e) => setSavePlaylistIdx(e.target.value)}
                                                            className="w-full bg-chess-bg border border-white/10 rounded-xl text-xs py-2 px-3 text-white focus:outline-none focus:border-chess-accent cursor-pointer"
                                                        >
                                                            <option value="0">Playlist 1 (Recent)</option>
                                                            <option value="1">Playlist 2 (History)</option>
                                                            <option value="2">Playlist 3 (Archive)</option>
                                                            <option value="fav">⭐ Starred / Favorites</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Target Move */}
                                                <div className="space-y-1">
                                                    <label htmlFor="saveMoveInput" className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">CORRECT UCI MOVE (E.G. E2E4)</label>
                                                    <div className="relative">
                                                        <input
                                                            id="saveMoveInput"
                                                            type="text"
                                                            value={savePuzzleMove}
                                                            onChange={(e) => setSavePuzzleMove(e.target.value)}
                                                            placeholder="e.g. e2e4"
                                                            className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white placeholder:text-chess-text-secondary focus:outline-none transition-colors font-mono"
                                                        />
                                                        {engineOutput.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setSavePuzzleMove(engineOutput[0].moveUci || '')}
                                                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-chess-accent/15 border border-chess-accent/30 text-chess-accent text-[9px] font-bold px-2 py-1 rounded hover:bg-chess-accent/25 transition-colors"
                                                                title="Pre-fill with top Stockfish recommendation"
                                                            >
                                                                Use Engine Best ({engineOutput[0].moveSan})
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4">
                                                <button
                                                    onClick={handleSavePuzzle}
                                                    disabled={saveStatus.type === 'loading'}
                                                    className="w-full py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                                                >
                                                    <Save size={14} /> Save to Playlist
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ─── 2. LICHESS ANALYSER TAB ──────────────────────────────────── */
                    <div className="max-w-4xl mx-auto pb-12">
                        {/* Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-serif font-bold text-white mb-2">Lichess Analyser</h1>
                            <p className="text-chess-text-secondary text-sm">
                                Scan your Lichess matches to extract opening blunders and generate custom puzzles
                            </p>
                        </div>

                        {/* Main Content */}
                        {!analyzing && !results && (
                            <div className="space-y-6">
                                {/* Connection Warning / Status */}
                                {!lichessUsername ? (
                                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
                                        <div className="flex items-start gap-3.5">
                                            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shrink-0">
                                                <AlertCircle className="text-amber-500" size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white mb-0.5">Lichess Account Required</h4>
                                                <p className="text-sm text-chess-text-secondary">
                                                    You need to link your Lichess account to fetch games. Link it in Settings first.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate('/dashboard/settings')}
                                            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/10 whitespace-nowrap"
                                        >
                                            Go to Settings
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-500/5 border border-emerald-500/25 rounded-2xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 font-bold text-xs">
                                                ✓
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">LINKED LICHESS USERNAME</p>
                                                <p className="text-white font-bold text-base">{lichessUsername}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/dashboard/settings')}
                                            className="text-xs font-semibold text-chess-text-secondary hover:text-white transition-colors"
                                        >
                                            Change Account
                                        </button>
                                    </div>
                                )}

                                {/* Scanner Form Panel */}
                                <div className="bg-chess-panel border border-white/5 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
                                    {/* Accent Glow */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-chess-accent/5 rounded-full blur-3xl pointer-events-none" />

                                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                        <Cpu size={20} className="text-chess-accent" />
                                        <span>Game scanning configuration</span>
                                    </h3>

                                    <div className="space-y-6">
                                        {/* 1. Time Control Selection */}
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-white flex items-center gap-2">
                                                <Clock size={16} className="text-chess-accent" />
                                                <span>Time Controls</span>
                                            </label>
                                            <p className="text-xs text-chess-text-secondary mb-3">Choose any combination of match types you want to ingest:</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {[
                                                    { id: 'bullet', label: 'Bullet', desc: '≤ 2m', icon: '🔫' },
                                                    { id: 'blitz', label: 'Blitz', desc: '3m - 7m', icon: '⚡' },
                                                    { id: 'rapid', label: 'Rapid', desc: '8m - 15m', icon: '⏱️' },
                                                    { id: 'classical', label: 'Classical', desc: '> 15m', icon: '🏛️' }
                                                ].map(tc => {
                                                    const isSelected = timeControls.includes(tc.id);
                                                    return (
                                                        <button
                                                            key={tc.id}
                                                            type="button"
                                                            onClick={() => handleToggleTimeControl(tc.id)}
                                                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                                                                isSelected
                                                                    ? 'border-chess-accent bg-chess-accent/10 shadow-lg shadow-chess-accent/5'
                                                                    : 'border-white/5 bg-black/20 hover:border-white/10'
                                                            }`}
                                                        >
                                                            <span className="text-xl block mb-1">{tc.icon}</span>
                                                            <span className="text-sm font-bold text-white block">{tc.label}</span>
                                                            <span className="text-[10px] text-chess-text-secondary">{tc.desc}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* 2. Date Range and 3. Fetch Limit */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                            {/* Date Range Selection */}
                                            <div className="space-y-2">
                                                <label htmlFor="dateRangeSelect" className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Calendar size={16} className="text-chess-accent" />
                                                    <span>Date Range</span>
                                                </label>
                                                <select
                                                    id="dateRangeSelect"
                                                    value={dateRange}
                                                    onChange={(e) => setDateRange(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-chess-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-chess-accent transition-colors appearance-none cursor-pointer"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                                                >
                                                    <option value="7">Last 7 Days</option>
                                                    <option value="30">Last 30 Days (Recommended)</option>
                                                    <option value="90">Last 90 Days</option>
                                                    <option value="all">All Time / No Limit</option>
                                                </select>
                                            </div>

                                            {/* Fetch Game Limit */}
                                            <div className="space-y-2">
                                                <label htmlFor="gameLimitSelect" className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Hash size={16} className="text-chess-accent" />
                                                    <span>Maximum Games to Scan</span>
                                                </label>
                                                <select
                                                    id="gameLimitSelect"
                                                    value={maxGames}
                                                    onChange={(e) => setMaxGames(parseInt(e.target.value))}
                                                    className="w-full px-4 py-2.5 bg-chess-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-chess-accent transition-colors appearance-none cursor-pointer"
                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                                                >
                                                    <option value="10">10 Recent Games</option>
                                                    <option value="20">20 Recent Games</option>
                                                    <option value="50">50 Recent Games</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Start Scanner Trigger */}
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={!lichessUsername || timeControls.length === 0}
                                        className="mt-8 w-full py-4 bg-chess-accent hover:bg-chess-accent-hover disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-chess-accent/10 disabled:shadow-none hover:shadow-chess-accent/25 hover:-translate-y-0.5 disabled:cursor-not-allowed"
                                    >
                                        <Play size={18} fill="currentColor" />
                                        Analyse Lichess Games
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Progress Indicator */}
                        {analyzing && (
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-xl">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-10 h-10 border border-chess-accent border-t-transparent animate-spin rounded-full shrink-0" />
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">Analysing Your Games</h3>
                                        <p className="text-chess-text-secondary">{progress.stage}</p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-chess-bg rounded-full h-3.5 overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-chess-accent to-emerald-500 transition-all duration-300 rounded-full"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                                <p className="text-xs font-bold text-chess-text-secondary mt-2 text-right">
                                    {Math.round(progress.progress)}%
                                </p>
                            </div>
                        )}

                        {/* Results */}
                        {results && !analyzing && (
                            <div className="bg-chess-panel border border-white/5 rounded-3xl p-8 shadow-xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <CheckCircle className="text-chess-status-success" size={32} />
                                    <h3 className="text-2xl font-serif font-bold text-white">Analysis Complete!</h3>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                    <div className="bg-chess-bg p-4 rounded-xl border border-white/5">
                                        <p className="text-xs text-chess-text-secondary mb-1">Games Fetched</p>
                                        <p className="text-2xl font-bold text-white">{results.gamesFetched}</p>
                                    </div>
                                    <div className="bg-chess-bg p-4 rounded-xl border border-white/5">
                                        <p className="text-xs text-chess-text-secondary mb-1">Games Analysed</p>
                                        <p className="text-2xl font-bold text-chess-accent">{results.gamesAnalyzed}</p>
                                    </div>
                                    <div className="bg-chess-bg p-4 rounded-xl border border-white/5">
                                        <p className="text-xs text-chess-text-secondary mb-1">Puzzles Generated</p>
                                        <p className="text-2xl font-bold text-chess-status-success">{results.puzzlesGenerated}</p>
                                    </div>
                                    <div className="bg-chess-bg p-4 rounded-xl border border-white/5">
                                        <p className="text-xs text-chess-text-secondary mb-1">Already Processed</p>
                                        <p className="text-2xl font-bold text-chess-text-secondary">{results.gamesSkipped}</p>
                                    </div>
                                </div>

                                {/* Errors */}
                                {results.errors && results.errors.length > 0 && (
                                    <div className="bg-chess-status-error/5 border border-chess-status-error/20 rounded-xl p-4 mb-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <XCircle className="text-chess-status-error" size={20} />
                                            <p className="text-chess-status-error font-bold">Some games failed to analyse</p>
                                        </div>
                                        <p className="text-xs text-chess-text-secondary">
                                            {results.errors.length} game(s) encountered engine errors. They will be retried in your next scan.
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={() => navigate('/dashboard')}
                                        className="flex-1 px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Home size={18} />
                                        Go to Dashboard
                                    </button>
                                    <button
                                        onClick={() => {
                                            setResults(null);
                                            setIngestError(null);
                                        }}
                                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors border border-white/10"
                                    >
                                        Ingest More Games
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error State */}
                        {ingestError && !analyzing && (
                            <div className="bg-chess-status-error/5 border border-chess-status-error/20 rounded-3xl p-8 shadow-xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <XCircle className="text-chess-status-error" size={32} />
                                    <h3 className="text-2xl font-bold text-white">Analysis Failed</h3>
                                </div>
                                <p className="text-chess-text-secondary mb-6">{ingestError}</p>
                                <button
                                    onClick={() => setIngestError(null)}
                                    className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-colors"
                                >
                                    Dismiss and Try Again
                                </button>
                            </div>
                        )}

                        {/* Info Guide */}
                        {!analyzing && !results && !ingestError && (
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8">
                                <h3 className="font-bold text-white mb-3">How Chess-OP scanning works</h3>
                                <ul className="space-y-3 text-sm text-chess-text-secondary">
                                    <li className="flex items-start gap-2.5">
                                        <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                        We fetch matches from Lichess matching your selected time control combinations and date windows.
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                        The Stockfish engine evaluates every move to check for errors where evaluation dropped by ≥ 1.0 centipawn loss.
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                        Custom puzzles are constructed on the fly from positions where you blundered, allowing you to learn from your own mistakes.
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                        Games already analysed are automatically indexed and skipped to ensure speedy and efficient scans.
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
