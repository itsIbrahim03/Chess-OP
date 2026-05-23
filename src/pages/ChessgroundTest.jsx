import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import DashboardLayout from '../components/DashboardLayout';
import { RotateCw, Play, ArrowRight, Palette, Move, Target } from 'lucide-react';

// Import chessground CSS - using only the built-in library defaults
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
/**
 * Chessground Test Page
 * Tests all features: drag/click, arrows, legal moves, premoves, colors, orientation
 */
export default function ChessgroundTest() {
    const boardRef = useRef(null);
    const cgRef = useRef(null);
    const chessRef = useRef(new Chess());

    const [orientation, setOrientation] = useState('white');
    const [status, setStatus] = useState('Ready - Make a move!');
    const [moveHistory, setMoveHistory] = useState([]);
    const [arrowsEnabled] = useState(true);
    const [premoveEnabled] = useState(true);
    const [turn, setTurn] = useState('w');

    // Get legal moves in chessground format
    const getLegalMoves = useCallback(() => {
        const dests = new Map();
        const moves = chessRef.current.moves({ verbose: true });

        moves.forEach(move => {
            const from = move.from;
            const to = move.to;

            if (!dests.has(from)) {
                dests.set(from, []);
            }
            dests.get(from).push(to);
        });

        return dests;
    }, []);

    // Handle move
    const onMove = useCallback((from, to) => {
        try {
            const move = chessRef.current.move({ from, to, promotion: 'q' });

            if (move) {
                setMoveHistory(prev => [...prev, move.san]);

                // Update status
                if (chessRef.current.isCheckmate()) {
                    setStatus('♚ Checkmate!');
                } else if (chessRef.current.isDraw()) {
                    setStatus('½ Draw');
                } else if (chessRef.current.isCheck()) {
                    setStatus('✓ Check!');
                } else {
                    setStatus(`Last move: ${move.san}`);
                }

                setTurn(chessRef.current.turn());

                // Update board for next move
                cgRef.current.set({
                    fen: chessRef.current.fen(),
                    turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
                    movable: {
                        dests: getLegalMoves()
                    },
                    lastMove: [from, to]
                });
            }
        } catch (e) {
            console.error('Invalid move:', e);
        }
    }, [getLegalMoves]);

    // Initialize chessground
    useEffect(() => {
        if (boardRef.current && !cgRef.current) {
            cgRef.current = Chessground(boardRef.current, {
                fen: chessRef.current.fen(),
                orientation: orientation,
                turnColor: 'white',
                movable: {
                    free: false,
                    color: 'both',
                    dests: getLegalMoves(),
                    showDests: true, // Show legal move dots
                    events: {
                        after: onMove
                    }
                },
                draggable: {
                    enabled: true,
                    showGhost: true
                },
                selectable: {
                    enabled: true // Click-to-move
                },
                premovable: {
                    enabled: premoveEnabled,
                    showDests: true,
                    castle: true
                },
                drawable: {
                    enabled: arrowsEnabled,
                    visible: true,
                    defaultSnapToValidMove: true,
                    eraseOnClick: false
                },
                highlight: {
                    lastMove: true,
                    check: true
                },
                animation: {
                    enabled: true,
                    duration: 200
                }
            });
        }
    }, [arrowsEnabled, getLegalMoves, onMove, orientation, premoveEnabled]);

    // Update board when orientation changes
    useEffect(() => {
        if (cgRef.current) {
            cgRef.current.set({ orientation });
        }
    }, [orientation]);

    // Reset board
    function resetBoard() {
        chessRef.current.reset();
        setMoveHistory([]);
        setStatus('Ready - Make a move!');
        setTurn('w');

        cgRef.current.set({
            fen: chessRef.current.fen(),
            turnColor: 'white',
            lastMove: undefined,
            movable: {
                dests: getLegalMoves()
            }
        });

        // Clear arrows
        cgRef.current.setShapes([]);
    }

    // Flip board
    function flipBoard() {
        setOrientation(prev => prev === 'white' ? 'black' : 'white');
    }

    // Draw example arrows
    function drawExampleArrows() {
        cgRef.current.setShapes([
            { orig: 'e2', dest: 'e4', brush: 'green' },
            { orig: 'g1', dest: 'f3', brush: 'blue' },
            { orig: 'd2', dest: 'd4', brush: 'red' },
            { orig: 'e1', brush: 'yellow' } // Circle on e1
        ]);
    }

    // Set a puzzle position
    function loadPuzzlePosition() {
        const puzzleFen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
        chessRef.current.load(puzzleFen);
        setMoveHistory([]);
        setStatus('♟️ Puzzle: White to move and win!');
        setTurn('w');

        cgRef.current.set({
            fen: puzzleFen,
            turnColor: 'white',
            lastMove: undefined,
            movable: {
                dests: getLegalMoves()
            }
        });

        // Draw arrow showing the winning move
        cgRef.current.setShapes([
            { orig: 'h5', dest: 'f7', brush: 'green' }
        ]);
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-serif font-bold text-white mb-2">
                        Chessground Test Page
                    </h1>
                    <p className="text-chess-text-secondary">
                        Testing all chessground features: drag, click, arrows, legal moves, premoves
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Chess Board */}
                    <div className="lg:col-span-2">
                        <div className="bg-chess-panel border border-white/5 rounded-2xl p-6">
                            {/* Board Container */}
                            <div
                                ref={boardRef}
                                className="w-full aspect-square rounded-lg overflow-hidden"
                                style={{ maxWidth: '560px', margin: '0 auto' }}
                            />

                            {/* Status */}
                            <div className="mt-4 text-center">
                                <p className="text-lg text-white font-medium">{status}</p>
                                <p className="text-sm text-chess-text-secondary mt-1">
                                    Orientation: {orientation} | Turn: {turn === 'w' ? 'White' : 'Black'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Controls Panel */}
                    <div className="space-y-4">
                        {/* Action Buttons */}
                        <div className="bg-chess-panel border border-white/5 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-chess-text-secondary mb-3">CONTROLS</h3>

                            <div className="space-y-2">
                                <button
                                    onClick={resetBoard}
                                    className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <RotateCw size={18} />
                                    Reset Board
                                </button>

                                <button
                                    onClick={flipBoard}
                                    className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Move size={18} />
                                    Flip Board
                                </button>

                                <button
                                    onClick={drawExampleArrows}
                                    className="w-full px-4 py-2 bg-chess-accent/20 hover:bg-chess-accent/30 text-chess-accent rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <ArrowRight size={18} />
                                    Draw Arrows
                                </button>

                                <button
                                    onClick={loadPuzzlePosition}
                                    className="w-full px-4 py-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg flex items-center gap-2 transition-colors"
                                >
                                    <Target size={18} />
                                    Load Puzzle
                                </button>
                            </div>
                        </div>

                        {/* Move History */}
                        <div className="bg-chess-panel border border-white/5 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-chess-text-secondary mb-3">MOVE HISTORY</h3>

                            <div className="max-h-40 overflow-y-auto">
                                {moveHistory.length === 0 ? (
                                    <p className="text-chess-text-secondary text-sm">No moves yet</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1">
                                        {moveHistory.map((move, i) => (
                                            <span
                                                key={i}
                                                className={`px-2 py-1 rounded text-xs ${i % 2 === 0 ? 'bg-white/10 text-white' : 'bg-white/5 text-chess-text-secondary'
                                                    }`}
                                            >
                                                {Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : '...'}{move}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Feature Checklist */}
                        <div className="bg-chess-panel border border-white/5 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-chess-text-secondary mb-3">FEATURE TEST</h3>

                            <ul className="space-y-2 text-sm">
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Drag pieces to move
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Click source then dest
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Legal move dots shown
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Right-click to draw arrows
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Last move highlighted
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Check highlight (red)
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Board flip (orientation)
                                </li>
                                <li className="flex items-center gap-2 text-chess-text-secondary">
                                    <span className="text-green-400">✓</span> Premoves enabled
                                </li>
                            </ul>
                        </div>

                        {/* Instructions */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                            <h3 className="text-sm font-bold text-white mb-2">How to Test</h3>
                            <ul className="space-y-1 text-xs text-chess-text-secondary">
                                <li>• Drag or click pieces to move</li>
                                <li>• Right-click + drag to draw arrows</li>
                                <li>• Click "Load Puzzle" for a puzzle</li>
                                <li>• Try Qxf7# (Scholar's Mate)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
