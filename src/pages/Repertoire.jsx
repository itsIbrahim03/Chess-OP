import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
    BookOpen, Search, Filter, Folder, FolderOpen,
    ChevronDown, ChevronUp, Edit3, Check, X,
    Target, Loader2, Award, Clock, ArrowRight,
    MoveRight, Trash2, Star, Play, AlertTriangle, Plus
} from 'lucide-react';
import {
    getUserPlaylists,
    getPuzzlesGroupedByOpening,
    renamePuzzle,
    renamePlaylist,
    movePuzzle,
    toggleFavorite,
    clearPlaylist,
    deletePuzzle,
    createPlaylist
} from '../services/puzzleService';
import { useNavigate } from 'react-router-dom';

const getOpeningIcon = (title) => {
    let hash = 0;
    const str = title || '';
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;

    switch (index) {
        case 0: // Pawn
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 2a3 3 0 0 0-3 3c0 1 .5 1.9 1.3 2.4C8.9 8.2 8 9.5 8 11v3h8v-3c0-1.5-.9-2.8-2.3-3.6.8-.5 1.3-1.4 1.3-2.4a3 3 0 0 0-3-3zM6 20h12v-2H6v2zm3-3h6v-3H9v3z" />
                </svg>
            );
        case 1: // Knight
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M19 20H5v-2h14v2zm-4-8c-.8-1.5-2-2.5-3.5-3-1-.3-2-.3-3-.2C7 9 6.2 9.5 5.5 10c-.7.5-1 1.3-1 2.1l1.5 3.4H15v-3.5z" />
                </svg>
            );
        case 2: // Bishop
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 2a4 4 0 0 0-4 4c0 2 1.5 4 4 6 2.5-2 4-4 4-6a4 4 0 0 0-4-4zm-6 18h12v-2H6v2zm3-3h6v-3H9v3z" />
                </svg>
            );
        case 3: // Rook
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M5 5h3v2h2V5h4v2h2V5h3v5H5V5zm1 15h12v-2H6v2zm2-9h8v4H8v-4z" />
                </svg>
            );
        case 4: // Queen
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 5l2 3.5 3.5-2-1 4.5h-9l-1-4.5 3.5 2zM6 20h12v-2H6v2zm3-3h6v-3H9v3z" />
                </svg>
            );
        case 5: // King
        default:
            return (
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M12 2v3m-2-1.5h4M8 12c-1.5 0-2.5-1-2.5-2.5S6.5 7 8 7h8c1.5 0 2.5 1 2.5 2.5S17.5 12 16 12H8zm-2 8h12v-2H6v2zm3-3h6v-3H9v3z" />
                </svg>
            );
    }
};

