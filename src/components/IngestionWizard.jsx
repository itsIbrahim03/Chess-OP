import React, { useState, useEffect } from 'react';
import { getPendingPuzzles, getUserPlaylists, createPlaylist, ignorePendingPuzzle, approvePendingPuzzle, getFavoritePuzzles } from '../services/puzzleService';
import { Loader2, ArrowRight, Save, X, Sparkles, EyeOff, Clock } from 'lucide-react';
import { getUserProfile } from '../services/userService';
import { getPieceImageUrl } from '../lib/pieceSets';
import ThemedDialog from './ThemedDialog';

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
    const [playlists, setPlaylists] = useState([]);
    const [saving, setSaving] = useState(false);
    const [pieceSet, setPieceSet] = useState('cburnett');
    const [favsCount, setFavsCount] = useState(0);

    // Initial total count of puzzles for progress indicator
    const [initialTotalCount, setInitialTotalCount] = useState(0);

    // Form inputs for current puzzle
    const [customName, setCustomName] = useState('');
    const [playlistIndex, setPlaylistIndex] = useState('fav');

    // Create new playlist states
    const [totalPlaylistsCount, setTotalPlaylistsCount] = useState(0);
    const [newPlaylistName, setNewPlaylistName] = useState('');

    // Themed Alert Modal State
    const [alertConfig, setAlertConfig] = useState({
        show: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (message, type = 'info', title = '') => {
        setAlertConfig({ show: true, message, type, title });
    };

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
            setInitialTotalCount(list.length);
            
            // Get user's playlists
            const allPlaylists = await getUserPlaylists(userId);
            setTotalPlaylistsCount(allPlaylists.length);
            
            // Map all playlists (we will show full ones as disabled in the dropdown)
            const mappedPlaylists = allPlaylists.map(pl => ({
                index: pl.playlistIndex,
                title: pl.title,
                total: pl.total
            }));
            setPlaylists(mappedPlaylists);

            // Get favorites count
            const favs = await getFavoritePuzzles(userId);
            setFavsCount(favs.length);

            // Load user profile config for piece set
            try {
                const profile = await getUserProfile(userId);
                if (profile?.settings?.pieceSet) {
                    setPieceSet(profile.settings.pieceSet);
                }
            } catch (err) {
                console.warn('Failed to load user profile settings in wizard:', err);
            }

            // Set default destination for the first puzzle
            // - first non-full playlist, or 'fav' if 0 playlists exist (or all are full)
            let defaultVal = 'fav';
            const firstNonFull = mappedPlaylists.find(pl => pl.total < 20);
            if (firstNonFull) {
                defaultVal = firstNonFull.index.toString();
            } else if (favs.length >= 10) {
                defaultVal = 'create_new';
            }
            setPlaylistIndex(defaultVal);

            if (list.length > 0) {
                setCustomName(`${list[0].opening || list[0].openingName || 'Opening'} blunder`);
            }
        } catch (e) {
            console.error('Failed to load pending puzzles:', e);
        } finally {
            setLoading(false);
        }
    };

    const determineDefaultDestination = (allPlaylists, lastSelectedIdx, currentFavsCount) => {
        if (lastSelectedIdx !== null && lastSelectedIdx !== 'fav' && lastSelectedIdx !== 'create_new') {
            const lastPl = allPlaylists.find(pl => pl.index.toString() === lastSelectedIdx.toString());
            // Only select it if it's still not full
            if (lastPl && lastPl.total < 20) {
                return lastSelectedIdx.toString();
            }
        }
        // Default to the first non-full playlist
        const firstNonFull = allPlaylists.find(pl => pl.total < 20);
        if (firstNonFull) {
            return firstNonFull.index.toString();
        }
        // If all playlists are full, check favorites set
        if (currentFavsCount < 10) {
            return 'fav';
        }
        // If favorites is ALSO full, default to 'create_new'
        return 'create_new';
    };

    const handleIgnoreCurrent = async () => {
        if (puzzles.length === 0 || saving) return;
        const currentPuzzle = puzzles[0];
        const gameId = currentPuzzle.gameId;
        
        setSaving(true);
        try {
            // Remove the puzzle from Firestore and clean up processed game entry
            const updatedPuzzles = await ignorePendingPuzzle(userId, gameId, puzzles, 0);
            
            if (updatedPuzzles.length === 0) {
                setPuzzles([]);
                if (onSaveSuccess) onSaveSuccess(1);
                onClose();
            } else {
                setPuzzles(updatedPuzzles);
                // Load details of the next puzzle (which is now at index 0)
                const nextPuzzle = updatedPuzzles[0];
                setCustomName(`${nextPuzzle.opening || nextPuzzle.openingName || 'Opening'} blunder`);
                
                // Set default destination for the next puzzle
                const nextDefault = determineDefaultDestination(playlists, playlistIndex, favsCount);
                setPlaylistIndex(nextDefault);
            }
        } catch (err) {
            console.error('Failed to ignore puzzle:', err);
            showAlert('Failed to ignore puzzle. Please try again.', 'error', 'Error');
        } finally {
            setSaving(false);
        }
    };

    const handleNext = async () => {
        if (puzzles.length === 0 || saving) return;
        
        let finalPlIdx = playlistIndex;
        const isFav = playlistIndex === 'fav';

        if (isFav && favsCount >= 10) {
            showAlert('Favorites limit reached! Maximum 10 starred puzzles allowed.', 'warning', 'Limit Reached');
            return;
        }

        if (!isFav && playlistIndex !== 'create_new') {
            const targetPl = playlists.find(pl => pl.index.toString() === finalPlIdx.toString());
            if (targetPl && targetPl.total >= 20) {
                showAlert('Selected playlist is full (max 20 puzzles).', 'warning', 'Playlist Full');
                return;
            }
        }

        // 1. Handle playlist creation if requested
        if (playlistIndex === 'create_new') {
            if (!newPlaylistName.trim()) {
                showAlert('Please enter a name for the new playlist.', 'warning', 'Name Required');
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
                const mappedPlaylists = allPlaylists.map(pl => ({
                    index: pl.playlistIndex,
                    title: pl.title,
                    total: pl.total
                }));
                setPlaylists(mappedPlaylists);
                setPlaylistIndex(finalPlIdx);
            } catch (err) {
                console.error('Failed to create playlist:', err);
                showAlert('Failed to create playlist. Please try again.', 'error', 'Error');
                setSaving(false);
                return;
            }
        }

        const targetPlIdx = isFav ? 0 : parseInt(finalPlIdx, 10);

        // 2. Prepare current puzzle data to save
        const currentPuzzle = puzzles[0];
        const puzzleToSave = {
            ...currentPuzzle,
            customName: customName.trim(),
            playlistIndex: targetPlIdx,
            isFavorite: isFav
        };

        setSaving(true);
        try {
            // Save instantly and remove from pending Scan list in Firestore
            const { puzzles: updatedPuzzles } = await approvePendingPuzzle(userId, puzzleToSave, puzzles, 0);

            // Dispatch global event to notify active pages (like AnalysisBoard) to update counts
            window.dispatchEvent(new CustomEvent('repertoire-updated'));

            // Fetch the updated playlists and favorites counts from Firestore
            const allPlaylists = await getUserPlaylists(userId);
            setTotalPlaylistsCount(allPlaylists.length);
            const mappedPlaylists = allPlaylists.map(pl => ({
                index: pl.playlistIndex,
                title: pl.title,
                total: pl.total
            }));
            setPlaylists(mappedPlaylists);

            const favs = await getFavoritePuzzles(userId);
            setFavsCount(favs.length);

            if (updatedPuzzles.length === 0) {
                setPuzzles([]);
                if (onSaveSuccess) onSaveSuccess(1);
                onClose();
            } else {
                setPuzzles(updatedPuzzles);
                // Load details of the next puzzle (which is now at index 0)
                const nextPuzzle = updatedPuzzles[0];
                setCustomName(`${nextPuzzle.opening || nextPuzzle.openingName || 'Opening'} blunder`);
                
                // Set default destination for the next puzzle
                // If the playlist we just saved to is still available (has < 20 puzzles), keep it selected!
                // Otherwise, fall back to the next available playlist or favorites.
                const nextDefault = determineDefaultDestination(mappedPlaylists, finalPlIdx, favs.length);
                setPlaylistIndex(nextDefault);
            }
        } catch (err) {
            console.error('Failed to save approved puzzle:', err);
            if (err.message === 'FAVORITES_LIMIT_EXCEEDED') {
                showAlert('Favorites limit reached! Maximum 10 starred puzzles allowed.', 'warning', 'Limit Reached');
            } else if (err.message === 'REPERTOIRE_LIMIT_EXCEEDED') {
                showAlert('Repertoire capacity reached! Your repertoire already has 70 puzzles. Clear some puzzles to save new ones.', 'warning', 'Repertoire Full');
            } else {
                showAlert('Failed to save puzzle. Please try again.', 'error', 'Error');
            }
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

    const currentPuzzle = puzzles[0];

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
                            <p className="text-xs text-chess-text-secondary">
                                Puzzle {initialTotalCount - puzzles.length + 1} of {initialTotalCount}
                            </p>
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
                    {Array.from({ length: initialTotalCount }).map((_, idx) => {
                        const currentProcessedCount = initialTotalCount - puzzles.length;
                        return (
                            <div 
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                    idx === currentProcessedCount 
                                        ? 'w-8 bg-chess-accent' 
                                        : idx < currentProcessedCount 
                                            ? 'w-2.5 bg-emerald-500' 
                                            : 'w-2.5 bg-white/10'
                                }`}
                            />
                        );
                    })}
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
                                    <option 
                                        key={pl.index} 
                                        value={pl.index.toString()}
                                        disabled={pl.total >= 20}
                                        className={pl.total >= 20 ? 'text-white/30' : ''}
                                    >
                                        {pl.title} {pl.total >= 20 ? '(Full - 20/20)' : `(${pl.total}/20)`}
                                    </option>
                                ))}
                                {totalPlaylistsCount < 3 && (
                                    <option value="create_new">➕ Create New Playlist...</option>
                                )}
                                <option value="fav" disabled={favsCount >= 10}>
                                    ⭐ Starred / Favorites ({favsCount}/10)
                                </option>
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
                                {puzzles.length === 1 ? (
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

            {/* Themed Alert Modal */}
            <ThemedDialog
                open={alertConfig.show}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, show: false }))}
            />
        </div>
    );
}
