import React, { useState, useEffect, useRef, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import {
    User, UserPlus, UserMinus, Palette, Save, Trash2, AlertTriangle, CheckCircle2,
    XCircle, Loader2, Globe, Sparkles, Crown, Shield, Flag, Upload
} from 'lucide-react';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import {
    getUserProfile, linkLichessAccount, updateUserSettings,
    updateUserProfile, verifyLichessUsername, clearAllAccountData,
    disconnectLichessAccount
} from '../services/userService';
import { BOARD_THEMES } from '../lib/boardThemes';
import { PIECE_SETS } from '../lib/pieceSets';
import { COUNTRIES } from '../lib/countries';
import { translateError } from '../lib/errorTranslator';


// ─── Constants ──────────────────────────────────────────────────────────
const CHESS_FLAIRS = [
    { id: 'none', emoji: '', label: 'None' },
    { id: 'king', emoji: '♔', label: 'King' },
    { id: 'queen', emoji: '♛', label: 'Queen' },
    { id: 'knight', emoji: '♞', label: 'Knight' },
    { id: 'rook', emoji: '♜', label: 'Rook' },
    { id: 'bishop', emoji: '♝', label: 'Bishop' },
    { id: 'pawn', emoji: '♟', label: 'Pawn' },
    { id: 'trophy', emoji: '🏆', label: 'Champion' },
    { id: 'lightning', emoji: '⚡', label: 'Blitz King' },
    { id: 'fire', emoji: '🔥', label: 'On Fire' },
    { id: 'brain', emoji: '🧠', label: 'Strategist' },
    { id: 'target', emoji: '🎯', label: 'Sniper' },
    { id: 'star', emoji: '⭐', label: 'Star' },
    { id: 'diamond', emoji: '💎', label: 'Diamond' },
    { id: 'rocket', emoji: '🚀', label: 'Rising' },
    { id: 'shield', emoji: '🛡️', label: 'Defender' },
];

const COUNTRIES_WITH_PLACEHOLDER = [
    { code: '', name: 'Select Country', flag: '' },
    ...COUNTRIES
];


// ─── Lichess Verification Hook ──────────────────────────────────────────
function useLichessVerification() {
    const [verifyState, setVerifyState] = useState('idle'); // idle | loading | valid | invalid
    const [verifyProfile, setVerifyProfile] = useState(null);
    const debounceTimer = useRef(null);

    const verify = useCallback((username) => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (!username || !username.trim()) {
            setVerifyState('idle');
            setVerifyProfile(null);
            return;
        }

        setVerifyState('loading');
        debounceTimer.current = setTimeout(async () => {
            try {
                const result = await verifyLichessUsername(username);
                setVerifyState(result.valid ? 'valid' : 'invalid');
                setVerifyProfile(result.valid ? result.profile : null);
            } catch {
                setVerifyState('invalid');
                setVerifyProfile(null);
            }
        }, 500);
    }, []);

    const reset = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setVerifyState('idle');
        setVerifyProfile(null);
    }, []);

    return { verifyState, verifyProfile, verify, reset };
}