export default function Repertoire() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('playlists'); // 'playlists' or 'openings'
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

    // Playlist deletion confirmation state
    const [playlistToDelete, setPlaylistToDelete] = useState(null); // { playlistIndex, title, count }
    const [clearingPlaylist, setClearingPlaylist] = useState(false);

    // Toast alert object: { message, type: 'success' | 'error' }
    const [toast, setToast] = useState(null);

    const loadRepertoire = useCallback(async () => {
        if (!user?.uid) return;
        try {
            const liveGroups = viewMode === 'playlists'
                ? await getUserPlaylists(user.uid)
                : await getPuzzlesGroupedByOpening(user.uid);
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

        } catch (error) {
            console.error('Failed to load repertoire:', error);
        }
    }, [user?.uid, viewMode]);

    useEffect(() => {
        if (!user?.uid) return;

        setLoading(true);
        const timer = setTimeout(async () => {
            await loadRepertoire();
            setLoading(false);
        }, 0);

        return () => clearTimeout(timer);
    }, [user?.uid, viewMode, loadRepertoire]);

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
            setToast({ message: 'Puzzle renamed successfully!', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Rename failed:', e);
            setToast({ message: 'Failed to rename puzzle.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
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
            setToast({ message: 'Playlist renamed successfully!', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Playlist rename failed:', e);
            setToast({ message: 'Failed to rename playlist.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
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
            setToast({ message: 'Puzzle moved successfully!', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Move puzzle failed:', e);
            setToast({ message: 'Failed to move puzzle.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setMovingState(false);
        }
    };

    // Star favorite handler
    const handleToggleFavorite = async (puzzle, playlistIdx) => {
        const newFavState = !puzzle.isFavorite;

        // Optimistic local state update
        setGroups(prev => prev.map(group => {
            if (group.playlistIndex === playlistIdx) {
                return {
                    ...group,
                    puzzles: group.puzzles.map(p => {
                        if (p.id === puzzle.id) {
                            return { ...p, isFavorite: newFavState };
                        }
                        return p;
                    })
                };
            }
            return group;
        }));

        try {
            await toggleFavorite(user.uid, puzzle.id, newFavState);
            setToast({
                message: newFavState ? 'Added to Favorites! (Limit 10)' : 'Removed from Favorites.',
                type: 'success'
            });
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Favorite toggle failed:', e);
            // Rollback local state
            setGroups(prev => prev.map(group => {
                if (group.playlistIndex === playlistIdx) {
                    return {
                        ...group,
                        puzzles: group.puzzles.map(p => {
                            if (p.id === puzzle.id) {
                                return { ...p, isFavorite: !newFavState };
                            }
                            return p;
                        })
                    };
                }
                return group;
            }));

            if (e.message === 'FAVORITES_LIMIT_EXCEEDED') {
                setToast({ message: 'Favorites limit reached! Maximum 10 starred puzzles allowed.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            } else {
                setToast({ message: 'Failed to update favorite status.', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        }
    };

    // Individual puzzle delete handler
    const handleDeletePuzzle = async (puzzleId, playlistIdx) => {
        if (!window.confirm('Are you sure you want to delete this puzzle?')) return;
        try {
            await deletePuzzle(user.uid, puzzleId);
            setGroups(prev => prev.map(group => {
                if (group.playlistIndex === playlistIdx) {
                    return {
                        ...group,
                        puzzles: group.puzzles.filter(p => p.id !== puzzleId)
                    };
                }
                return group;
            }));
            setToast({ message: 'Puzzle deleted successfully!', type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (e) {
            console.error('Delete puzzle failed:', e);
            setToast({ message: 'Failed to delete puzzle.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    // Playlist batch delete handler
    const handleConfirmDeletePlaylist = async () => {
        if (!playlistToDelete) return;
        setClearingPlaylist(true);
        try {
            await clearPlaylist(user.uid, playlistToDelete.playlistIndex);
            setPlaylistToDelete(null);
            await loadRepertoire();
            setToast({ message: 'Playlist cleared and removed successfully!', type: 'success' });
            setTimeout(() => setToast(null), 4000);
        } catch (e) {
            console.error('Playlist delete failed:', e);
            setToast({ message: 'Failed to delete playlist.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setClearingPlaylist(false);
        }
    };

    // Playlist creation handler
    const handleCreatePlaylist = async () => {
        const name = window.prompt("Enter a name for your new training playlist:");
        if (!name || !name.trim()) return;

        setLoading(true);
        try {
            await createPlaylist(user.uid, name);
            await loadRepertoire();
            setToast({ message: `Playlist "${name.trim()}" created successfully!`, type: 'success' });
            setTimeout(() => setToast(null), 3500);
        } catch (e) {
            console.error('Failed to create playlist:', e);
            setToast({ message: 'Failed to create playlist.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setLoading(false);
        }
    };

    // Launch 10-Puzzle Training Session (respects active filters)
    const handleLaunchSession = () => {
        const filteredPuzzles = filteredGroups.flatMap(g => g.filteredPuzzles);
        const allPuzzles = groups.flatMap(g => g.puzzles);

        if (allPuzzles.length === 0) {
            setToast({ message: 'No puzzles available in your repertoire. Analyze games first!', type: 'error' });
            setTimeout(() => setToast(null), 4000);
            return;
        }

        const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all';

        if (hasActiveFilters) {
            if (filteredPuzzles.length === 0) {
                setToast({ message: 'No puzzles match your currently selected filters!', type: 'error' });
                setTimeout(() => setToast(null), 4000);
                return;
            }

            const proceed = window.confirm(`You have active filters. The training session will only include the ${Math.min(filteredPuzzles.length, 10)} puzzles matching your selected filters. Proceed?`);
            if (!proceed) return;

            // Shuffle and select up to 10 matching puzzles
            const shuffled = [...filteredPuzzles].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 10).map(p => p.id);

            sessionStorage.setItem('oneTimePlaylist', JSON.stringify(selected));
            sessionStorage.setItem('oneTimeSessionResults', JSON.stringify([]));
            navigate('/dashboard/train?session=one-time');
        } else {
            // Unfiltered session: shuffle and take 10 random puzzles from the entire deck
            const shuffled = [...allPuzzles].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, 10).map(p => p.id);

            sessionStorage.setItem('oneTimePlaylist', JSON.stringify(selected));
            sessionStorage.setItem('oneTimeSessionResults', JSON.stringify([]));
            navigate('/dashboard/train?session=one-time');
        }
    };

    // Date checker helper for [NEW] badge
    const isAddedToday = (createdAt) => {
        if (!createdAt) return false;
        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // Filters and search logic (Only by puzzle name)
    const filteredGroups = groups.map(group => {
        const filteredPuzzles = group.puzzles.filter(puzzle => {
            const nameToSearch = puzzle.customName || puzzle.opening || 'Puzzle';
            const matchesSearch =
                !searchQuery.trim() ||
                nameToSearch.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'favorites' && puzzle.isFavorite === true) ||
                (statusFilter === 'new' && puzzle.status === 'new') ||
                (statusFilter === 'active' && (puzzle.status === 'active' || puzzle.lastResult === 'fail')) ||
                (statusFilter === 'white' && puzzle.userColor === 'white') ||
                (statusFilter === 'black' && puzzle.userColor === 'black');

            return matchesSearch && matchesStatus;
        });

        return {
            ...group,
            filteredPuzzles
        };
    });

    const hasAnyPuzzles = groups.some(g => g.total > 0 || g.puzzles.length > 0);

    // SVG Circular Ring Gauge
    const CircularGauge = ({ percentage, color = 'stroke-chess-accent', title, subtitle }) => {
        const radius = 38;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <div className="flex flex-col items-center gap-1 shrink-0" title={title}>
                <div className="relative w-24 h-24 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="48"
                            cy="48"
                            r={radius}
                            className="stroke-white/5 fill-transparent"
                            strokeWidth="5"
                        />
                        <circle
                            cx="48"
                            cy="48"
                            r={radius}
                            className={`fill-transparent transition-all duration-1000 ${color}`}
                            strokeWidth="5"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <span className="absolute text-lg font-bold text-white">{percentage}%</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-chess-text-secondary tracking-wider mt-1.5">{title}</span>
                {subtitle && <span className="text-[9px] text-chess-text-secondary opacity-70 font-semibold">{subtitle}</span>}
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

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full relative pb-20">

                {/* Dynamic Toast Alerts */}
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 backdrop-blur-md transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-500/90 shadow-emerald-500/10' : 'bg-red-500/90 animate-bounce shadow-red-500/10'
                        }`}>
                        {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        <span className="font-bold text-sm">{toast.message}</span>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-white mb-2">My Repertoire</h1>
                        <p className="text-chess-text-secondary">
                            {viewMode === 'playlists'
                                ? 'Organize your blunders into dynamic sequential training playlists of up to 20 puzzles each.'
                                : 'Explore your analyzed blunders grouped dynamically by opening name.'
                            }
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {viewMode === 'playlists' && (
                            <button
                                onClick={handleCreatePlaylist}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all hover:-translate-y-0.5 text-sm"
                            >
                                <Plus size={16} /> Create Playlist
                            </button>
                        )}
                        {hasAnyPuzzles && (
                            <button
                                onClick={handleLaunchSession}
                                className="bg-chess-accent hover:bg-chess-accent-hover text-white px-4 py-2.5 rounded-lg font-bold shadow-lg shadow-chess-accent/20 flex items-center gap-2 transition-all hover:-translate-y-0.5 text-sm"
                            >
                                <Play size={16} fill="currentColor" /> Start Training Session
                            </button>
                        )}
                    </div>
                </div>

                {/* Filters & Search Controls */}
                <div className="flex flex-col md:flex-row gap-4 mb-8 bg-chess-panel border border-white/5 p-4 rounded-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by puzzle name..."
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
                            <option value="favorites">Starred Puzzles</option>
                            <option value="new">New Puzzles</option>
                            <option value="active">Failed Puzzles</option>
                            <option value="white">White Color</option>
                            <option value="black">Black Color</option>
                        </select>
                    </div>
                </div>

                {/* Repertoire Data Loading */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="animate-spin text-chess-accent mb-4" size={40} />
                        <p className="text-chess-text-secondary font-medium">Gathering your repertoire...</p>
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
                    /* List View */
                    <div className="space-y-6">
                        {filteredGroups.map((playlist) => {
                            if (playlist.puzzles.length === 0 && viewMode === 'openings') return null; // hide empty dynamic opening groups
                            if (playlist.puzzles.length === 0 && viewMode === 'playlists' && !groups.some(g => g.playlistIndex === playlist.playlistIndex && g.total > 0)) {
                                // Double check if it is explicitly created or has a custom name. If not, don't show.
                            }
                            const isExpanded = !!expandedGroups[playlist.playlistIndex];

                            return (
                                <div
                                    key={playlist.playlistIndex}
                                    className={`bg-chess-panel border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'ring-1 ring-chess-accent/30 shadow-2xl' : 'hover:border-white/10'
                                        }`}
                                >
                                    {/* Playlist/Opening Header Card */}
                                    <div
                                        onClick={() => toggleGroup(playlist.playlistIndex)}
                                        className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                                    >
                                        <div className="flex gap-4 items-start sm:items-center flex-1 min-w-0">
                                            {/* Icon */}
                                            <div className="w-12 h-12 bg-chess-accent/10 border border-chess-accent/25 text-chess-accent rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                                                {viewMode === 'playlists' ? (
                                                    isExpanded ? <FolderOpen size={24} /> : <Folder size={24} />
                                                ) : (
                                                    getOpeningIcon(playlist.title)
                                                )}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                {editingPlaylistIdx === playlist.playlistIndex ? (
                                                    <div className="flex items-center gap-2 max-w-sm mb-1" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={playlistRenameValue}
                                                            onChange={(e) => setPlaylistRenameValue(e.target.value)}
                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlaylistRename(playlist.playlistIndex); }}
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
                                                            {renamingPlaylist ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
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
                                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                        <h3 className="text-xl font-bold text-white truncate max-w-[220px] sm:max-w-[360px]">
                                                            {playlist.title}
                                                        </h3>
                                                        {viewMode === 'playlists' && (
                                                            <>
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
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPlaylistToDelete({
                                                                            playlistIndex: playlist.playlistIndex,
                                                                            title: playlist.title,
                                                                            count: playlist.puzzles.length
                                                                        });
                                                                    }}
                                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-1.5 rounded transition-all"
                                                                    title="Delete Playlist"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-chess-text-secondary">
                                                    <span className="flex items-center gap-1">
                                                        <Folder size={14} /> {playlist.puzzles.length} puzzles
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
                                                <CircularGauge
                                                    percentage={playlist.progress}
                                                    color="stroke-chess-accent"
                                                    title="Mastery"
                                                    subtitle={`${playlist.solved}/${playlist.total} Solved`}
                                                />
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
                                                        No puzzles match the search/filters inside this section.
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
                                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(puzzle.id, playlist.playlistIndex); }}
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
                                                                            {renaming ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
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
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <p className="text-white font-bold text-base truncate max-w-[280px] sm:max-w-[400px]">
                                                                            {puzzle.customName || `${puzzle.opening} - ${puzzle.theme || 'Blunder'} #${puzzle.id.slice(0, 4)}`}
                                                                        </p>
                                                                        {isAddedToday(puzzle.createdAt) && (
                                                                            <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse shrink-0">
                                                                                NEW
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            onClick={() => handleStartRename(puzzle)}
                                                                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-all opacity-80"
                                                                            title="Rename Puzzle"
                                                                        >
                                                                            <Edit3 size={13} />
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                <div className="flex items-center gap-4 text-xs text-chess-text-secondary mt-1">
                                                                    {puzzle.reviewState?.attempts > 0 && (
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock size={12} /> {puzzle.reviewState.attempts} tries ({puzzle.reviewState.successCount} solved)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Interactive Move controls & Status Badge & Train Action */}
                                                            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-0 border-white/5 pt-3 md:pt-0">
                                                                {/* Star favorite toggle */}
                                                                <button
                                                                    onClick={() => handleToggleFavorite(puzzle, playlist.playlistIndex)}
                                                                    className={`p-1.5 rounded-lg transition-all ${puzzle.isFavorite
                                                                        ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                                                                        : 'text-chess-text-secondary hover:text-yellow-400 hover:bg-yellow-400/10'
                                                                        }`}
                                                                    title={puzzle.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                                                                >
                                                                    <Star size={16} fill={puzzle.isFavorite ? "currentColor" : "none"} />
                                                                </button>

                                                                {/* Moving panel (Only in Playlist viewMode) */}
                                                                {viewMode === 'playlists' && (
                                                                    movingPuzzleId === puzzle.id ? (
                                                                        <div className="flex items-center gap-1 bg-chess-bg/85 border border-white/10 rounded px-2.5 py-1 shrink-0 backdrop-blur-md">
                                                                            <span className="text-[10px] uppercase font-bold text-chess-text-secondary mr-1">Move to:</span>
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
                                                                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-all text-xs flex items-center gap-0.5 font-semibold"
                                                                            title="Move Puzzle to another playlist"
                                                                        >
                                                                            <MoveRight size={13} /> Move
                                                                        </button>
                                                                    )
                                                                )}

                                                                {/* Delete Puzzle */}
                                                                <button
                                                                    onClick={() => handleDeletePuzzle(puzzle.id, playlist.playlistIndex)}
                                                                    className="text-chess-text-secondary hover:text-red-405 p-1 rounded hover:bg-white/5 transition-all"
                                                                    title="Delete Puzzle"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>

                                                                <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${statusBadge(puzzle.status)}`}>
                                                                    {puzzle.status}
                                                                </span>

                                                                <button
                                                                    onClick={() => navigate(`/dashboard/train?puzzleId=${puzzle.id}`)}
                                                                    className="bg-chess-accent hover:bg-chess-accent-hover text-white px-3.5 py-1.5 rounded-lg font-bold text-xs shadow-md flex items-center gap-1 transition-all"
                                                                >
                                                                    Train <ArrowRight size={12} />
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

                {/* Floating Horizontal Ellipse View Toggle Button (Bottom-Right) - Fully Fixed Position (No Relative class override) */}
                <div className="fixed bottom-8 right-8 z-50 bg-chess-panel/90 border border-white/10 rounded-full shadow-2xl p-1 flex items-center justify-between backdrop-blur-lg overflow-hidden w-[96px] h-[50px]">
                    {/* Active Sliding pill indicator */}
                    <div
                        className="absolute left-1 top-1 h-[40px] w-[40px] bg-chess-accent rounded-full transition-all duration-300 ease-out pointer-events-none"
                        style={{
                            transform: viewMode === 'playlists' ? 'translateX(0px)' : 'translateX(46px)'
                        }}
                    />
                    {/* Book icon (Playlist view) */}
                    <button
                        onClick={() => setViewMode('playlists')}
                        className={`relative z-10 w-[40px] h-[40px] flex items-center justify-center rounded-full transition-colors duration-300 ${viewMode === 'playlists' ? 'text-white' : 'text-chess-text-secondary hover:text-white'
                            }`}
                        title="Sequential Playlists View"
                    >
                        <BookOpen size={18} />
                    </button>
                    {/* Pawn icon (Opening view) */}
                    <button
                        onClick={() => setViewMode('openings')}
                        className={`relative z-10 w-[40px] h-[40px] flex items-center justify-center rounded-full transition-colors duration-300 ${viewMode === 'openings' ? 'text-white' : 'text-chess-text-secondary hover:text-white'
                            }`}
                        title="Group by Openings View"
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12 2a3 3 0 0 0-3 3c0 1 .5 1.9 1.3 2.4C8.9 8.2 8 9.5 8 11v3h8v-3c0-1.5-.9-2.8-2.3-3.6.8-.5 1.3-1.4 1.3-2.4a3 3 0 0 0-3-3zM6 20h12v-2H6v2zm3-3h6v-3H9v3z" />
                        </svg>
                    </button>
                </div>

                {/* Playlist Deletion Overlay Warning Modal */}
                {playlistToDelete && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-chess-panel border border-red-500/30 max-w-md w-full rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                            {/* Accent background glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />

                            <div className="flex items-center gap-3 text-red-400 mb-4">
                                <AlertTriangle size={32} />
                                <h3 className="text-xl font-bold font-serif text-white">Delete Playlist</h3>
                            </div>

                            <p className="text-chess-text-secondary text-sm mb-2 leading-relaxed">
                                Are you sure you want to delete <span className="text-white font-bold">"{playlistToDelete.title}"</span>?
                            </p>

                            <p className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs font-semibold leading-relaxed mb-6">
                                ⚠️ WARNING: This will permanently delete all {playlistToDelete.count} puzzles inside this playlist from the database, even if they are marked as a Favorite. This action is irreversible.
                            </p>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setPlaylistToDelete(null)}
                                    disabled={clearingPlaylist}
                                    className="px-4 py-2 text-sm text-chess-text-secondary hover:text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDeletePlaylist}
                                    disabled={clearingPlaylist}
                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg shadow-red-600/15 flex items-center gap-2"
                                >
                                    {clearingPlaylist ? (
                                        <>
                                            <Loader2 className="animate-spin" size={14} /> Deleting...
                                        </>
                                    ) : (
                                        <>
                                            Yes, Delete Everything
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </DashboardLayout>
    );
}
