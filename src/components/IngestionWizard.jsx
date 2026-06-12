import React, { useState, useEffect } from 'react';
import { getPendingPuzzles, saveApprovedPuzzles, clearPendingPuzzles, getUserPlaylists, createPlaylist, ignorePendingPuzzle } from '../services/puzzleService';
import { Loader2, ArrowRight, Save, X, Sparkles, ArrowLeft, EyeOff, Clock } from 'lucide-react';
import { getUserProfile } from '../services/userService';
import { getPieceImageUrl } from '../lib/pieceSets';

function MiniBoardPreview({ fen, pieceSet }) {
    if (!fen) return null;
    const rows = fen.split(' ')[0].split('/');
    const grid = [];
    
    rows.forEach((row, rIdx) => {
        let colIdx = 0;
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            if (isNaN(char)) {
                grid.push({ row: rIdx, col: colIdx, piece: char });
                colIdx++;
            } else {
                const emptyCount = parseInt(char, 10);
                for (let e = 0; e < emptyCount; e++) {
                    grid.push({ row: rIdx, col: colIdx, piece: null });
                    colIdx++;
                }
            }
        }
    });

    return (
        <div className="grid grid-cols-8 grid-rows-8 w-72 h-72 border-2 border-white/10 rounded-2xl overflow-hidden shadow-2xl mx-auto select-none bg-chess-bg shrink-0">
            {grid.map((cell, idx) => {
                const isLight = (cell.row + cell.col) % 2 === 0;
                return (
                    <div 
                        key={idx}
                        className="flex items-center justify-center transition-all duration-150 hover:opacity-90"
                        style={{ 
                            backgroundColor: isLight ? '#f0d9b5' : '#b58863'
                        }}
                    >
                        {cell.piece ? (
                            <img
                                src={getPieceImageUrl(pieceSet, cell.piece === cell.piece.toLowerCase() ? 'b' : 'w', cell.piece.toLowerCase())}
                                alt={cell.piece}
                                className="w-[85%] h-[85%] object-contain drop-shadow"
                                loading="lazy"
                            />
                        ) : ''}
                    </div>
                );
            })}
        </div>
    );
}