// ─── Mini Board Preview Component ───────────────────────────────────────
function MiniBoardPreview({ theme, selected, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                selected
                    ? 'border-chess-accent bg-chess-accent/10 shadow-lg shadow-chess-accent/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
            }`}
        >
            <div className="grid grid-cols-4 grid-rows-4 w-20 h-20 rounded-md overflow-hidden shadow-inner">
                {Array.from({ length: 16 }).map((_, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const isLight = (row + col) % 2 === 0;
                    return (
                        <div
                            key={i}
                            style={{ backgroundColor: isLight ? theme.lightSquare : theme.darkSquare }}
                        />
                    );
                })}
            </div>
            <span className={`text-xs font-bold ${selected ? 'text-chess-accent' : 'text-chess-text-secondary'}`}>
                {theme.name}
            </span>
        </button>
    );
}

// ─── Piece Set Preview Component ────────────────────────────────────────
function PieceSetPreview({ pieceSet, selected, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:scale-105 w-full ${
                selected
                    ? 'border-chess-accent bg-chess-accent/10 shadow-lg shadow-chess-accent/25'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/5'
            }`}
        >
            <div className="flex gap-3 justify-center items-center py-2 h-14">
                <img
                    src={pieceSet.pieces.w.k}
                    alt="White King"
                    className="w-12 h-12 object-contain drop-shadow"
                    loading="lazy"
                />
                <img
                    src={pieceSet.pieces.b.k}
                    alt="Black King"
                    className="w-12 h-12 object-contain drop-shadow"
                    loading="lazy"
                />
            </div>
            <span className={`text-xs font-bold ${selected ? 'text-chess-accent' : 'text-chess-text-secondary'}`}>
                {pieceSet.name}
            </span>
        </button>
    );
}

