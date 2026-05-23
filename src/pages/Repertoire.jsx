import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
    BookOpen, Search, Filter, Folder, FolderOpen,
    ChevronDown, ChevronUp, Edit3, Check, X,
    Target, Loader2, Award, Clock, ArrowRight,
    MoveRight
} from 'lucide-react';
import {
    getAllPuzzlesGroupedByOpening, // actually getUserPlaylists
    renamePuzzle,
    getPlaylistSolveRate,
    renamePlaylist,
    movePuzzle
} from '../services/puzzleService';
import { useNavigate } from 'react-router-dom';

export default function Repertoire() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [expandedGroups, setExpandedGroups] = useState({});
    
    // Inline edit states for Puzzles
    const [editingPuzzleId, setEditingPuzzleId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);

    // Inline edit states for Playlists
    const [editingPlaylistIdx, setEditingPlaylistIdx] = useState(null);
    const [playlistRenameValue, setPlaylistRenameValue] = useState('');
    const [renamingPlaylist, setRenamingPlaylist] = useState(false);

    // Moving puzzle state
    const [movingPuzzleId, setMovingPuzzleId] = useState(null);
    const [movingState, setMovingState] = useState(false);

    // Solve rates cache (playlistIndex -> solve rate percentage)
    const [solveRates, setSolveRates] = useState({});

    const loadRepertoire = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const liveGroups = await getAllPuzzlesGroupedByOpening(user.uid);
            setGroups(liveGroups);

            // Keep expanded states preserved
            setExpandedGroups(prev => {
                const updated = { ...prev };
                liveGroups.forEach(g => {
                    if (updated[g.playlistIndex] === undefined) {
                        updated[g.playlistIndex] = false;
                    }
                });
                return updated;
            });

            // Load solve rates independently for each playlist in parallel
            liveGroups.forEach(async (group) => {
                const puzzleIds = group.puzzles.map(p => p.id);
                const rate = await getPlaylistSolveRate(user.uid, puzzleIds);
                setSolveRates(prev => ({
                    ...prev,
                    [group.playlistIndex]: rate
                }));
            });

        } catch (error) {
            console.error('Failed to load repertoire:', error);
        }
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;

        setLoading(true);
        const timer = setTimeout(async () => {
            await loadRepertoire();
            setLoading(false);
        }, 0);

        return () => clearTimeout(timer);
    }, [user?.uid, loadRepertoire]);

    const toggleGroup = (playlistIdx) => {
        setExpandedGroups(prev => ({
            ...prev,
            [playlistIdx]: !prev[playlistIdx]
        }));
    };

    // Puzzle rename handlers
    const handleStartRename = (puzzle) => {
        setEditingPuzzleId(puzzle.id);
        setRenameValue(puzzle.customName || puzzle.opening || 'Puzzle');
    };

    const handleCancelRename = () => {
        setEditingPuzzleId(null);
        setRenameValue('');
    };

    const handleSaveRename = async (puzzleId, playlistIdx) => {
        if (!renameValue.trim()) return;
        setRenaming(true);
        try {
            await renamePuzzle(user.uid, puzzleId, renameValue);
            
            // Update local state optimistically
            setGroups(prev => prev.map(group => {
                if (group.playlistIndex === playlistIdx) {
                    return {
                        ...group,
                        puzzles: group.puzzles.map(p => {
                            if (p.id === puzzleId) {
                                  return { ...p, customName: renameValue.trim() };
                            }
                            return p;
                        })
                    };
                }
                return group;
            }));

            setEditingPuzzleId(null);
            setRenameValue('');
        } catch (e) {
            console.error('Rename failed:', e);
        } finally {
            setRenaming(false);
        }
    };

    // Playlist rename handlers
    const handleStartPlaylistRename = (playlist) => {
        setEditingPlaylistIdx(playlist.playlistIndex);
        setPlaylistRenameValue(playlist.title);
    };

    const handleCancelPlaylistRename = () => {
        setEditingPlaylistIdx(null);
        setPlaylistRenameValue('');
    };

    const handleSavePlaylistRename = async (playlistIdx) => {
        if (!playlistRenameValue.trim()) return;
        setRenamingPlaylist(true);
        try {
            await renamePlaylist(user.uid, playlistIdx, playlistRenameValue);

            // Update local state
            setGroups(prev => prev.map(g => {
                if (g.playlistIndex === playlistIdx) {
                    return { ...g, title: playlistRenameValue.trim() };
                }
                return g;
            }));

            setEditingPlaylistIdx(null);
            setPlaylistRenameValue('');
        } catch (e) {
            console.error('Playlist rename failed:', e);
        } finally {
            setRenamingPlaylist(false);
        }
    };

    // Move puzzle handler
    const handleMovePuzzle = async (puzzleId, targetPlaylistIdx) => {
        setMovingState(true);
        try {
            await movePuzzle(user.uid, puzzleId, targetPlaylistIdx);
            setMovingPuzzleId(null);
            // Reload all repertoire groups since limits/deletions/shifts may have run
            await loadRepertoire();
        } catch (e) {
            console.error('Move puzzle failed:', e);
        } finally {
            setMovingState(false);
        }
    };

    // Filters and search logic
    const filteredGroups = groups.map(group => {
        const filteredPuzzles = group.puzzles.filter(puzzle => {
            const matchesSearch = 
                (puzzle.customName && puzzle.customName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (puzzle.opening && puzzle.opening.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (puzzle.theme && puzzle.theme.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus = 
                statusFilter === 'all' ||
                (statusFilter === 'new' && puzzle.status === 'new') ||
                (statusFilter === 'active' && puzzle.status === 'active') ||
                (statusFilter === 'solved' && puzzle.status === 'solved') ||
                (statusFilter === 'mastered' && puzzle.status === 'mastered');

            return matchesSearch && matchesStatus;
        });

        return {
            ...group,
            filteredPuzzles
        };
    });

    const totalFilteredPuzzles = filteredGroups.reduce((acc, curr) => acc + curr.filteredPuzzles.length, 0);
    const hasAnyPuzzles = groups.some(g => g.total > 0);

    // SVG Circular Ring Helper
    const CircularGauge = ({ percentage, color = 'stroke-chess-accent', title }) => {
        const radius = 24;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <div className="flex flex-col items-center gap-1.5 shrink-0" title={title}>
                <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            className="stroke-white/5 fill-transparent"
                            strokeWidth="4"
                        />
                        <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            className={`fill-transparent transition-all duration-1000 ${color}`}
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <span className="absolute text-xs font-bold text-white">{percentage}%</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-chess-text-secondary tracking-wider">{title}</span>
            </div>
        );
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'new':
                return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            case 'active':
                return 'bg-red-500/10 border-red-500/20 text-red-400';
            case 'solved':
                return 'bg-green-500/10 border-green-500/20 text-green-400';
            case 'mastered':
                return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
            default:
                return 'bg-white/5 border-white/10 text-chess-text-secondary';
        }
    };

    const masteryLabelStyle = (mastery) => {
        switch (mastery) {
            case 'Expert':
                return 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20';
            case 'Advanced':
                return 'text-blue-400 bg-blue-400/10 border border-blue-400/20';
            case 'Intermediate':
                return 'text-green-400 bg-green-400/10 border border-green-400/20';
            default:
                return 'text-chess-text-secondary bg-white/5 border border-white/5';
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-white mb-2">My Repertoire</h1>
                        <p className="text-chess-text-secondary">
                            Organize your blunders into exactly 3 sequential training playlists of up to 20 puzzles each.
                            {totalFilteredPuzzles > 0 && (
                                <span className="ml-2 text-chess-accent font-medium">({totalFilteredPuzzles} loaded)</span>
                            )}
                        </p>
                    </div>
                    {hasAnyPuzzles && (
                        <button 
                            onClick={() => navigate('/dashboard/train')}
                            className="bg-chess-accent hover:bg-chess-accent-hover text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-chess-accent/20 flex items-center gap-2 transition-all hover:-translate-y-0.5 shrink-0 self-start sm:self-auto"
                        >
                            <Target size={20} /> Train Random Deck
                        </button>
                    )}
                </div>

                {/* Filters & Search Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-chess-panel border border-white/5 p-4 rounded-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search puzzles by opening, custom name, or blunder theme..."
                            className="w-full bg-chess-bg/50 border border-white/10 focus:border-chess-accent focus:ring-0 text-white pl-10 pr-4 py-2 rounded-lg placeholder:text-chess-text-secondary transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <Filter className="text-chess-text-secondary shrink-0" size={18} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-chess-bg border border-white/10 text-white py-2 pl-3 pr-8 rounded-lg focus:border-chess-accent focus:ring-0 text-sm font-medium transition-colors"
                        >
                            <option value="all">All Puzzles</option>
                            <option value="new">New (Unseen)</option>
                            <option value="active">Active (Failed)</option>
                            <option value="solved">Solved</option>
                            <option value="mastered">Mastered (3+ Solves)</option>
                        </select>
                    </div>
                </div>

                {/* Repertoire Data Loading */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="animate-spin text-chess-accent mb-4" size={40} />
                        <p className="text-chess-text-secondary font-medium">Gathering your training playlists...</p>
                    </div>
                ) : !hasAnyPuzzles ? (
                    /* Global Empty State */
                    <div className="bg-chess-panel border border-white/5 rounded-2xl flex flex-col items-center justify-center p-12 text-center max-w-2xl mx-auto shadow-2xl backdrop-blur-md relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-chess-accent/5 to-transparent pointer-events-none" />
                        <div className="w-16 h-16 bg-chess-accent/15 text-chess-accent rounded-full flex items-center justify-center mb-6">
                            <BookOpen size={36} />
                        </div>
                        <h2 className="text-2xl font-serif font-bold text-white mb-2">Build Your Repertoire</h2>
                        <p className="text-chess-text-secondary mb-8 max-w-md">
                            You don't have any puzzles loaded yet. Link your Lichess account and scan your matches to generate blunder training puzzles!
                        </p>
                        <button
                            onClick={() => navigate('/dashboard/analyze')}
                            className="px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-chess-accent/20 hover:-translate-y-0.5 transition-all"
                        >
                            Analyze Games <ArrowRight size={18} />
                        </button>
                    </div>
                ) : (
                    /* Playlists Cards List */
                    <div className="space-y-6">
                        {filteredGroups.map((playlist) => {
                            const isExpanded = !!expandedGroups[playlist.playlistIndex];
                            const rate = solveRates[playlist.playlistIndex] ?? 0;

                            return (
                                <div 
                                    key={playlist.playlistIndex}
                                    className={`bg-chess-panel border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ${
                                        isExpanded ? 'ring-1 ring-chess-accent/30 shadow-2xl' : 'hover:border-chess-accent/20'
                                    }`}
                                >
                                    {/* Playlist Header Card */}
                                    <div 
                                        onClick={() => toggleGroup(playlist.playlistIndex)}
                                        className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                                    >
                                        <div className="flex gap-4 items-start sm:items-center flex-1">
                                            {/* Folder Icon */}
                                            <div className="w-12 h-12 bg-chess-accent/10 border border-chess-accent/25 text-chess-accent rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                                                {isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                {editingPlaylistIdx === playlist.playlistIndex ? (
                                                    <div className="flex items-center gap-2 max-w-sm mb-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={playlistRenameValue}
                                                            onChange={(e) => setPlaylistRenameValue(e.target.value)}
                                                            className="flex-1 bg-chess-bg border border-chess-accent focus:ring-0 text-white px-3 py-1 rounded text-sm placeholder:text-chess-text-secondary focus:outline-none"
                                                            placeholder="Playlist name"
                                                            disabled={renamingPlaylist}
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => handleSavePlaylistRename(playlist.playlistIndex)}
                                                            disabled={renamingPlaylist}
                                                            className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50 shrink-0"
                                                            title="Save Name"
                                                        >
                                                            {renamingPlaylist ? (
                                                                <Loader2 className="animate-spin" size={18} />
                                                            ) : (
                                                                <Check size={18} />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelPlaylistRename}
                                                            disabled={renamingPlaylist}
                                                            className="p-1 text-red-400 hover:text-red-300 shrink-0"
                                                            title="Cancel"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="text-xl font-bold text-white truncate max-w-[220px] sm:max-w-[360px]">
                                                            {playlist.title}
                                                        </h3>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStartPlaylistRename(playlist);
                                                            }}
                                                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-all opacity-80"
                                                            title="Rename Playlist"
                                                        >
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shrink-0 ${masteryLabelStyle(playlist.mastery)}`}>
                                                            {playlist.mastery}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-chess-text-secondary">
                                                    <span className="flex items-center gap-1">
                                                        <Folder size={14} /> {playlist.puzzles.length} / 20 puzzles
                                                    </span>
                                                    {playlist.filteredPuzzles.length !== playlist.puzzles.length && (
                                                        <span className="text-chess-accent">({playlist.filteredPuzzles.length} match filters)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gauges and Collapsible Indicators */}
                                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-white/5 pt-4 sm:pt-0 sm:border-0">
                                            <div className="flex items-center gap-6">
                                                <CircularGauge percentage={playlist.progress} color="stroke-chess-accent" title="Mastery" />
                                                <CircularGauge percentage={rate} color="stroke-green-400" title="Solve Rate" />
                                            </div>
                                            <div className="text-chess-text-secondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Puzzles List */}
                                    {isExpanded && (
                                        <div className="border-t border-white/5 bg-black/10 transition-all duration-300">
                                            <div className="p-4 space-y-3">
                                                {playlist.filteredPuzzles.length === 0 ? (
                                                    <div className="p-6 text-center text-chess-text-secondary bg-chess-panel/10 rounded-xl">
                                                        No puzzles match the search/filters inside this playlist.
                                                    </div>
                                                ) : (
                                                    playlist.filteredPuzzles.map((puzzle) => (
                                                        <div 
                                                            key={puzzle.id}
                                                            className="bg-chess-panel/30 border border-white/5 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.01] transition-all"
                                                        >
                                                            {/* Puzzle info / Inline rename */}
                                                            <div className="flex-1 min-w-0">
                                                                {editingPuzzleId === puzzle.id ? (
                                                                    <div className="flex items-center gap-2 max-w-md">
                                                                        <input
                                                                            type="text"
                                                                            value={renameValue}
                                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                                            className="flex-1 bg-chess-bg border border-chess-accent focus:ring-0 text-white px-3 py-1 rounded text-sm placeholder:text-chess-text-secondary focus:outline-none"
                                                                            placeholder="Custom puzzle name"
                                                                            disabled={renaming}
                                                                            autoFocus
                                                                        />
                                                                        <button
                                                                            onClick={() => handleSaveRename(puzzle.id, playlist.playlistIndex)}
                                                                            disabled={renaming}
                                                                            className="p-1 text-green-400 hover:text-green-300 disabled:opacity-50"
                                                                            title="Save Name"
                                                                        >
                                                                            {renaming ? (
                                                                                <Loader2 className="animate-spin" size={18} />
                                                                            ) : (
                                                                                <Check size={18} />
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={handleCancelRename}
                                                                            disabled={renaming}
                                                                            className="p-1 text-red-400 hover:text-red-300"
                                                                            title="Cancel"
                                                                        >
                                                                            <X size={18} />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-white font-bold text-base truncate max-w-[280px] sm:max-w-[400px]">
                                                                            {puzzle.customName || `${puzzle.opening} - ${puzzle.theme || 'Blunder'} #${puzzle.id.slice(0, 4)}`}
                                                                        </p>
                                                                        <button
                                                                            onClick={() => handleStartRename(puzzle)}
                                                                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-all opacity-80"
                                                                            title="Rename Puzzle"
                                                                        >
                                                                            <Edit3 size={14} />
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-4 text-xs text-chess-text-secondary mt-1">
                                                                    <span className="flex items-center gap-1 capitalize">
                                                                        <Award size={12} /> {puzzle.theme || 'Opening Blunder'}
                                                                    </span>
                                                                    {puzzle.reviewState?.attempts > 0 && (
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock size={12} /> {puzzle.reviewState.attempts} tries ({puzzle.reviewState.successCount} solved)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Interactive Move controls & Status Badge & Train Action */}
                                                            <div className="flex flex-wrap items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-0 border-white/5 pt-3 md:pt-0">
                                                                {/* Moving panel */}
                                                                {movingPuzzleId === puzzle.id ? (
                                                                    <div className="flex items-center gap-1.5 bg-chess-bg/80 border border-white/10 rounded px-2.5 py-1 shrink-0 backdrop-blur-md">
                                                                        <span className="text-[10px] uppercase font-bold text-chess-text-secondary">Move to:</span>
                                                                        {groups.map(g => (
                                                                            g.playlistIndex !== playlist.playlistIndex && (
                                                                                <button
                                                                                    key={g.playlistIndex}
                                                                                    onClick={() => handleMovePuzzle(puzzle.id, g.playlistIndex)}
                                                                                    disabled={movingState}
                                                                                    className="text-xs bg-white/5 hover:bg-chess-accent hover:text-white px-2 py-0.5 rounded transition-all text-white font-medium disabled:opacity-50"
                                                                                >
                                                                                    {g.title.split(' ')[0]}
                                                                                </button>
                                                                            )
                                                                        ))}
                                                                        <button
                                                                            onClick={() => setMovingPuzzleId(null)}
                                                                            disabled={movingState}
                                                                            className="text-xs text-red-400 hover:text-red-300 font-bold px-1"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setMovingPuzzleId(puzzle.id)}
                                                                        className="text-chess-text-secondary hover:text-white p-1.5 rounded hover:bg-white/5 transition-all text-xs flex items-center gap-1 font-semibold"
                                                                        title="Move Puzzle to another playlist"
                                                                    >
                                                                        <MoveRight size={14} /> Move
                                                                    </button>
                                                                )}

                                                                <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded border ${statusBadge(puzzle.status)}`}>
                                                                    {puzzle.status}
                                                                </span>

                                                                <button
                                                                    onClick={() => navigate(`/dashboard/train?puzzleId=${puzzle.id}`)}
                                                                    className="bg-chess-accent hover:bg-chess-accent-hover text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-1.5 transition-all"
                                                                >
                                                                    Train <ArrowRight size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