export default function IngestionWizard({ userId, onClose, onSaveSuccess }) {
    const [loading, setLoading] = useState(true);
    const [puzzles, setPuzzles] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playlists, setPlaylists] = useState([]);
    const [saving, setSaving] = useState(false);
    const [pieceSet, setPieceSet] = useState('cburnett');

    // Form inputs for current puzzle
    const [customName, setCustomName] = useState('');
    const [playlistIndex, setPlaylistIndex] = useState('0');

    // Track edited details for all puzzles in batch
    const [editedPuzzles, setEditedPuzzles] = useState([]);
    
    // Create new playlist states
    const [totalPlaylistsCount, setTotalPlaylistsCount] = useState(0);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [userId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const list = await getPendingPuzzles(userId);
            setPuzzles(list);
            
            // Initialize edited puzzles list
            const allPlaylists = await getUserPlaylists(userId);
            setTotalPlaylistsCount(allPlaylists.length);
            let available = allPlaylists.filter(pl => pl.total < 20).map(pl => ({
                index: pl.playlistIndex,
                title: pl.title,
                total: pl.total
            }));

            setPlaylists(available);

            // Load user profile config for piece set
            try {
                const profile = await getUserProfile(userId);
                if (profile?.settings?.pieceSet) {
                    setPieceSet(profile.settings.pieceSet);
                }
            } catch (err) {
                console.warn('Failed to load user profile settings in wizard:', err);
            }

            const defaultPlIdx = available.length > 0 ? available[0].index : 0;
            const defaultIsFav = available.length === 0;

            const initialEdited = list.map(p => ({
                ...p,
                customName: `${p.opening || p.openingName || 'Opening'} blunder`,
                playlistIndex: defaultPlIdx,
                isFavorite: defaultIsFav
            }));
            setEditedPuzzles(initialEdited);

            // Set initial dropdown value
            if (available.length > 0) {
                setPlaylistIndex(available[0].index.toString());
            } else {
                setPlaylistIndex('fav');
            }

            if (initialEdited.length > 0) {
                setCustomName(initialEdited[0].customName);
            }

        } catch (e) {
            console.error('Failed to load pending puzzles:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            // Save current edits
            const updated = [...editedPuzzles];
            const isFav = playlistIndex === 'fav';
            const targetPlIdx = isFav ? 0 : parseInt(playlistIndex, 10);
            updated[currentIndex] = {
                ...updated[currentIndex],
                customName: customName.trim(),
                playlistIndex: targetPlIdx,
                isFavorite: isFav
            };
            setEditedPuzzles(updated);

            const prevIdx = currentIndex - 1;
            setCurrentIndex(prevIdx);
            setCustomName(updated[prevIdx].customName);
            const prevVal = updated[prevIdx].isFavorite ? 'fav' : updated[prevIdx].playlistIndex.toString();
            setPlaylistIndex(prevVal);
        }
    };

    const handleIgnoreCurrent = async () => {
        const puzzleToIgnore = puzzles[currentIndex];
        if (!puzzleToIgnore) return;
        
        const gameId = puzzleToIgnore.gameId;
        setSaving(true);
        try {
            // Remove the puzzle from Firestore and clean up processed game entry
            const updatedPuzzles = await ignorePendingPuzzle(userId, gameId, puzzles, currentIndex);
            
            // Remove from edited puzzles list
            const newEdited = editedPuzzles.filter((_, idx) => idx !== currentIndex);
            
            if (updatedPuzzles.length === 0) {
                setPuzzles([]);
                setEditedPuzzles([]);
                if (onSaveSuccess) onSaveSuccess(0);
                onClose();
            } else {
                setPuzzles(updatedPuzzles);
                setEditedPuzzles(newEdited);
                
                // Adjust index
                const nextIndex = currentIndex >= updatedPuzzles.length ? updatedPuzzles.length - 1 : currentIndex;
                setCurrentIndex(nextIndex);
                setCustomName(newEdited[nextIndex].customName);
                const nextVal = newEdited[nextIndex].isFavorite ? 'fav' : newEdited[nextIndex].playlistIndex.toString();
                setPlaylistIndex(nextVal);
            }
        } catch (err) {
            console.error('Failed to ignore puzzle:', err);
            alert('Failed to ignore puzzle. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        let finalPlIdx = playlistIndex;
        const isFav = playlistIndex === 'fav';

        if (playlistIndex === 'create_new') {
            if (!newPlaylistName.trim()) {
                alert('Please enter a name for the new playlist.');
                return;
            }
            setSaving(true);
            try {
                const newIdx = await createPlaylist(userId, newPlaylistName);
                finalPlIdx = newIdx.toString();
                setNewPlaylistName('');
                
                // Refresh playlists list
                const allPlaylists = await getUserPlaylists(userId);
                setTotalPlaylistsCount(allPlaylists.length);
                let available = allPlaylists.filter(pl => pl.total < 20).map(pl => ({
                    index: pl.playlistIndex,
                    title: pl.title,
                    total: pl.total
                }));
                setPlaylists(available);
                setPlaylistIndex(finalPlIdx);
            } catch (err) {
                console.error('Failed to create playlist:', err);
                alert('Failed to create playlist. Please try again.');
                setSaving(false);
                return;
            } finally {
                setSaving(false);
            }
        }

        const targetPlIdx = isFav ? 0 : parseInt(finalPlIdx, 10);

        // Save current edits
        const updated = [...editedPuzzles];
        updated[currentIndex] = {
            ...updated[currentIndex],
            customName: customName.trim(),
            playlistIndex: targetPlIdx,
            isFavorite: isFav
        };
        setEditedPuzzles(updated);

        // Move forward or finish
        if (currentIndex < puzzles.length - 1) {
            const nextIdx = currentIndex + 1;
            setCurrentIndex(nextIdx);
            setCustomName(updated[nextIdx].customName);
            const nextVal = updated[nextIdx].isFavorite ? 'fav' : updated[nextIdx].playlistIndex.toString();
            setPlaylistIndex(nextVal);
        } else {
            // Save all!
            saveAll(updated);
        }
    };

    const saveAll = async (finalData) => {
        setSaving(true);
        try {
            await saveApprovedPuzzles(userId, finalData);
            await clearPendingPuzzles(userId);
            if (onSaveSuccess) onSaveSuccess(finalData.length);
            onClose();
        } catch (e) {
            console.error('Failed to save puzzles in batch:', e);
            alert('Failed to save puzzles. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-100">
                <div className="bg-chess-panel border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin text-chess-accent" />
                    <p className="text-chess-text-secondary text-sm font-semibold">Loading blunder wizard...</p>
                </div>
            </div>
        );
    }

    if (puzzles.length === 0) {
        return null;
    }

    const currentPuzzle = puzzles[currentIndex];

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md cursor-pointer animate-in fade-in duration-200" onClick={onClose} />
            
            {/* Modal Card */}
            <div className="relative w-full max-w-3xl bg-chess-panel/95 border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col gap-6 z-10">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-chess-accent/15 border border-chess-accent/20 flex items-center justify-center text-chess-accent shadow-lg shadow-chess-accent/5">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-serif font-bold text-white tracking-wide">Blunder Ingestion Wizard</h3>
                            <p className="text-xs text-chess-text-secondary">Puzzle {currentIndex + 1} of {puzzles.length}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-chess-text-secondary hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Progress dot indicators */}
                <div className="flex gap-1.5 justify-center w-full">
                    {puzzles.map((_, idx) => (
                        <div 
                            key={idx}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                idx === currentIndex 
                                    ? 'w-8 bg-chess-accent' 
                                    : idx < currentIndex 
                                        ? 'w-2.5 bg-emerald-500' 
                                        : 'w-2.5 bg-white/10'
                            }`}
                        />
                    ))}
                </div>

                {/* Body split: Mini Board Preview + Info Form */}
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">
                    
                    {/* Visual Board Sneak Peak */}
                    <div className="flex flex-col gap-3 items-center shrink-0">
                        <MiniBoardPreview fen={currentPuzzle.fen} pieceSet={pieceSet} />
                        <span className="text-[10px] uppercase font-bold tracking-wider text-chess-text-secondary">
                            {currentPuzzle.playerColor || currentPuzzle.color || currentPuzzle.userColor || 'white'} board preview
                        </span>
                    </div>

                    {/* Inputs */}
                    <div className="flex-1 w-full flex flex-col justify-start py-1 space-y-4">
                        <div className="space-y-1">
                            <p className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">FEN Source Location</p>
                            <p className="text-base font-bold text-white truncate max-w-[320px]" title={currentPuzzle.opening || currentPuzzle.openingName}>
                                {currentPuzzle.opening || currentPuzzle.openingName || 'Unknown Opening'}
                            </p>
                            {currentPuzzle.rating && (
                                <p className="text-xs text-chess-text-secondary mt-0.5">Opponent Rating: {currentPuzzle.rating}</p>
                            )}
                        </div>

                        {/* Title input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Custom Name</label>
                            <input
                                type="text"
                                value={customName}
                                onChange={(e) => setCustomName(e.target.value)}
                                className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-3 px-4 text-white focus:outline-none transition-colors"
                            />
                        </div>

                        {/* Playlist select */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">Target Destination</label>
                            <select
                                value={playlistIndex}
                                onChange={(e) => setPlaylistIndex(e.target.value)}
                                className="w-full bg-chess-bg border border-white/10 rounded-xl text-xs py-2.5 px-3 text-white focus:outline-none focus:border-chess-accent cursor-pointer"
                            >
                                {playlists.map(pl => (
                                    <option key={pl.index} value={pl.index.toString()}>
                                        {pl.title} ({pl.total}/20)
                                    </option>
                                ))}
                                {totalPlaylistsCount < 3 && (
                                    <option value="create_new">➕ Create New Playlist...</option>
                                )}
                                <option value="fav">⭐ Starred / Favorites (Max 10)</option>
                            </select>

                            {playlistIndex === 'create_new' && (
                                <div className="space-y-1.5 mt-2 animate-in slide-in-from-top-1 duration-200">
                                    <label className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider block">New Playlist Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter playlist name..."
                                        value={newPlaylistName}
                                        onChange={(e) => setNewPlaylistName(e.target.value)}
                                        className="w-full bg-chess-bg border border-white/10 focus:border-chess-accent rounded-xl text-xs py-2.5 px-3 text-white focus:outline-none transition-colors"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Footer buttons */}
                <div className="flex gap-2.5 pt-4 border-t border-white/5 w-full justify-between">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-chess-text-secondary hover:text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <Clock size={14} />
                        Save Later
                    </button>

                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0 || saving}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 border border-white/10 text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                    >
                        <ArrowLeft size={14} />
                        Previous
                    </button>
                    
                    <button
                        onClick={handleIgnoreCurrent}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <EyeOff size={14} />
                        Ignore
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={saving}
                        className="flex-1 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                {currentIndex === puzzles.length - 1 ? (
                                    <>
                                        <Save size={14} />
                                        Finish & Save
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight size={14} />
                                    </>
                                )}
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