// ─── Double Confirmation Modal ──────────────────────────────────────────
function ConfirmClearModal({ open, onClose, onConfirm, clearing }) {
    const [typed, setTyped] = useState('');
    const confirmed = typed === 'RESET MY ACCOUNT';

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-chess-panel/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in">
                {/* Glow */}
                <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/20 to-brand-med/20 rounded-3xl blur-[1px] -z-10" />

                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-chess-accent" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white mb-2">Confirm Account Reset</h2>
                    <p className="text-chess-text-secondary text-sm max-w-sm">
                        This will <span className="text-chess-accent font-bold">permanently erase</span> all your local profile configurations:
                    </p>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6 text-sm text-chess-text-secondary space-y-1">
                    <p>• All generated training puzzles</p>
                    <p>• All analysed and processed games</p>
                    <p>• Custom repertoire folders and lists</p>
                    <p>• Active streaks and solve count history</p>
                    <p>• Linked Lichess username connection</p>
                    <p>• Custom settings preferences</p>
                </div>

                <div className="mb-6">
                    <label className="text-xs font-bold text-chess-text-secondary uppercase tracking-wider block mb-2">
                        Type "RESET MY ACCOUNT" to confirm
                    </label>
                    <input
                        type="text"
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && confirmed && !clearing) {
                                onConfirm();
                            }
                        }}
                        placeholder="RESET MY ACCOUNT"
                        className="w-full px-4 py-3 bg-chess-bg border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-chess-accent/50 transition-colors font-mono tracking-wider text-center"
                        autoFocus
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={clearing}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!confirmed || clearing}
                        className="flex-1 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {clearing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Resetting...
                            </>
                        ) : (
                            <>
                                <Trash2 size={16} />
                                Reset Account
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─── Main Settings Component ────────────────────────────────────────────
export default function Settings() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userProfile, setUserProfile] = useState(null);


    // Lichess
    const [lichessUsername, setLichessUsername] = useState('');
    const { verifyState, verifyProfile, verify, reset: resetVerify } = useLichessVerification();

    // Profile
    const [displayName, setDisplayName] = useState('');
    const [country, setCountry] = useState('');
    const [flair, setFlair] = useState('none');
    const [photoUrl, setPhotoUrl] = useState('');
    const fileInputRef = useRef(null);

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 800 * 1024) { // Limit size to 800KB
            setMessage({ type: 'error', text: 'Image size must be under 800KB' });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setPhotoUrl(reader.result);
        };
        reader.readAsDataURL(file);
    };

    // Settings
    const [settings, setSettings] = useState({
        minElo: 1500,
        boardTheme: 'classic',
        pieceSet: 'cburnett',
        showCoordinates: true,
        autoNext: false,
        engineDepth: 14
    });

    // Messages (wired to modern Toast)
    const [toast, setToast] = useState({ message: '', type: 'success' });
    const setMessage = useCallback(({ type, text }) => {
        setToast({ message: text, type });
    }, []);

    // Account clear modal
    const [clearModalOpen, setClearModalOpen] = useState(false);
    const [clearing, setClearing] = useState(false);

    useEffect(() => {
        loadUserProfile();
    }, [user]);

    const loadUserProfile = async () => {
        try {
            const profile = await getUserProfile(user.uid);
            setUserProfile(profile);
            setLichessUsername(profile.lichessUsername || '');
            setDisplayName(profile.displayName || user?.displayName || 'Player');
            setCountry(profile.country || '');
            setFlair(profile.flair || 'none');
            setPhotoUrl(profile.photoUrl || user?.photoURL || '');
            setSettings({
                minElo: profile.settings?.minElo || 1500,
                boardTheme: profile.settings?.boardTheme || 'classic',
                pieceSet: profile.settings?.pieceSet || 'cburnett',
                showCoordinates: profile.settings?.showCoordinates ?? true,
                autoNext: profile.settings?.autoNext ?? false,
                engineDepth: profile.settings?.engineDepth || 14
            });

            // Verify existing Lichess username on load
            if (profile.lichessUsername) {
                verify(profile.lichessUsername);
            }
        } catch (error) {
            setMessage({ type: 'error', text: translateError(error) });
        } finally {
            setLoading(false);
        }
    };

    const handleLichessChange = (e) => {
        const val = e.target.value;
        setLichessUsername(val);
        verify(val);
    };

    const handleLinkLichess = async () => {
        if (!lichessUsername.trim()) {
            setMessage({ type: 'error', text: 'Please enter a Lichess username' });
            return;
        }
        if (verifyState === 'invalid') {
            setMessage({ type: 'error', text: 'This Lichess username does not exist' });
            return;
        }

        setSaving(true);
        try {
            await linkLichessAccount(user.uid, lichessUsername);
            setMessage({ type: 'success', text: 'Lichess account linked successfully!' });
            await loadUserProfile();
        } catch (error) {
            setMessage({ type: 'error', text: translateError(error) });
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnectLichess = async () => {
        setSaving(true);
        try {
            await disconnectLichessAccount(user.uid);
            setLichessUsername('');
            resetVerify();
            setMessage({ type: 'success', text: 'Lichess account disconnected successfully.' });
            await loadUserProfile();
        } catch (error) {
            setMessage({ type: 'error', text: translateError(error) });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!displayName.trim()) {
            setMessage({ type: 'error', text: 'Display name cannot be blank' });
            return;
        }
        setSaving(true);
        try {
            await updateUserProfile(user.uid, {
                displayName: displayName.trim(),
                country,
                flair,
                photoUrl: photoUrl.trim()
            });
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            await loadUserProfile();
        } catch (error) {
            setMessage({ type: 'error', text: translateError(error) });
        } finally {
            setSaving(false);
        }
    };

    const handleAutoSaveSettings = async (updatedSettings) => {
        try {
            await updateUserSettings(user.uid, updatedSettings);
            setMessage({ type: 'success', text: 'Preferences saved' });
        } catch (error) {
            setMessage({ type: 'error', text: translateError(error) });
        }
    };

    const handleClearAllData = async () => {
        setClearing(true);
        try {
            const result = await clearAllAccountData(user.uid);
            
            // Clear client-side sessionStorage and custom localStorage keys
            sessionStorage.clear();
            localStorage.removeItem('sidebarOpen');
            localStorage.removeItem('chess-op-remember-me');

            setClearModalOpen(false);
            setMessage({
                type: 'success',
                text: `Account cleared! Deleted ${result.deletedPuzzles} puzzles and ${result.deletedGames} games. All settings have been reset.`
            });
            await loadUserProfile();
        } catch (e) {
            setMessage({ type: 'error', text: translateError(e) });
        } finally {
            setClearing(false);
        }
    };

    // Auto-clear message after 5 seconds
    // Clean up timer removed (Toast handles auto-dismiss)



    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-chess-accent" size={32} />
                        <p className="text-chess-text-secondary">Loading settings...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }




    return (
        <DashboardLayout>
            <div className="max-w-4xl pb-12">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-2xl font-serif font-bold text-white mb-2">User Profile & Preferences</h2>
                    <p className="text-chess-text-secondary">Manage your account, preferences, and board customization</p>
                </div>



                {/* ─── 1. Lichess Account Section ─────────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Globe className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Lichess Connection</h2>
                    </div>

                    {userProfile?.lichessUsername ? (
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-xl gap-4">
                            <div>
                                <p className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider mb-1">CONNECTED LICHESS ACCOUNT</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-lg font-bold text-chess-accent">{userProfile.lichessUsername}</p>
                                    <span className="text-[10px] bg-chess-status-success/10 border border-chess-status-success/20 text-chess-status-success px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Connected
                                    </span>
                                </div>
                                <p className="text-xs text-chess-text-secondary mt-1">
                                    Linked {userProfile.lichessConnectedAt ? new Date(userProfile.lichessConnectedAt.toDate()).toLocaleDateString() : 'recently'}
                                </p>
                            </div>
                            <button
                                onClick={handleDisconnectLichess}
                                disabled={saving}
                                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Disconnecting...
                                    </>
                                ) : (
                                    <>
                                        <UserMinus size={14} />
                                        Disconnect Account
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-4 p-4 bg-chess-status-warning/10 border border-chess-status-warning/30 rounded-lg">
                                <p className="text-chess-status-warning text-sm">
                                    ⚠️ No Lichess account linked. Link your account to analyse games and generate training puzzles.
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1 relative">
                                    <label htmlFor="lichessUsername" className="sr-only">Lichess Username</label>
                                    <input
                                        id="lichessUsername"
                                        name="lichessUsername"
                                        type="text"
                                        value={lichessUsername}
                                        onChange={handleLichessChange}
                                        placeholder="Enter Lichess username"
                                        className="w-full px-4 py-2 pr-10 bg-chess-bg border border-white/10 rounded-lg text-white placeholder:text-chess-text-secondary focus:outline-none focus:border-chess-accent transition-colors"
                                    />
                                    {/* Verification Icon */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {verifyState === 'loading' && (
                                            <Loader2 size={18} className="animate-spin text-chess-text-secondary" />
                                        )}
                                        {verifyState === 'valid' && (
                                            <CheckCircle2 size={18} className="text-chess-status-success" />
                                        )}
                                        {verifyState === 'invalid' && (
                                            <XCircle size={18} className="text-chess-status-error" />
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={handleLinkLichess}
                                    disabled={saving || verifyState === 'loading' || verifyState === 'invalid'}
                                    className="px-6 py-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus size={16} />
                                            Link Account
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Lichess profile info */}
                            {verifyState === 'valid' && verifyProfile && (
                                <div className="mt-3 p-3 bg-chess-status-success/5 border border-chess-status-success/20 rounded-lg text-sm">
                                    <p className="text-chess-status-success font-bold">{verifyProfile.username}</p>
                                    <p className="text-chess-text-secondary text-xs mt-0.5">
                                        {verifyProfile.count?.rated || 0} rated games • {verifyProfile.perfs?.rapid?.rating || verifyProfile.perfs?.blitz?.rating || '?'} rating
                                    </p>
                                </div>
                            )}
                            {verifyState === 'invalid' && lichessUsername.trim() && (
                                <p className="mt-2 text-chess-status-error text-xs">
                                    ✗ Username not found on Lichess
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── 2. Profile Customization ───────────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <User className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Profile Customization</h2>
                    </div>
                    <div className="space-y-6">
                        {/* Display Name */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">Display Name</label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Your display name"
                                className="w-full px-4 py-2 bg-chess-bg border border-white/10 rounded-lg text-white placeholder:text-chess-text-secondary focus:outline-none focus:border-chess-accent transition-colors"
                            />
                        </div>

                        {/* Profile Picture / Avatar */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-3">Profile Picture / Avatar</label>
                            <div className="flex flex-col gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-xl">
                                <div className="flex items-center gap-4">
                                    {photoUrl ? (
                                        <img src={photoUrl} alt="Avatar Preview" className="w-16 h-16 rounded-full border border-white/10 object-cover bg-chess-bg shrink-0" onError={(e) => { e.target.src = '/pieces/cburnett/wK.svg'; }} />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-chess-bg border border-white/10 flex items-center justify-center text-white font-bold text-xl shrink-0">
                                            {displayName[0]?.toUpperCase() || 'P'}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-bold text-white">Avatar Selection</p>
                                        <p className="text-xs text-chess-text-secondary">Choose a classic chess piece or upload a custom image</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                                    {[
                                        { id: 'king', label: 'King', url: '/pieces/cburnett/wK.svg' },
                                        { id: 'queen', label: 'Queen', url: '/pieces/cburnett/wQ.svg' },
                                        { id: 'rook', label: 'Rook', url: '/pieces/cburnett/wR.svg' },
                                        { id: 'bishop', label: 'Bishop', url: '/pieces/cburnett/wB.svg' },
                                        { id: 'knight', label: 'Knight', url: '/pieces/cburnett/wN.svg' },
                                        { id: 'pawn', label: 'Pawn', url: '/pieces/cburnett/wP.svg' },
                                    ].map(piece => {
                                        const isSelected = photoUrl === piece.url;
                                        return (
                                            <button
                                                key={piece.id}
                                                type="button"
                                                onClick={() => setPhotoUrl(piece.url)}
                                                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all ${
                                                    isSelected
                                                        ? 'border-chess-accent bg-chess-accent/10 shadow-sm'
                                                        : 'border-white/5 bg-black/20 hover:border-white/10'
                                                }`}
                                            >
                                                <img src={piece.url} alt={piece.label} className="w-8 h-8 object-contain" />
                                                <span className="text-[10px] font-semibold text-chess-text-secondary">{piece.label}</span>
                                            </button>
                                        );
                                    })}
                                    {/* Upload Button Card */}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border transition-all ${
                                            photoUrl && ![
                                                '/pieces/cburnett/wK.svg',
                                                '/pieces/cburnett/wQ.svg',
                                                '/pieces/cburnett/wR.svg',
                                                '/pieces/cburnett/wB.svg',
                                                '/pieces/cburnett/wN.svg',
                                                '/pieces/cburnett/wP.svg'
                                            ].includes(photoUrl)
                                                ? 'border-chess-accent bg-chess-accent/10 shadow-sm'
                                                : 'border-white/5 bg-black/20 hover:border-white/10'
                                        }`}
                                    >
                                        <Upload size={14} className="text-chess-text-secondary" />
                                        <span className="text-[10px] font-semibold text-chess-text-secondary">Upload</span>
                                    </button>
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleAvatarUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        {/* Country Flag */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Globe size={16} className="text-chess-accent" />
                                Country
                            </label>
                            <select
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                className="w-full px-4 py-2.5 bg-chess-bg border border-white/10 rounded-lg text-white focus:outline-none focus:border-chess-accent transition-colors appearance-none cursor-pointer"
                                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                            >
                                {COUNTRIES_WITH_PLACEHOLDER.map(c => (
                                    <option key={c.code} value={c.code}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Flair Selection */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Sparkles size={16} className="text-chess-accent" />
                                Profile Flair / Badge
                            </label>
                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                                {CHESS_FLAIRS.map(f => (
                                    <button
                                        key={f.id}
                                        onClick={() => setFlair(f.id)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                                            flair === f.id
                                                ? 'border-chess-accent bg-chess-accent/10 shadow-lg shadow-chess-accent/10'
                                                : 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/5'
                                        }`}
                                        title={f.label}
                                    >
                                        <span className="text-2xl">{f.emoji || '—'}</span>
                                        <span className={`text-[10px] font-bold truncate w-full text-center ${flair === f.id ? 'text-chess-accent' : 'text-chess-text-secondary'}`}>
                                            {f.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Account Info (read-only) */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm text-chess-text-secondary">Email Address</span>
                                <span className="text-sm text-white font-bold">{user?.email}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-chess-text-secondary">Member Since</span>
                                <span className="text-sm text-white font-bold">
                                    {userProfile?.createdAt ? new Date(userProfile.createdAt.toDate()).toLocaleDateString() : 'Recently'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="mt-6 w-full px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>

                {/* ─── 3. Board Theme ─────────────────────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Palette className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Board Color Theme</h2>
                    </div>
                    <p className="text-sm text-chess-text-secondary mb-4">Choose your preferred board colors for the training arena</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {BOARD_THEMES.map(theme => (
                            <MiniBoardPreview
                                key={theme.id}
                                theme={theme}
                                selected={settings.boardTheme === theme.id}
                                onClick={() => {
                                    const updated = { ...settings, boardTheme: theme.id };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* ─── 4. Piece Set ───────────────────────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Crown className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Chess Pieces Set</h2>
                    </div>
                    <p className="text-sm text-chess-text-secondary mb-4">Choose your preferred piece rendering style (showing Kings preview)</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {PIECE_SETS.map(ps => (
                            <PieceSetPreview
                                key={ps.id}
                                pieceSet={ps}
                                selected={settings.pieceSet === ps.id}
                                onClick={() => {
                                    const updated = { ...settings, pieceSet: ps.id };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* ─── 5. Preferences & Settings ─────────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Preferences</h2>
                    </div>

                    <div className="space-y-6">
                        {/* Minimum Rating Slider */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="minElo" className="text-sm font-bold text-white">
                                    Minimum Rating Filter
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="600"
                                        max="1800"
                                        value={settings.minElo}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setSettings({ ...settings, minElo: isNaN(val) ? '' : val });
                                        }}
                                        onBlur={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (isNaN(val) || val < 600) val = 600;
                                            else if (val > 1800) val = 1800;
                                            const updated = { ...settings, minElo: val };
                                            setSettings(updated);
                                            handleAutoSaveSettings(updated);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.target.blur();
                                            }
                                        }}
                                        className="w-16 px-1.5 py-0.5 bg-chess-accent/10 border border-chess-accent/20 text-chess-accent text-xs font-mono font-bold rounded text-center focus:outline-none focus:border-chess-accent/50 focus:ring-0"
                                    />
                                    <span className="text-xs font-bold text-chess-text-secondary">ELO</span>
                                </div>
                            </div>
                            <input
                                id="minElo"
                                name="minElo"
                                type="range"
                                min="600"
                                max="1800"
                                step="50"
                                value={settings.minElo || 600}
                                onChange={(e) => setSettings({ ...settings, minElo: parseInt(e.target.value) })}
                                onMouseUp={(e) => {
                                    const val = parseInt(e.target.value);
                                    const updated = { ...settings, minElo: val };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                onTouchEnd={(e) => {
                                    const val = parseInt(e.target.value);
                                    const updated = { ...settings, minElo: val };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-chess-accent focus:outline-none focus:ring-0"
                            />
                            <p className="text-xs text-chess-text-secondary mt-1">
                                Only import and generate puzzles from matches where your rating or your opponent's is above this rating.
                            </p>
                        </div>

                        {/* Stockfish Engine Analysis Depth */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label htmlFor="engineDepth" className="text-sm font-bold text-white">
                                    Stockfish Evaluation Depth
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-chess-text-secondary">Depth</span>
                                    <input
                                        type="number"
                                        min="10"
                                        max="20"
                                        value={settings.engineDepth}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setSettings({ ...settings, engineDepth: isNaN(val) ? '' : val });
                                        }}
                                        onBlur={(e) => {
                                            let val = parseInt(e.target.value);
                                            if (isNaN(val) || val < 10) val = 10;
                                            else if (val > 20) val = 20;
                                            const updated = { ...settings, engineDepth: val };
                                            setSettings(updated);
                                            handleAutoSaveSettings(updated);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.target.blur();
                                            }
                                        }}
                                        className="w-12 px-1.5 py-0.5 bg-chess-accent/10 border border-chess-accent/20 text-chess-accent text-xs font-mono font-bold rounded text-center focus:outline-none focus:border-chess-accent/50 focus:ring-0"
                                    />
                                    <span className="text-xs text-chess-text-secondary font-bold">
                                        ({settings.engineDepth <= 10 ? 'Fast' : settings.engineDepth <= 14 ? 'Balanced' : 'Deep'})
                                    </span>
                                  </div>
                              </div>
                              <input
                                  id="engineDepth"
                                  name="engineDepth"
                                  type="range"
                                  min="10"
                                  max="20"
                                  step="1"
                                  value={settings.engineDepth || 10}
                                onChange={(e) => setSettings({ ...settings, engineDepth: parseInt(e.target.value) })}
                                onMouseUp={(e) => {
                                    const val = parseInt(e.target.value);
                                    const updated = { ...settings, engineDepth: val };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                onTouchEnd={(e) => {
                                    const val = parseInt(e.target.value);
                                    const updated = { ...settings, engineDepth: val };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-chess-accent focus:outline-none"
                            />
                            <p className="text-xs text-chess-text-secondary mt-1">
                                Higher plies depth makes Stockfish analyse positions deeper for higher quality blunders, but takes longer.
                            </p>
                        </div>

                        {/* Show Coordinate Labels Toggle */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-4">
                            <div>
                                <p className="font-bold text-white">Board Coordinates</p>
                                <p className="text-xs text-chess-text-secondary">
                                    Display ranks (1-8) and files (a-h) labels on the sides of the chessboard
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const updated = { ...settings, showCoordinates: !settings.showCoordinates };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.showCoordinates ? 'bg-chess-accent' : 'bg-white/10'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.showCoordinates ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Auto-Next Puzzle Toggle */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-4">
                            <div>
                                <p className="font-bold text-white">Auto-Next Puzzle</p>
                                <p className="text-xs text-chess-text-secondary">
                                    Automatically load the next puzzle in your queue upon successful solve
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    const updated = { ...settings, autoNext: !settings.autoNext };
                                    setSettings(updated);
                                    handleAutoSaveSettings(updated);
                                }}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.autoNext ? 'bg-chess-accent' : 'bg-white/10'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoNext ? 'translate-x-7' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── 6. Profile & Data Maintenance ────────────────────── */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="text-chess-accent" size={28} />
                        <h2 className="text-2xl font-bold text-white">Profile & Data Maintenance</h2>
                    </div>
                    <p className="text-chess-text-secondary text-sm mb-4">
                        Perform database maintenance on your account. This allows you to permanently purge your local profile stats, custom playlists, imported puzzles, and settings, resetting your account to a clean state.
                    </p>
                    <button
                        type="button"
                        onClick={() => setClearModalOpen(true)}
                        className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-chess-text-primary rounded-lg font-bold transition-all text-sm flex items-center gap-2"
                    >
                        <Trash2 size={16} className="text-chess-text-secondary" />
                        Reset Account Data
                    </button>
                </div>
            </div>

            {/* Double Confirmation Modal */}
            <ConfirmClearModal
                open={clearModalOpen}
                onClose={() => setClearModalOpen(false)}
                onConfirm={handleClearAllData}
                clearing={clearing}
            />

            {/* Modern Premium Toast Notifications */}
            <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ message: '', type: 'success' })}
            />
        </DashboardLayout>
    );
}
