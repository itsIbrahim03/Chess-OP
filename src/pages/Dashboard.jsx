import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Play, Star, Plus, Trophy, Flame, BookOpen,
  History, ArrowRight, CheckCircle, XCircle,
  Loader2, AlertCircle, ChevronRight, Search, ChevronLeft, X,
  Brain, HelpCircle, Thermometer, AlertTriangle, Compass, Target
} from 'lucide-react';
import { updateUserProfile } from '../services/userService';
import { translateError } from '../lib/errorTranslator';
import {
  getUserPuzzleStats,
  getUserPlaylists,
  getRecentlyAttemptedPuzzles,
  getFavoritePuzzles,
  getNewPuzzleCount
} from '../services/puzzleService';

import { getLevelInfo } from '../lib/xpHelpers';

// ─── Helper: time-ago string ─────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Greeting ─────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const levelInfo = getLevelInfo(userProfile?.stats?.xp || 0);
  const [puzzleStats, setPuzzleStats] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [heatmapTab, setHeatmapTab] = useState('squares');
  const boardFlipped = false;
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  const handleEndTour = async () => {
    setShowTour(false);
    if (user?.uid) {
      try {
        await updateUserProfile(user.uid, { showWelcomeTour: false });
        setUserProfile(prev => prev ? { ...prev, showWelcomeTour: false } : null);
      } catch (e) {
        console.error('Failed to dismiss welcome tour:', e);
      }
    }
  };

  const firstName = user?.displayName?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'Player';

  const loadAll = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      const stats = await getUserPuzzleStats(user.uid);
      setPuzzleStats(stats);
    } catch (e) {
      setError(translateError(e));
      setLoading(false);
      return; // Stop here if stats fails
    }

    // Load remaining data independently — errors are non-fatal
    const [groups, logs, favs, count] = await Promise.allSettled([
      getUserPlaylists(user.uid),
      getRecentlyAttemptedPuzzles(user.uid, 5),
      getFavoritePuzzles(user.uid),
      getNewPuzzleCount(user.uid),
    ]);

    if (groups.status === 'fulfilled') {
      setPlaylists(groups.value);
    }
    if (logs.status === 'fulfilled') setHistory(logs.value);
    if (favs.status === 'fulfilled') setFavorites(favs.value.slice(0, 5));
    if (count.status === 'fulfilled') setNewCount(count.value);

    setLoading(false);
  }, [user]);

  // Auto-dismiss toast notification after 4 seconds
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleHistoryItemClick = async (puzzleId) => {
    if (!puzzleId) return;
    try {
      const puzzleRef = doc(db, 'puzzles', puzzleId);
      const puzzleSnap = await getDoc(puzzleRef);
      if (!puzzleSnap.exists()) {
        setToast({
          show: true,
          message: 'This puzzle has been deleted from your repertoire.',
          type: 'error'
        });
        loadAll(); // Refresh history list
      } else {
        navigate(`/dashboard/train?puzzleId=${puzzleId}`);
      }
    } catch (e) {
      console.error('Error checking puzzle existence:', e);
      // Fallback: try navigating anyway
      navigate(`/dashboard/train?puzzleId=${puzzleId}`);
    }
  };

  // Set up real-time listener for the user profile document
  useEffect(() => {
    if (!user?.uid) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setUserProfile(data);
        // If onboarding is not completed, redirect to onboarding page
        if (data.onboardingCompleted !== true) {
          navigate('/onboarding');
        }
        if (data.showWelcomeTour === true) {
          setShowTour(true);
          setTourStep(1);
        }
      }
    }, (error) => {
      console.error("Error listening to profile changes in Dashboard:", error);
    });

    return () => unsubscribe();
  }, [user?.uid, navigate]);

  // When pendingScan changes (e.g. scan completes or puzzles are reviewed/dismissed), reload stats and lists
  const pendingScanStatus = userProfile?.pendingScan?.status;
  const pendingScanCount = userProfile?.pendingScan?.count;
  useEffect(() => {
    if (user?.uid) {
      const timer = setTimeout(() => {
        loadAll();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user?.uid, pendingScanStatus, pendingScanCount, loadAll]);

  // --- Blunder Heatmap Aggregation ---
  const getPieceAtSquare = (fen, square) => {
    if (!fen || !square || square.length !== 2) return 'P';
    
    const file = square[0];
    const rank = square[1];
    
    const fileIndex = file.charCodeAt(0) - 97; // a=0, b=1, ... h=7
    const rankIndex = 8 - parseInt(rank, 10); // 8=0, 7=1, ... 1=7
    
    if (fileIndex < 0 || fileIndex > 7 || rankIndex < 0 || rankIndex > 7) return 'P';
    
    const boardPart = fen.split(' ')[0];
    const rows = boardPart.split('/');
    
    if (!rows[rankIndex]) return 'P';
    const row = rows[rankIndex];
    
    let currentFile = 0;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (/[1-8]/.test(char)) {
        currentFile += parseInt(char, 10);
      } else {
        if (currentFile === fileIndex) {
          return char.toUpperCase(); // R, N, B, Q, K, P
        }
        currentFile += 1;
      }
    }
    return 'P';
  };

  const PIECE_NAMES = {
    P: { name: 'Pawn', symbol: '♟' },
    N: { name: 'Knight', symbol: '♞' },
    B: { name: 'Bishop', symbol: '♝' },
    R: { name: 'Rook', symbol: '♜' },
    Q: { name: 'Queen', symbol: '♛' },
    K: { name: 'King', symbol: '♚' }
  };

  const puzzles = puzzleStats?.puzzles || [];
  
  const squareBlunders = {};
  const pieceBlunders = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
  const missedHeroPieces = { P: 0, N: 0, B: 0, R: 0, Q: 0, K: 0 };
  const squareDetails = {};

  puzzles.forEach(p => {
    // Only analyze puzzles that have playerMove (this ensures 100% accurate blunder square and piece stats)
    if (p.playerMove && p.playerMove.length >= 4) {
      const targetSquare = p.playerMove.slice(2, 4);
      const playerStartSquare = p.playerMove.slice(0, 2);
      const movedPiece = getPieceAtSquare(p.fen, playerStartSquare);
      
      const opening = p.opening || 'Unknown Opening';
      
      // Parse correct piece from correctMove
      let correctPiece = 'P';
      if (p.correctMove && p.correctMove.length >= 4) {
        const correctStartSquare = p.correctMove.slice(0, 2);
        correctPiece = getPieceAtSquare(p.fen, correctStartSquare);
      }
      
      if (targetSquare && targetSquare.length === 2) {
        squareBlunders[targetSquare] = (squareBlunders[targetSquare] || 0) + 1;
        
        if (!squareDetails[targetSquare]) {
          squareDetails[targetSquare] = { pieces: {}, openings: {} };
        }
        squareDetails[targetSquare].pieces[movedPiece] = (squareDetails[targetSquare].pieces[movedPiece] || 0) + 1;
        squareDetails[targetSquare].openings[opening] = (squareDetails[targetSquare].openings[opening] || 0) + 1;
      }
      
      pieceBlunders[movedPiece] = (pieceBlunders[movedPiece] || 0) + 1;
      missedHeroPieces[correctPiece] = (missedHeroPieces[correctPiece] || 0) + 1;
    }
  });

  const maxSquareBlunders = Math.max(1, ...Object.values(squareBlunders));

  return (
    <DashboardLayout>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={loadAll} className="ml-auto text-sm underline hover:text-white">Retry</button>
        </div>
      )}

      {/* Welcome */}
      <div className="mb-4">
        <h1 className="text-3xl font-serif font-bold text-white mb-2">
          {greeting()}, {firstName}
        </h1>
        {loading ? (
          <p className="text-chess-text-secondary">Loading your training data…</p>
        ) : newCount > 0 ? (
          <p className="text-chess-text-secondary">
            Ready to punish some blunders? You have{' '}
            <span className="text-chess-accent font-bold">{newCount} new puzzle{newCount !== 1 ? 's' : ''}</span> waiting.
          </p>
        ) : (
          <p className="text-chess-text-secondary">
            All puzzles reviewed! <span className="text-chess-accent font-bold">Analyse more games</span> to generate new ones.
          </p>
        )}
      </div>

      {/* Pending Scan Review Alert Card */}
      {!loading && userProfile?.pendingScan?.status === 'completed' && userProfile.pendingScan.count > 0 && (
        <div className="mb-8 bg-gradient-to-r from-chess-accent/15 via-chess-accent/5 to-transparent border border-chess-accent/30 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-chess-accent/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-chess-accent/15 border border-chess-accent/30 rounded-xl flex items-center justify-center shrink-0 text-chess-accent">
              <BookOpen size={24} />
            </div>
            <div>
              <h4 className="font-bold text-white mb-0.5">Review Pending Puzzles</h4>
              <p className="text-sm text-chess-text-secondary">
                You have {userProfile.pendingScan.count} new blunder puzzles from your recent game scan waiting to be named and saved to your playlists.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/analysis-board?review=true')}
            className="px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-chess-accent/15 hover:-translate-y-0.5 whitespace-nowrap cursor-pointer"
          >
            Review & Ingest Puzzles
          </button>
        </div>
      )}

      {/* Lichess Connection Alert Banner */}
      {!loading && !userProfile?.lichessUsername && (
        <div className="mb-8 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="text-amber-500" size={20} />
            </div>
            <div>
              <h4 className="font-bold text-white mb-0.5">Link your Lichess account</h4>
              <p className="text-sm text-chess-text-secondary">
                You haven't linked a Lichess username yet. Link your account in Settings to start scanning and generating chess puzzles!
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
      )}

      {/* ── Stats Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

        {/* Level & XP Progress */}
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-between min-h-[150px]">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all duration-300 group-hover:scale-110 pointer-events-none select-none text-5xl">
            {levelInfo.badgeEmoji}
          </div>
          <div>
            <h3 className="text-chess-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Level & XP Progress</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-3xl font-black text-white tracking-tight">Level {levelInfo.level}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${levelInfo.badgeBg} ${levelInfo.rankColor} flex items-center gap-1`}>
                <span>{levelInfo.badgeEmoji}</span>
                <span>{levelInfo.rank}</span>
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-black/40 rounded-full h-2.5 p-0.5 overflow-hidden border border-white/5">
              <div
                className="h-full rounded-full transition-all duration-500 bg-chess-accent"
                style={{ width: `${levelInfo.xpPercent}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-chess-text-secondary flex justify-between font-medium mt-2">
            <span>{levelInfo.xpInLevel} / {levelInfo.nextLevelXp} XP</span>
            <span>{levelInfo.xpNeeded} XP to Level Up</span>
          </div>
        </div>

        {/* Total Solved */}
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-between min-h-[150px]">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all duration-300 group-hover:scale-110 pointer-events-none">
            <CheckCircle size={72} />
          </div>
          <div>
            <h3 className="text-chess-text-secondary text-xs font-bold uppercase tracking-wider mb-2">Total Puzzles Solved</h3>
            <div className="text-5xl font-black text-white tracking-tight leading-none">
              {loading ? (
                <Loader2 size={32} className="animate-spin text-chess-accent" />
              ) : (
                (userProfile?.stats?.totalSolved ?? 0).toLocaleString()
              )}
            </div>
          </div>
          <div className="text-[11px] text-chess-accent font-semibold flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-chess-accent animate-pulse" />
            Lifetime Solve Count
          </div>
        </div>

        {/* Resume Training CTA */}
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group flex flex-col justify-between min-h-[150px]">
          {/* Subtle background glow */}
          <div className="absolute -right-12 -bottom-12 w-32 h-32 rounded-full bg-chess-accent/5 blur-2xl group-hover:bg-chess-accent/15 transition-all duration-500 pointer-events-none" />
          
          <div>
            <h3 className="text-chess-text-secondary text-xs font-bold uppercase tracking-wider mb-1">Quick Action</h3>
            <div className="text-2xl font-black text-white tracking-tight mb-4">Resume Training</div>
          </div>
          
          <div className="flex gap-3 z-10">
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (puzzleStats?.total >= 70) return;
                navigate('/dashboard/analysis-board', { state: { activeTab: 'ingest' } }); 
              }}
              disabled={puzzleStats?.total >= 70}
              title={puzzleStats?.total >= 70 ? "Repertoire capacity full (70/70)" : "Analyse recent games"}
              className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-300 border ${
                puzzleStats?.total >= 70
                  ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed opacity-50'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white active:scale-[0.98]'
              }`}
            >
              <Search size={14} />
              <span>Analyse</span>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigate('/dashboard/train'); }}
              className="flex-1 bg-chess-accent hover:bg-chess-accent-hover text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-300 shadow-md shadow-chess-accent/15 cursor-pointer"
            >
              <Play size={14} fill="currentColor" />
              <span>Train Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Playlists + History */}
        <div className="lg:col-span-2 space-y-5">

          {/* Active Playlists */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                onClick={() => navigate('/dashboard/repertoire')}
                className="text-xl font-bold text-white flex items-center gap-2 cursor-pointer hover:text-chess-accent transition-colors group"
              >
                <BookOpen size={20} className="text-chess-accent" /> Active Playlists
                <ChevronRight size={16} className="text-chess-text-secondary group-hover:text-chess-accent transition-colors" />
              </h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-chess-panel border border-white/5 p-5 rounded-xl animate-pulse h-36" />
                ))}
              </div>
            ) : (() => {
              const activePlaylists = playlists.filter(pl => pl.total > 0);
              if (activePlaylists.length === 0) {
                return (
                  /* Empty State */
                  <div className="bg-chess-panel border border-dashed border-white/10 rounded-xl p-10 text-center">
                    <BookOpen size={40} className="text-chess-text-secondary mx-auto mb-3 opacity-50" />
                    <p className="text-white font-medium mb-1">No playlists yet</p>
                    <p className="text-chess-text-secondary text-sm mb-4">Analyse your games to generate your first puzzle set.</p>
                    <button
                      onClick={() => navigate('/dashboard/analysis-board', { state: { activeTab: 'ingest' } })}
                      className="bg-chess-accent text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-chess-accent/90 transition-colors"
                    >
                      Analyse My Games
                    </button>
                  </div>
                );
              }

              const gridClass = activePlaylists.length === 1
                ? "grid grid-cols-1 gap-6"
                : activePlaylists.length === 2
                  ? "grid grid-cols-1 sm:grid-cols-2 gap-6"
                  : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6";

              // SVG Circular Gauge Helper
              const CircularGauge = ({ percentage, color = 'stroke-chess-accent', title, subtitle }) => {
                const radius = 30;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (percentage / 100) * circumference;

                return (
                  <div className="flex flex-col items-center shrink-0" title={title}>
                    <div className="relative w-[72px] h-[72px] flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 72 72">
                        <circle
                          cx="36"
                          cy="36"
                          r={radius}
                          className="stroke-white/5 fill-transparent"
                          strokeWidth="4"
                        />
                        <circle
                          cx="36"
                          cy="36"
                          r={radius}
                          className={`fill-transparent transition-all duration-1000 ${color}`}
                          strokeWidth="4"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-sm font-bold text-white">{percentage}%</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-chess-text-secondary tracking-wider mt-1.5">{title}</span>
                    {subtitle && <span className="text-[9px] text-chess-text-secondary opacity-70 font-semibold mt-0.5">{subtitle}</span>}
                  </div>
                );
              };

              return (
                <div className={gridClass}>
                  {activePlaylists.map((pl, i) => {
                    return (
                      <div
                        key={i}
                        className="bg-chess-panel border border-white/5 p-5 sm:p-6 rounded-2xl transition-all duration-500 ease-out transform hover:-translate-y-1 hover:border-chess-accent/40 hover:shadow-[0_10px_25px_-5px_rgba(235,94,85,0.15)] flex items-center justify-between h-[150px] relative overflow-hidden group select-none"
                      >
                        {/* Background subtle glowing circle on hover */}
                        <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-chess-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                        {/* Left side: Metadata and Manage action button */}
                        <div className="flex flex-col justify-between h-full py-0.5 min-w-0 flex-1 mr-4">
                          <div>
                            <h3 className="text-white font-bold text-lg mb-0.5 truncate" title={pl.title}>
                              {pl.title}
                            </h3>
                            <p className="text-xs text-chess-text-secondary">
                              {pl.total} puzzles
                            </p>
                          </div>

                          <button
                            onClick={() => navigate('/dashboard/repertoire')}
                            className="bg-white/5 hover:bg-chess-accent hover:text-white text-chess-text-secondary hover:shadow-inner text-xs px-3.5 py-2 rounded-xl transition-all duration-300 font-semibold flex items-center gap-1 w-fit cursor-pointer"
                          >
                            Manage <ArrowRight size={12} />
                          </button>
                        </div>

                        {/* Right side: Large Mastery circular gauge */}
                        <div className="shrink-0 flex items-center justify-center">
                          <CircularGauge
                            percentage={pl.progress}
                            color="stroke-chess-accent"
                            title="Mastery"
                            subtitle={`${pl.solved}/${pl.total} Solved`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </section>

           {/* Blunder Heatmap Section */}
          <section className="bg-chess-panel border border-white/5 rounded-2xl p-6 relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-b-white/5">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={20} className="text-red-400" /> Blunder Analysis Heatmap
                  <button
                    onClick={() => setShowHelpModal(true)}
                    className="p-1 hover:bg-white/5 rounded-lg text-chess-text-secondary hover:text-white transition-colors cursor-pointer"
                    title="How to read the heatmap"
                  >
                    <HelpCircle size={16} />
                  </button>
                </h2>
                <p className="text-xs text-chess-text-secondary mt-0.5">
                  Visual breakdown of opening mistakes and missed tactics in your games.
                </p>
              </div>

              {/* Tab Selector */}
              {puzzles.filter(p => p.playerMove).length > 0 && (
                <div className="flex bg-black/40 border border-white/5 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => { setHeatmapTab('squares'); setSelectedSquare(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      heatmapTab === 'squares' ? 'bg-chess-accent text-white' : 'text-chess-text-secondary hover:text-white'
                    }`}
                  >
                    Squares
                  </button>
                  <button
                    onClick={() => setHeatmapTab('trouble_pieces')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      heatmapTab === 'trouble_pieces' ? 'bg-chess-accent text-white' : 'text-chess-text-secondary hover:text-white'
                    }`}
                  >
                    Trouble Pieces
                  </button>
                  <button
                    onClick={() => setHeatmapTab('missed_heroes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      heatmapTab === 'missed_heroes' ? 'bg-chess-accent text-white' : 'text-chess-text-secondary hover:text-white'
                    }`}
                  >
                    Missed Heroes
                  </button>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 animate-pulse">
                <Loader2 size={32} className="animate-spin text-chess-accent mb-3" />
                <p className="text-xs text-chess-text-secondary">Generating blunder metrics...</p>
              </div>
            ) : puzzles.filter(p => p.playerMove).length === 0 ? (
              <div className="bg-black/20 border border-dashed border-white/10 rounded-xl p-8 text-center">
                <AlertTriangle size={36} className="text-chess-text-secondary mx-auto mb-3 opacity-50" />
                <p className="text-white font-medium mb-1">No blunder history available</p>
                {puzzles.length > 0 ? (
                  <p className="text-chess-text-secondary text-sm max-w-sm mx-auto">
                    Your existing puzzles were saved without move history. Please scan new games or manually import PGNs to generate puzzles and unlock your blunder heatmap!
                  </p>
                ) : (
                  <p className="text-chess-text-secondary text-sm max-w-sm mx-auto">
                    Scan your Lichess games or manually ingest PGNs to generate puzzles and unlock your blunder heatmap!
                  </p>
                )}
              </div>
            ) : (
              <>
                {/* TAB 1: SQUARES (HEATMAP) */}
                {heatmapTab === 'squares' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* Chessboard Column */}
                    <div className="flex flex-col items-center animate-fade-in">
                      {/* Grid wrapper with clear borders - Bigger Size! */}
                      <div className="grid grid-cols-8 grid-rows-8 w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[410px] md:h-[410px] border-2 border-slate-700 overflow-hidden rounded-2xl shadow-inner select-none">
                        {(() => {
                          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                          const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
                          
                          const displayFiles = boardFlipped ? [...files].reverse() : files;
                          const displayRanks = boardFlipped ? [...ranks].reverse() : ranks;
                          
                          const gridCells = [];
                          
                          displayRanks.forEach((rank, rIdx) => {
                            displayFiles.forEach((file, fIdx) => {
                              const sq = `${file}${rank}`;
                              const isDark = (rIdx + fIdx) % 2 === 1;
                              const count = squareBlunders[sq] || 0;
                              const isSelected = selectedSquare === sq;
                              
                              // Intensity overlay: max overlay is 85% opacity red
                              const opacity = count > 0 ? Math.min(0.85, 0.2 + (count / maxSquareBlunders) * 0.65) : 0;
                              
                              // Explicit borders to isolate squares from neighbors
                              const gridBorder = isDark ? 'border border-slate-700/60' : 'border border-slate-300/60';
                              
                              gridCells.push(
                                <div
                                  key={sq}
                                  onClick={() => setSelectedSquare(isSelected ? null : sq)}
                                  className={`relative flex items-center justify-center cursor-pointer transition-all duration-200 border-box ${
                                    isDark ? 'bg-slate-800' : 'bg-slate-200'
                                  } ${gridBorder} ${isSelected ? 'ring-4 ring-chess-accent z-10 animate-pulse' : 'hover:scale-[1.02] hover:z-10'}`}
                                  title={`Square ${sq}: ${count} blunder(s)`}
                                >
                                  {/* Heat overlay */}
                                  {count > 0 && (
                                    <div 
                                      className="absolute inset-0 bg-red-600 transition-colors" 
                                      style={{ opacity }} 
                                    />
                                  )}
                                  
                                  {/* Label for files/ranks on edges - Bigger and More Visible! */}
                                  {fIdx === 0 && (
                                    <span className={`absolute top-1 left-1.5 text-[10px] sm:text-xs font-black select-none ${
                                      isDark ? 'text-slate-300/90' : 'text-slate-800/90'
                                    } z-20`}>
                                      {rank}
                                    </span>
                                  )}
                                  {rIdx === 7 && (
                                    <span className={`absolute bottom-1 right-1.5 text-[10px] sm:text-xs font-black select-none ${
                                      isDark ? 'text-slate-300/90' : 'text-slate-800/90'
                                    } z-20`}>
                                      {file}
                                    </span>
                                  )}

                                  {/* Inner blunder count text */}
                                  {count > 0 && (
                                    <span className="text-white font-black text-xs sm:text-sm drop-shadow-md z-20">
                                      {count}
                                    </span>
                                  )}
                                </div>
                              );
                            });
                          });
                          return gridCells;
                        })()}
                      </div>
                    </div>

                    {/* Details / Overview Column */}
                    <div className="bg-black/35 border border-white/5 rounded-xl p-5 h-full flex flex-col justify-center min-h-[300px]">
                      {selectedSquare ? (
                        (() => {
                          const details = squareDetails[selectedSquare];
                          const count = squareBlunders[selectedSquare] || 0;
                          if (!details) {
                            return (
                              <div className="text-center py-6">
                                <h4 className="text-white font-bold text-lg mb-1">Square {selectedSquare.toUpperCase()}</h4>
                                <p className="text-chess-text-secondary text-sm">No blunders logged on this square.</p>
                                <button 
                                  onClick={() => setSelectedSquare(null)}
                                  className="mt-4 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-xs font-bold transition-all"
                                >
                                  Back to Overview
                                </button>
                              </div>
                            );
                          }
                          
                          const sortedPieces = Object.entries(details.pieces).sort((a, b) => b[1] - a[1]);
                          const sortedOpenings = Object.entries(details.openings).sort((a, b) => b[1] - a[1]);
                          
                          return (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                <h4 className="text-white font-black text-xl flex items-center gap-2">
                                  Square <span className="text-red-400 uppercase">{selectedSquare}</span>
                                </h4>
                                <button
                                  onClick={() => setSelectedSquare(null)}
                                  className="text-xs text-chess-accent hover:underline font-bold"
                                >
                                  Show All Squares
                                </button>
                              </div>
                              
                              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs font-bold flex justify-between">
                                <span>Blunder Count</span>
                                <span>{count} time{count !== 1 ? 's' : ''}</span>
                              </div>
                              
                              <div>
                                <p className="text-xs font-bold text-chess-text-secondary uppercase tracking-wider mb-2">Blundered Pieces</p>
                                <div className="flex flex-wrap gap-2">
                                  {sortedPieces.map(([piece, pCount]) => (
                                    <span key={piece} className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white font-semibold flex items-center gap-1.5">
                                      <span className="text-base leading-none text-red-400">{PIECE_NAMES[piece]?.symbol}</span>
                                      <span>{PIECE_NAMES[piece]?.name} ({pCount})</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-bold text-chess-text-secondary uppercase tracking-wider mb-2">Source Openings</p>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                                  {sortedOpenings.map(([op, opCount]) => (
                                    <div key={op} className="flex justify-between items-center text-xs text-white bg-white/[0.02] border border-white/5 rounded-lg p-2">
                                      <span className="font-semibold truncate mr-2">{op}</span>
                                      <span className="text-chess-text-secondary font-bold shrink-0">{opCount} time{opCount !== 1 ? 's' : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="space-y-4">
                          <div className="border-b border-white/5 pb-2">
                            <h4 className="text-white font-black text-lg flex items-center gap-2">
                              <Flame size={18} className="text-red-400 animate-pulse" /> Temperature Scan Overview
                            </h4>
                          </div>

                          <div>
                            <p className="text-xs font-bold text-chess-text-secondary uppercase tracking-wider mb-3">Top Blundered Squares (Hot spots)</p>
                            {(() => {
                              const sortedSquares = Object.entries(squareBlunders).sort((a, b) => b[1] - a[1]).slice(0, 5);
                              if (sortedSquares.length === 0) {
                                return <p className="text-xs text-chess-text-secondary">No square data available.</p>;
                              }
                              return (
                                <div className="space-y-2.5">
                                  {sortedSquares.map(([sq, sqCount]) => {
                                    const percent = Math.round((sqCount / maxSquareBlunders) * 100);
                                    return (
                                      <div key={sq} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold">
                                          <span className="text-white uppercase">Square {sq}</span>
                                          <span className="text-red-400 font-extrabold">{sqCount} blunder{sqCount !== 1 ? 's' : ''}</span>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                          <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="pt-2 text-center text-xs text-chess-text-secondary border-t border-white/5">
                            Click any square on the board grid to view detailed opening and piece metrics.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: TROUBLE PIECES */}
                {heatmapTab === 'trouble_pieces' && (
                  <div className="space-y-4">
                    <p className="text-xs text-chess-text-secondary">
                      These are the pieces you moved when you made a blunder. High counts mean you need to watch these pieces more carefully!
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {Object.entries(pieceBlunders).sort((a, b) => b[1] - a[1]).map(([piece, count]) => {
                        const info = PIECE_NAMES[piece];
                        const maxBlunders = Math.max(1, ...Object.values(pieceBlunders));
                        const percent = Math.round((count / maxBlunders) * 100);
                        return (
                          <div key={piece} className="bg-black/35 border border-white/5 p-4 rounded-xl text-center relative overflow-hidden flex flex-col justify-between h-32 group">
                            <div className="text-red-400 text-3xl mb-1 group-hover:scale-110 transition-transform duration-300">
                              {info.symbol}
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-sm">{info.name}s</h4>
                              <p className="text-chess-text-secondary text-[11px] font-bold uppercase tracking-wider mt-0.5">
                                {count} blunder{count !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
                              <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: MISSED HEROES */}
                {heatmapTab === 'missed_heroes' && (
                  <div className="space-y-4">
                    <p className="text-xs text-chess-text-secondary">
                      These are the pieces you *should* have moved to win material or protect yourself, but you forgot about them.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                      {Object.entries(missedHeroPieces).sort((a, b) => b[1] - a[1]).map(([piece, count]) => {
                        const info = PIECE_NAMES[piece];
                        const maxMissed = Math.max(1, ...Object.values(missedHeroPieces));
                        const percent = Math.round((count / maxMissed) * 100);
                        return (
                          <div key={piece} className="bg-black/35 border border-white/5 p-4 rounded-xl text-center relative overflow-hidden flex flex-col justify-between h-32 group">
                            <div className="text-emerald-400 text-3xl mb-1 group-hover:scale-110 transition-transform duration-300">
                              {info.symbol}
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-sm">{info.name}s</h4>
                              <p className="text-chess-text-secondary text-[11px] font-bold uppercase tracking-wider mt-0.5">
                                {count} missed
                              </p>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Recent History */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History size={20} className="text-chess-text-secondary" /> Recent History
              </h2>
            </div>

            {loading ? (
              <div className="bg-chess-panel border border-white/5 rounded-xl overflow-hidden">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <div className="flex-1 h-4 bg-white/10 rounded" />
                    <div className="w-12 h-4 bg-white/10 rounded" />
                  </div>
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="bg-chess-panel border border-dashed border-white/10 rounded-xl p-8 text-center">
                <History size={36} className="text-chess-text-secondary mx-auto mb-3 opacity-50" />
                <p className="text-white font-medium mb-1">No activity yet</p>
                <p className="text-chess-text-secondary text-sm">Solve puzzles in the Training Arena to see your history here.</p>
              </div>
            ) : (
              <div className="bg-chess-panel border border-white/5 rounded-xl overflow-hidden">
                {history.map((puzzle, i) => {
                  const success = puzzle.lastResult === 'success';
                  const puzzleName = puzzle.customName || puzzle.opening || 'Opening Puzzle';
                  return (
                    <div
                      key={puzzle.id ?? i}
                      onClick={() => handleHistoryItemClick(puzzle.id)}
                      className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer group"
                      title="Click to retry this puzzle"
                    >
                      <div className="flex items-center gap-4">
                        {success
                          ? <CheckCircle size={18} className="text-chess-status-success shrink-0" />
                          : <XCircle size={18} className="text-chess-status-error shrink-0" />
                        }
                        <div>
                          <p className="text-white font-medium text-sm group-hover:text-chess-accent transition-colors">{puzzleName}</p>
                          <p className="text-xs text-chess-text-secondary">{puzzle.theme || 'Blunder'} · {timeAgo(puzzle.lastAttemptedAt)}</p>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${success ? 'text-chess-status-success' : 'text-chess-status-error'}`}>
                        {success ? '✓ Solved' : '✗ Failed'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT: Favorites */}
        <div className="space-y-5">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                onClick={() => navigate('/dashboard/repertoire?expand=favorites')}
                className="text-xl font-bold text-white flex items-center gap-2 cursor-pointer hover:text-yellow-400 transition-colors group"
              >
                <Star size={20} className="text-yellow-400" /> Favorites
                <ChevronRight size={16} className="text-chess-text-secondary group-hover:text-yellow-400 transition-colors" />
              </h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-chess-panel border border-white/5 rounded-xl p-4 h-24 animate-pulse" />
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <div className="bg-chess-panel border border-dashed border-white/10 rounded-xl p-8 text-center">
                <Star size={36} className="text-chess-text-secondary mx-auto mb-3 opacity-50" />
                <p className="text-white font-medium mb-1">No favorites yet</p>
                <p className="text-chess-text-secondary text-sm">Star puzzles during training to save them here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {favorites.map((puzzle, i) => (
                  <div
                    key={puzzle.id ?? i}
                    onClick={() => navigate(`/dashboard/train?puzzleId=${puzzle.id}`)}
                    className="bg-chess-panel border border-white/5 rounded-xl p-4 hover:border-yellow-400/30 transition-all cursor-pointer hover:-translate-y-0.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-sm group-hover:text-yellow-400 transition-colors">
                          {puzzle.customName || puzzle.opening || 'Favorite Puzzle'}
                        </p>
                        <p className="text-xs text-chess-text-secondary mt-0.5">
                          {puzzle.status}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Star size={14} className="text-yellow-400 fill-yellow-400" />
                        <ArrowRight size={14} className="text-chess-text-secondary group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

      </div>

      {/* Welcome Setup Guide Tour Modal */}
      {showTour && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleEndTour} />
          
          <div className="relative w-full max-w-xl bg-chess-panel/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Glow */}
            <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/20 to-brand-med/20 rounded-3xl blur-[1px] -z-10" />
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] bg-chess-accent/15 border border-chess-accent/25 text-chess-accent px-2.5 py-1 rounded-lg font-extrabold uppercase tracking-widest">
                Setup Guide (Step {tourStep} of 6)
              </span>
              <button 
                onClick={handleEndTour}
                className="text-chess-text-secondary hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="Skip Tour"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Content */}
            <div className="flex flex-col items-center text-center space-y-4 mb-8">
              <div className="w-16 h-16 bg-chess-accent/15 border border-chess-accent/20 text-chess-accent rounded-2xl flex items-center justify-center shadow-xl shadow-chess-accent/5">
                {tourStep === 1 && <Compass size={32} />}
                {tourStep === 2 && <AlertCircle size={32} />}
                {tourStep === 3 && <Search size={32} />}
                {tourStep === 4 && <Flame size={32} />}
                {tourStep === 5 && <BookOpen size={32} />}
                {tourStep === 6 && <Play size={32} />}
              </div>

              {tourStep === 1 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">Welcome to Chess-OP! 🎯</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Chess-OP is a state-of-the-art opening training platform. We help you scan your games, find blunder positions, and build custom training decks to eliminate your mistakes.
                  </p>
                </>
              )}

              {tourStep === 2 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">1. Link Lichess Account 🌐</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Connect your Lichess username in the Settings panel so Chess-OP can pull your matches. (If you don't have one, you can import custom games manually!)
                  </p>
                </>
              )}

              {tourStep === 3 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">2. Analysis Manager 🔍</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Go to the 'Analysis Manager' to run Stockfish scans. You can select Rapid/Blitz/Classical time controls, date range, or paste manual PGNs to generate puzzles.
                  </p>
                </>
              )}

              {tourStep === 4 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">3. Blunder Analysis Heatmap 📊</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Explore your personal blunder dashboard! Identify your blundered grid squares, find your trouble pieces, and reveal missed saving moves using the interactive heatmap tabs.
                  </p>
                </>
              )}

              {tourStep === 5 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">4. Repertoire & Playlists 📚</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Puzzles are stored in sequential playlists under 'My Repertoire'. You can rename puzzles, shift them between folders, and monitor your opening mastery scores.
                  </p>
                </>
              )}

              {tourStep === 6 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">5. Training Arena 🎯</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Launch sessions on the interactive chessboard. A selector will ask which playlist you want to train. Solve positions correctly to build streaks!
                  </p>
                </>
              )}
            </div>

            {/* Stepper Footer Controls */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setTourStep(prev => Math.max(1, prev - 1))}
                disabled={tourStep === 1}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-35 disabled:hover:bg-white/5 text-white border border-white/10 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> Back
              </button>

              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${tourStep === i ? 'bg-chess-accent w-4' : 'bg-white/10'}`}
                  />
                ))}
              </div>

              {tourStep < 6 ? (
                <button
                  onClick={() => setTourStep(prev => prev + 1)}
                  className="px-5 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleEndTour}
                  className="px-5 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-chess-accent/15"
                >
                  Finish Tour <CheckCircle size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blunder Heatmap Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowHelpModal(false)} />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-lg bg-chess-panel/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl animate-in select-none">
            {/* Close button */}
            <button 
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-2 text-chess-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6 border-b border-b-white/5 pb-4">
              <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                <Flame size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-none">Blunder Heatmap Guide</h3>
                <p className="text-xs text-chess-text-secondary mt-1">Learn how to read and use your mistake statistics to improve.</p>
              </div>
            </div>

            <div className="space-y-5 text-sm text-chess-text-secondary">
              <div>
                <h4 className="text-white font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-455 bg-red-400" />
                  Squares Tab (The Heatmap)
                </h4>
                <p className="pl-3 leading-relaxed text-xs">
                  Shows the squares where your mistakes land on the chessboard. The darker red a square is, the more blunders you made on that square! Click any highlighted square to see:
                </p>
                <ul className="list-disc pl-7 mt-1 text-xs space-y-1">
                  <li>Which pieces you blundered on that square.</li>
                  <li>In which openings those mistakes happened.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Trouble Pieces Tab
                </h4>
                <p className="pl-3 leading-relaxed text-xs">
                  Displays the pieces you actually moved when you made a blunder. Pieces with higher counts are your "troublemakers" that you need to be extra careful with!
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Missed Heroes Tab
                </h4>
                <p className="pl-3 leading-relaxed text-xs">
                  Displays the pieces you <strong className="text-emerald-400 font-bold">should</strong> have moved to win material or protect your position, but you missed them. These represent hidden opportunities!
                </p>
              </div>

              <div className="bg-chess-accent/10 border border-chess-accent/20 rounded-2xl p-4 text-chess-text-secondary text-xs leading-relaxed">
                <p className="font-bold text-white mb-1">💡 How to Improve using this data:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Before moving your <strong>Trouble Pieces</strong> in a game, pause and double-check their destination square.</li>
                  <li>When you spot your <strong>Missed Heroes</strong> in puzzles, train yourself to search for those pieces first in real games!</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2.5 bg-chess-accent hover:bg-chess-accent-hover text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md border border-white/10 transition-all duration-300 ${
          toast.type === 'error'
            ? 'bg-slate-950/90 border-l-4 border-l-rose-500 shadow-rose-500/5'
            : 'bg-slate-950/90 border-l-4 border-l-emerald-500 shadow-emerald-500/5'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="text-rose-400 shrink-0" size={18} /> : <CheckCircle className="text-emerald-400 shrink-0" size={18} />}
          <span className="font-bold text-sm">{toast.message}</span>
          <button onClick={() => setToast({ show: false, message: '', type: 'info' })} className="ml-2 hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}