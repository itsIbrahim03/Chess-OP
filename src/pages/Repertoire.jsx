import React, { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import {
    BookOpen, Search, Filter, Folder, FolderOpen,
    ChevronDown, ChevronUp, Edit3, Check, X,
    Loader2, Award, Clock, ArrowRight,
    MoveRight, Trash2, Star, Play, AlertTriangle, Plus,
    ArrowUpDown
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
    createPlaylist,
    getFavoritePuzzles
} from '../services/puzzleService';
import { useNavigate } from 'react-router-dom';
import ThemedDialog from '../components/ThemedDialog';

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
    const [colorFilter, setColorFilter] = useState('all');
    const [sortOption, setSortOption] = useState('newest');
    const [expandedGroups, setExpandedGroups] = useState({});
    const isFiltering = searchQuery.trim() !== '' || statusFilter !== 'all' || colorFilter !== 'all';

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

    // Themed Confirm Dialog State
    const [confirmConfig, setConfirmConfig] = useState({
        show: false,
        title: '',
        message: '',
        type: 'confirm',
        onConfirm: null,
        onCancel: null
    });

    const showConfirm = (message, onConfirm, onCancel = null, title = 'Confirm Action', type = 'confirm') => {
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

    const [favPuzzles, setFavPuzzles] = useState([]);
    const [unfavoriteToDelete, setUnfavoriteToDelete] = useState(null);

    const loadRepertoire = useCallback(async () => {
        if (!user?.uid) return;
        try {
            if (viewMode === 'playlists') {
                const [livePlaylists, liveFavorites] = await Promise.all([
                    getUserPlaylists(user.uid),
                    getFavoritePuzzles(user.uid)
                ]);
                setGroups(livePlaylists);
                setFavPuzzles(liveFavorites);

                // Keep expanded states preserved
                setExpandedGroups(prev => {
                    const updated = { ...prev };
                    livePlaylists.forEach(g => {
                        if (updated[g.playlistIndex] === undefined) {
                            updated[g.playlistIndex] = false;
                        }
                    });
                    if (updated['favorites'] === undefined) {
                        updated['favorites'] = false;
                    }
                    return updated;
                });
            } else {
                const liveGroups = await getPuzzlesGroupedByOpening(user.uid);
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
            }

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

    // Pick up ?filter= query parameter from URL to auto-apply status/color filters
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const filterParam = params.get('filter');
        if (filterParam) {
            if (['white', 'black'].includes(filterParam)) {
                setColorFilter(filterParam);
                setStatusFilter('all');
            } else if (['all', 'new', 'active', 'srs_due'].includes(filterParam)) {
                setStatusFilter(filterParam);
                setColorFilter('all');
            }
        }
    }, []);

    // Listen to expand=favorites query parameter to auto-unfold
    useEffect(() => {
        if (loading) return;
        const params = new URLSearchParams(window.location.search);
        const expandParam = params.get('expand');
        if (expandParam === 'favorites') {
            setExpandedGroups(prev => ({
                ...prev,
                favorites: true
            }));
            setTimeout(() => {
                const element = document.getElementById('favorites-card');
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                }
            }, 300);
        }
    }, [loading]);

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

    const handleSaveRename = async (puzzleId) => {
        if (!renameValue.trim()) return;
        setRenaming(true);
        try {
            await renamePuzzle(user.uid, puzzleId, renameValue);

            // Update local state optimistically - update puzzle in whatever group it resides
            setGroups(prev => prev.map(group => {
                return {
                    ...group,
                    puzzles: group.puzzles.map(p => {
                        if (p.id === puzzleId) {
                            return { ...p, customName: renameValue.trim() };
                        }
                        return p;
                    })
                };
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

            // Update local state - use string matching to avoid number/string mismatch
            setGroups(prev => prev.map(g => {
                if (g.playlistIndex !== undefined && g.playlistIndex.toString() === playlistIdx.toString()) {
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
    const handleToggleFavorite = async (puzzle) => {
        const newFavState = !puzzle.isFavorite;

        if (newFavState) {
            // Enforce favorites capacity limit
            if (favPuzzles.length >= 10) {
                setToast({ message: 'Favorites limit reached! Maximum 10 starred puzzles allowed.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
                return;
            }
        } else {
            // Intercept unfavoriting if all playlists are full (20/20 each)
            const count0 = groups.find(g => g.playlistIndex === 0)?.puzzles.length || 0;
            const count1 = groups.find(g => g.playlistIndex === 1)?.puzzles.length || 0;
            const count2 = groups.find(g => g.playlistIndex === 2)?.puzzles.length || 0;
            if (count0 >= 20 && count1 >= 20 && count2 >= 20) {
                setUnfavoriteToDelete(puzzle);
                return;
            }
        }

        try {
            await toggleFavorite(user.uid, puzzle.id, newFavState);
            setToast({
                message: newFavState ? 'Added to Favorites! (Limit 10)' : 'Removed from Favorites.',
                type: 'success'
            });
            setTimeout(() => setToast(null), 3000);
            await loadRepertoire();
        } catch (e) {
            console.error('Favorite toggle failed:', e);
            if (e.message === 'PLAYLISTS_FULL') {
                setUnfavoriteToDelete(puzzle);
            } else if (e.message === 'FAVORITES_LIMIT_EXCEEDED') {
                setToast({ message: 'Favorites limit reached! Maximum 10 starred puzzles allowed.', type: 'error' });
                setTimeout(() => setToast(null), 5000);
            } else {
                setToast({ message: 'Failed to update favorite status.', type: 'error' });
                setTimeout(() => setToast(null), 3000);
            }
        }
    };

    const handleConfirmUnfavoriteDelete = async () => {
        if (!unfavoriteToDelete) return;
        try {
            await deletePuzzle(user.uid, unfavoriteToDelete.id);
            setFavPuzzles(prev => prev.filter(p => p.id !== unfavoriteToDelete.id));
            setUnfavoriteToDelete(null);
            setToast({ message: 'Puzzle permanently deleted since playlists are full.', type: 'success' });
            setTimeout(() => setToast(null), 3000);
            await loadRepertoire();
        } catch (e) {
            console.error('Delete failed:', e);
            setToast({ message: 'Failed to delete puzzle.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleCancelUnfavorite = () => {
        setUnfavoriteToDelete(null);
    };

    // Individual puzzle delete handler
    const handleDeletePuzzle = (puzzleId, playlistIdx) => {
        showConfirm(
            'Are you sure you want to delete this puzzle?',
            async () => {
                try {
                    await deletePuzzle(user.uid, puzzleId);
                    if (playlistIdx === 'favorites') {
                        setFavPuzzles(prev => prev.filter(p => p.id !== puzzleId));
                    } else {
                        setGroups(prev => prev.map(group => {
                            if (group.playlistIndex === playlistIdx) {
                                const updatedPuzzles = group.puzzles.filter(p => p.id !== puzzleId);
                                const total = updatedPuzzles.length;
                                const solved = updatedPuzzles.filter(p => p.reviewState?.isSolved).length;
                                const mastered = updatedPuzzles.filter(p => p.status === 'mastered').length;
                                const progress = total > 0 ? Math.round((solved / total) * 100) : 0;
                                const mastery = mastered >= total * 0.8 ? 'Expert'
                                              : mastered >= total * 0.5 ? 'Advanced'
                                              : solved  >= total * 0.5 ? 'Intermediate'
                                              : 'Novice';
                                return {
                                    ...group,
                                    puzzles: updatedPuzzles,
                                    total,
                                    solved,
                                    mastered,
                                    progress,
                                    mastery
                                };
                            }
                            return group;
                        }));
                    }
                    setToast({ message: 'Puzzle deleted successfully!', type: 'success' });
                    setTimeout(() => setToast(null), 3000);
                } catch (e) {
                    console.error('Delete puzzle failed:', e);
                    setToast({ message: 'Failed to delete puzzle.', type: 'error' });
                    setTimeout(() => setToast(null), 3000);
                }
            },
            null,
            'Delete Puzzle',
            'confirm'
        );
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

    // Create playlist modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);

    // Playlist creation handler
    const handleCreatePlaylist = () => {
        // Block creating a 4th playlist (indices 0, 1, 2 = 3 playlists max)
        const existingCount = groups.filter(g => typeof g.playlistIndex === 'number').length;
        if (existingCount >= 3) {
            setToast({ message: 'Maximum 3 playlists allowed. Delete an existing playlist first.', type: 'error' });
            setTimeout(() => setToast(null), 4000);
            return;
        }
        setNewPlaylistName('');
        setShowCreateModal(true);
    };

    const handleConfirmCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) return;
        setCreatingPlaylist(true);
        try {
            await createPlaylist(user.uid, newPlaylistName);
            await loadRepertoire();
            setShowCreateModal(false);
            setNewPlaylistName('');
            setToast({ message: `Playlist "${newPlaylistName.trim()}" created successfully!`, type: 'success' });
            setTimeout(() => setToast(null), 3500);
        } catch (e) {
            console.error('Failed to create playlist:', e);
            setToast({ message: 'Failed to create playlist.', type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setCreatingPlaylist(false);
        }
    };

    const handleTrainPlaylist = (playlist) => {
        if (viewMode === 'playlists') {
            const id = playlist.playlistIndex !== undefined ? playlist.playlistIndex : 'favorites';
            navigate(`/dashboard/train?playlistId=${id}`);
        } else {
            navigate(`/dashboard/train?opening=${encodeURIComponent(playlist.title)}`);
        }
    };


    // Common helper to filter and sort puzzles
    const getFilteredAndSortedPuzzles = useCallback((puzzlesList) => {
        const now = new Date();
        
        const getCreatedAtTime = (p) => {
            if (!p.createdAt) return 0;
            if (typeof p.createdAt.toMillis === 'function') return p.createdAt.toMillis();
            if (typeof p.createdAt.seconds === 'number') return p.createdAt.seconds * 1000;
            return new Date(p.createdAt).getTime() || 0;
        };

        const getNextDueDateTime = (p) => {
            if (!p.nextDueDate) return 0;
            if (typeof p.nextDueDate.toMillis === 'function') return p.nextDueDate.toMillis();
            if (typeof p.nextDueDate.seconds === 'number') return p.nextDueDate.seconds * 1000;
            return new Date(p.nextDueDate).getTime() || 0;
        };

        const filtered = puzzlesList.filter(puzzle => {
            const nameToSearch = puzzle.customName || puzzle.opening || 'Puzzle';
            const matchesSearch =
                !searchQuery.trim() ||
                nameToSearch.toLowerCase().includes(searchQuery.toLowerCase());

            const isDue = puzzle.nextDueDate
                ? getNextDueDateTime(puzzle) <= now.getTime()
                : true;

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'new' && puzzle.status === 'new') ||
                (statusFilter === 'srs_due' && isDue) ||
                (statusFilter === 'active' && (puzzle.lastResult === 'fail' || (puzzle.reviewState?.failCount || 0) > 0));

            const matchesColor =
                colorFilter === 'all' ||
                puzzle.userColor === colorFilter;

            return matchesSearch && matchesStatus && matchesColor;
        });

        return [...filtered].sort((a, b) => {
            if (sortOption === 'oldest') {
                const timeA = getCreatedAtTime(a);
                const timeB = getCreatedAtTime(b);
                if (timeA !== timeB) return timeA - timeB;
                return a.id.localeCompare(b.id);
            }
            if (sortOption === 'failed') {
                const aFail = (a.recurrentCount || 0) * 10 + (a.reviewState?.failCount || 0);
                const bFail = (b.recurrentCount || 0) * 10 + (b.reviewState?.failCount || 0);
                if (aFail !== bFail) return bFail - aFail;
                return getCreatedAtTime(b) - getCreatedAtTime(a);
            }
            if (sortOption === 'due_date') {
                const timeA = getNextDueDateTime(a);
                const timeB = getNextDueDateTime(b);
                if (timeA !== timeB) return timeA - timeB;
                return getCreatedAtTime(b) - getCreatedAtTime(a);
            }
            // 'newest' (default)
            const timeA = getCreatedAtTime(a);
            const timeB = getCreatedAtTime(b);
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
        });
    }, [searchQuery, statusFilter, colorFilter, sortOption]);

    // Filters and search logic
    const filteredGroups = groups.map(group => {
        return {
            ...group,
            filteredPuzzles: getFilteredAndSortedPuzzles(group.puzzles)
        };
    });

    const filteredFavPuzzles = getFilteredAndSortedPuzzles(favPuzzles);

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
                                : 'Explore your analysed blunders grouped dynamically by opening name.'
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
                    </div>
                </div>

                {/* Filters & Search Controls */}
                <div className="flex flex-col lg:flex-row gap-4 mb-8 bg-chess-panel border border-white/5 p-4 rounded-xl items-stretch lg:items-center">
                    <div className="relative flex-1 text-left">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by puzzle name..."
                            className="w-full bg-chess-bg/50 border border-white/10 focus:border-chess-accent focus:ring-0 text-white pl-10 pr-4 py-2.5 rounded-lg placeholder:text-chess-text-secondary transition-colors text-sm"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Status Filter */}
                        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                            <Filter className="text-chess-text-secondary shrink-0" size={16} />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full sm:w-auto bg-chess-bg border border-white/10 text-white py-2 pl-3 pr-8 rounded-lg focus:border-chess-accent focus:ring-0 text-xs font-semibold transition-colors"
                            >
                                <option value="all">All Statuses</option>
                                <option value="new">New Puzzles</option>
                                <option value="srs_due">Due for Review</option>
                                <option value="active">Failed Puzzles</option>
                            </select>
                        </div>

                        {/* Color Filter */}
                        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                            <svg viewBox="0 0 24 24" className="text-chess-text-secondary shrink-0" fill="currentColor" style={{ width: '16px', height: '16px' }}>
                                <path d="M12 2a3 3 0 0 0-3 3c0 1 .5 1.9 1.3 2.4C8.9 8.2 8 9.5 8 11v3h8v-3c0-1.5-.9-2.8-2.3-3.6.8-.5 1.3-1.4 1.3-2.4a3 3 0 0 0-3-3zM6 20h12v-2H6v2zm3-3h6v-3H9v3z" />
                            </svg>
                            <select
                                value={colorFilter}
                                onChange={(e) => setColorFilter(e.target.value)}
                                className="w-full sm:w-auto bg-chess-bg border border-white/10 text-white py-2 pl-3 pr-8 rounded-lg focus:border-chess-accent focus:ring-0 text-xs font-semibold transition-colors"
                            >
                                <option value="all">All Colors</option>
                                <option value="white">White Pieces</option>
                                <option value="black">Black Pieces</option>
                            </select>
                        </div>

                        {/* Sort Option */}
                        <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                            <ArrowUpDown className="text-chess-text-secondary shrink-0" size={16} />
                            <select
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value)}
                                className="w-full sm:w-auto bg-chess-bg border border-white/10 text-white py-2 pl-3 pr-8 rounded-lg focus:border-chess-accent focus:ring-0 text-xs font-semibold transition-colors"
                            >
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="failed">Most Failed</option>
                                <option value="due_date">Due Date</option>
                            </select>
                        </div>

                        {/* Reset Filters */}
                        {(searchQuery.trim() !== '' || statusFilter !== 'all' || colorFilter !== 'all' || sortOption !== 'newest') && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('all');
                                    setColorFilter('all');
                                    setSortOption('newest');
                                }}
                                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 border border-red-500/20 hover:border-red-500/30 px-3 py-2 bg-red-500/5 hover:bg-red-500/10 rounded-lg h-[34px] sm:h-auto"
                                title="Reset all filters and sorting"
                            >
                                <X size={14} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Repertoire Data Loading */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <Loader2 className="animate-spin text-chess-accent mb-4" size={40} />
                        <p className="text-chess-text-secondary font-medium">Gathering your repertoire...</p>
                    </div>
                ) : (!hasAnyPuzzles && viewMode === 'openings') ? (
                    /* Global Empty State for dynamically grouped openings */
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
                            onClick={() => navigate('/dashboard/analysis-board', { state: { activeTab: 'ingest' } })}
                            className="px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-chess-accent/20 hover:-translate-y-0.5 transition-all"
                        >
                            Analyse Games <ArrowRight size={18} />
                        </button>
                    </div>
                ) : (
                    /* List View (Shows playlists even when empty, so they can be managed/created) */
                    <div className="space-y-6">
                        {!hasAnyPuzzles && viewMode === 'playlists' && (
                            <div className="bg-chess-panel border border-white/5 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl backdrop-blur-md relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-chess-accent/5 to-transparent pointer-events-none" />
                                <div className="flex items-center gap-4 text-left">
                                    <div className="w-12 h-12 bg-chess-accent/15 border border-chess-accent/20 text-chess-accent rounded-xl flex items-center justify-center shrink-0">
                                        <BookOpen size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-base">Your Repertoire is Empty</h3>
                                        <p className="text-xs text-chess-text-secondary mt-0.5">You don't have any puzzles loaded yet. Link your Lichess account and scan games to build your training decks!</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => navigate('/dashboard/analysis-board', { state: { activeTab: 'ingest' } })}
                                    className="px-5 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-sm shadow-lg shadow-chess-accent/10 transition-all shrink-0 hover:-translate-y-0.5 cursor-pointer"
                                >
                                    Analyse Games
                                </button>
                            </div>
                        )}
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

                                                <div className="flex items-center gap-4 text-xs text-chess-text-secondary mt-1 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <Folder size={14} /> {playlist.puzzles.length} puzzles
                                                    </span>
                                                    {(isFiltering || playlist.filteredPuzzles.length !== playlist.puzzles.length) && (
                                                        <span className="text-chess-accent">({playlist.filteredPuzzles.length} match filters)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Gauges and Collapsible Indicators */}
                                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-white/5 pt-4 sm:pt-0 sm:border-0 shrink-0">
                                            {playlist.puzzles.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTrainPlaylist(playlist);
                                                    }}
                                                    className="px-4 py-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-extrabold text-xs shadow-lg shadow-chess-accent/15 transition-all flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95 cursor-pointer shrink-0"
                                                    title="Start training this playlist"
                                                >
                                                    <Play size={14} fill="currentColor" /> Train Playlist
                                                </button>
                                            )}
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
                                                {playlist.puzzles.length === 0 ? (
                                                    <div className="p-8 text-center text-chess-text-secondary bg-chess-panel/10 rounded-xl flex flex-col items-center justify-center gap-2">
                                                        <FolderOpen size={32} className="opacity-30 mb-1" />
                                                        <p className="font-bold text-sm text-white/85">This Playlist is Empty</p>
                                                        <p className="text-xs max-w-sm">No blunder positions have been saved here yet. Scan matches or move existing puzzles here to populate it!</p>
                                                    </div>
                                                ) : playlist.filteredPuzzles.length === 0 ? (
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
                                                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(puzzle.id); }}
                                                                            className="flex-1 bg-chess-bg border border-chess-accent focus:ring-0 text-white px-3 py-1 rounded text-sm placeholder:text-chess-text-secondary focus:outline-none"
                                                                            placeholder="Custom puzzle name"
                                                                            disabled={renaming}
                                                                            autoFocus
                                                                        />
                                                                        <button
                                                                            onClick={() => handleSaveRename(puzzle.id)}
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
                                                                        {puzzle.status === 'new' && (
                                                                            <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse shrink-0">
                                                                                NEW
                                                                            </span>
                                                                        )}
                                                                        {puzzle.userColor === 'white' ? (
                                                                            <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-white" /> White
                                                                            </span>
                                                                        ) : (
                                                                            <span className="bg-black/40 text-slate-300 border border-white/5 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Black
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
                                                                    disabled={!puzzle.isFavorite && favPuzzles.length >= 10}
                                                                    className={`p-1.5 rounded-lg transition-all ${puzzle.isFavorite
                                                                        ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                                                                        : !puzzle.isFavorite && favPuzzles.length >= 10
                                                                            ? 'text-chess-text-secondary/35 cursor-not-allowed opacity-45'
                                                                            : 'text-chess-text-secondary hover:text-yellow-400 hover:bg-yellow-400/10'
                                                                        }`}
                                                                    title={puzzle.isFavorite 
                                                                        ? "Remove from Favorites" 
                                                                        : favPuzzles.length >= 10 
                                                                            ? "Favorites limit reached (10/10)" 
                                                                            : "Add to Favorites"
                                                                    }
                                                                >
                                                                    <Star size={16} fill={puzzle.isFavorite ? "currentColor" : "none"} />
                                                                </button>

                                                                {/* Moving panel (Only in Playlist viewMode) */}
                                                                {viewMode === 'playlists' && (
                                                                    movingPuzzleId === puzzle.id ? (
                                                                        <div className="flex items-center gap-1.5 bg-chess-bg/90 border border-white/10 rounded-lg px-3 py-1.5 shrink-0 backdrop-blur-md">
                                                                            <span className="text-[10px] uppercase font-bold text-chess-text-secondary mr-1">Move to:</span>
                                                                            {groups.filter(g => g.playlistIndex !== puzzle.playlistIndex && g.puzzles.length < 20).map(g => (
                                                                                <button
                                                                                    key={g.playlistIndex}
                                                                                    onClick={() => handleMovePuzzle(puzzle.id, g.playlistIndex)}
                                                                                    disabled={movingState}
                                                                                    className="text-xs bg-white/5 hover:bg-chess-accent hover:text-white px-2.5 py-1 rounded-md transition-all text-white font-medium disabled:opacity-50 whitespace-nowrap"
                                                                                    title={`${g.title} (${g.puzzles.length}/20)`}
                                                                                >
                                                                                    {g.title}
                                                                                </button>
                                                                            ))}
                                                                            {groups.filter(g => g.playlistIndex !== puzzle.playlistIndex && g.puzzles.length < 20).length === 0 && (
                                                                                <span className="text-[10px] text-red-400 italic">No playlists with space</span>
                                                                            )}
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

                        {/* Permanent Favorites Card */}
                        {viewMode === 'playlists' && (
                            <div
                                id="favorites-card"
                                className={`bg-chess-panel border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 ${
                                    expandedGroups['favorites'] ? 'ring-1 ring-chess-accent/30 shadow-2xl' : 'hover:border-white/10'
                                }`}
                            >
                                {/* Favorites Header */}
                                <div
                                    onClick={() => toggleGroup('favorites')}
                                    className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                                >
                                    <div className="flex gap-4 items-start sm:items-center flex-1 min-w-0">
                                        {/* Icon */}
                                        <div className="w-12 h-12 bg-yellow-400/10 border border-yellow-400/25 text-yellow-400 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                                            <Star size={24} fill="currentColor" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                <h3 className="text-xl font-bold text-white truncate max-w-[220px] sm:max-w-[360px]">
                                                    Favorites
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-chess-text-secondary mt-1 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Star size={14} /> {favPuzzles.length}/10 puzzles
                                                </span>
                                                {(isFiltering || filteredFavPuzzles.length !== favPuzzles.length) && (
                                                    <span className="text-chess-accent">({filteredFavPuzzles.length} match filters)</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Gauges and Collapsible Indicators */}
                                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-white/5 pt-4 sm:pt-0 sm:border-0 shrink-0">
                                        {favPuzzles.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTrainPlaylist({ playlistIndex: 'favorites' });
                                                }}
                                                className="px-4 py-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-extrabold text-xs shadow-lg shadow-chess-accent/15 transition-all flex items-center gap-1.5 hover:-translate-y-0.5 active:scale-95 cursor-pointer shrink-0"
                                                title="Start training favorites"
                                            >
                                                <Play size={14} fill="currentColor" /> Train Favorites
                                            </button>
                                        )}
                                        <div className="flex items-center gap-6">
                                            <CircularGauge
                                                percentage={favPuzzles.length > 0 ? Math.round((favPuzzles.filter(p => p.reviewState?.isSolved).length / favPuzzles.length) * 100) : 0}
                                                color="stroke-yellow-400"
                                                title="Mastery"
                                                subtitle={`${favPuzzles.filter(p => p.reviewState?.isSolved).length}/${favPuzzles.length} Solved`}
                                            />
                                        </div>
                                        <div className="text-chess-text-secondary hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors">
                                            {expandedGroups['favorites'] ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Puzzles List */}
                                {expandedGroups['favorites'] && (
                                    <div className="border-t border-white/5 bg-black/10 transition-all duration-300">
                                        <div className="p-4 space-y-3">
                                            {favPuzzles.length === 0 ? (
                                                <div className="p-8 text-center text-chess-text-secondary bg-chess-panel/10 rounded-xl flex flex-col items-center justify-center gap-2">
                                                    <Star size={32} className="opacity-30 mb-1" />
                                                    <p className="font-bold text-sm text-white/85">Your Favorites Set is Empty</p>
                                                    <p className="text-xs max-w-sm">Star some puzzles from your playlists or training arena to add them here!</p>
                                                </div>
                                            ) : filteredFavPuzzles.length === 0 ? (
                                                <div className="p-6 text-center text-chess-text-secondary bg-chess-panel/10 rounded-xl">
                                                    No puzzles match the search/filters inside this section.
                                                </div>
                                            ) : (
                                                filteredFavPuzzles.map((puzzle) => (
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
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(puzzle.id); }}
                                                                        className="flex-1 bg-chess-bg border border-chess-accent focus:ring-0 text-white px-3 py-1 rounded text-sm placeholder:text-chess-text-secondary focus:outline-none"
                                                                        placeholder="Custom puzzle name"
                                                                        disabled={renaming}
                                                                        autoFocus
                                                                    />
                                                                    <button
                                                                        onClick={() => handleSaveRename(puzzle.id)}
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
                                                                    {puzzle.status === 'new' && (
                                                                        <span className="text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse shrink-0">
                                                                            NEW
                                                                        </span>
                                                                    )}
                                                                    {puzzle.userColor === 'white' ? (
                                                                        <span className="bg-white/10 text-white border border-white/20 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-white" /> White
                                                                        </span>
                                                                    ) : (
                                                                        <span className="bg-black/40 text-slate-300 border border-white/5 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 shrink-0">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Black
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

                                                        {/* Interactive controls & Status Badge & Train Action */}
                                                        <div className="flex flex-wrap items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-0 border-white/5 pt-3 md:pt-0">
                                                            {/* Star favorite toggle */}
                                                            <button
                                                                onClick={() => handleToggleFavorite(puzzle, 'favorites')}
                                                                className="p-1.5 rounded-lg transition-all text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20"
                                                                title="Remove from Favorites"
                                                            >
                                                                <Star size={16} fill="currentColor" />
                                                            </button>

                                                            {/* Delete Puzzle */}
                                                            <button
                                                                onClick={() => handleDeletePuzzle(puzzle.id, 'favorites')}
                                                                className="text-chess-text-secondary hover:text-red-405 p-1 rounded hover:bg-white/5 transition-all"
                                                                title="Delete Puzzle"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>


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
                        )}
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

                {/* Create Playlist Modal */}
                {showCreateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setShowCreateModal(false)} />

                        {/* Modal Card */}
                        <div className="bg-chess-panel border border-chess-accent/30 max-w-md w-full rounded-2xl shadow-2xl p-8 relative overflow-hidden z-10">
                            <div className="absolute inset-0 bg-gradient-to-br from-chess-accent/5 to-transparent pointer-events-none" />

                            <div className="flex items-center gap-3 text-chess-accent mb-6">
                                <div className="w-12 h-12 bg-chess-accent/15 border border-chess-accent/25 rounded-xl flex items-center justify-center">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold font-serif text-white">Create New Playlist</h3>
                                    <p className="text-xs text-chess-text-secondary">Name your training deck (max 3 playlists)</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="text-xs font-bold text-chess-text-secondary uppercase tracking-wider block mb-2">Playlist Name</label>
                                <input
                                    type="text"
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmCreatePlaylist(); }}
                                    placeholder="e.g. Sicilian Blunders"
                                    className="w-full px-4 py-3 bg-chess-bg border border-white/10 rounded-xl text-white placeholder:text-chess-text-secondary focus:outline-none focus:border-chess-accent transition-colors text-sm"
                                    autoFocus
                                    maxLength={40}
                                />
                                <p className="text-[10px] text-chess-text-secondary mt-2">Choose a descriptive name for your new training playlist.</p>
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={creatingPlaylist}
                                    className="px-4 py-2.5 text-sm text-chess-text-secondary hover:text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmCreatePlaylist}
                                    disabled={creatingPlaylist || !newPlaylistName.trim()}
                                    className="px-6 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-chess-accent/15 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {creatingPlaylist ? (
                                        <><Loader2 className="animate-spin" size={14} /> Creating...</>
                                    ) : (
                                        <><Plus size={14} /> Create Playlist</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Playlist Deletion Overlay Warning Modal */}
                {playlistToDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer" onClick={() => setPlaylistToDelete(null)} />

                        {/* Modal Card */}
                        <div className="bg-chess-panel border border-red-500/30 max-w-md w-full rounded-2xl shadow-2xl p-6 relative overflow-hidden z-10">
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

            </div>
            
            {/* Themed Confirm Dialog */}
            <ThemedDialog
                open={confirmConfig.show}
                title={confirmConfig.title}
                message={confirmConfig.message}
                type={confirmConfig.type}
                onConfirm={confirmConfig.onConfirm}
                onCancel={confirmConfig.onCancel}
            />
        </DashboardLayout>
    );
}
