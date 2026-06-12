import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
  Play, Star, Plus, Trophy, Flame, BookOpen,
  History, ArrowRight, CheckCircle, XCircle,
  Loader2, AlertCircle, ChevronRight, Search, ChevronLeft, X
} from 'lucide-react';
import { updateUserProfile } from '../services/userService';
import {
  getUserPuzzleStats,
  getUserPlaylists,
  getRecentlyAttemptedPuzzles,
  getFavoritePuzzles,
  getNewPuzzleCount
} from '../services/puzzleService';

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
  const [puzzleStats, setPuzzleStats] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState(null);

  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(1);

  // Compute session streak from sessionStorage
  const sessionResultsStr = sessionStorage.getItem('oneTimeSessionResults');
  let lastSessionStreak = 0;
  if (sessionResultsStr) {
    try {
      const results = JSON.parse(sessionResultsStr);
      let currentRun = 0;
      let maxRun = 0;
      results.forEach(r => {
        if (r.result) {
          currentRun++;
          if (currentRun > maxRun) maxRun = currentRun;
        } else {
          currentRun = 0;
        }
      });
      lastSessionStreak = maxRun;
    } catch (e) {
      console.warn('Failed to parse session results:', e);
    }
  }

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
      // Load stats — this is critical
      const stats = await getUserPuzzleStats(user.uid);
      setPuzzleStats(stats);
    } catch (e) {
      console.error('Critical dashboard load error (stats):', e);
      setError('Failed to load puzzle statistics. Please refresh.');
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
      loadAll();
    }
  }, [user?.uid, pendingScanStatus, pendingScanCount, loadAll]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">

        {/* Total Solved */}
        <div className="bg-chess-panel border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Total Puzzles Solved</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {loading ? <Loader2 size={28} className="animate-spin text-chess-accent" /> : (userProfile?.stats?.totalSolved ?? 0).toLocaleString()}
          </div>
          <div className="text-chess-text-secondary text-sm">
            {loading ? '—' : `${puzzleStats?.total ?? 0} total puzzles in deck`}
          </div>
        </div>

        {/* Current Streak */}
        <div className="bg-chess-panel border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Daily Login Streak</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {loading ? <Loader2 size={28} className="animate-spin text-chess-accent" /> : `${userProfile?.stats?.streak ?? 0} Days`}
          </div>
          <div className="text-sm text-chess-text-secondary">
            {loading ? '—' : 'Consecutive days on Chess-OP'}
          </div>
        </div>

        {/* Session Streak */}
        <div className="bg-chess-panel border border-white/5 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={64} className="text-chess-accent" />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Playlist Session Streak</h3>
          <div className="text-3xl font-bold text-white mb-2">
            {loading ? <Loader2 size={28} className="animate-spin text-chess-accent" /> : `${lastSessionStreak} Solves`}
          </div>
          <div className="text-sm text-chess-text-secondary">
            {loading ? '—' : 'Longest streak in last active run'}
          </div>
        </div>

        {/* Resume Training CTA */}
        <div
          className="bg-gradient-to-br from-chess-accent to-chess-accent/80 p-5 rounded-2xl relative overflow-hidden text-white shadow-lg shadow-chess-accent/20"
        >
          <h3 className="text-white/90 text-sm font-medium mb-1">Quick Start</h3>
          <div className="text-2xl font-bold mb-4">Resume Training</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button 
              onClick={(e) => { e.stopPropagation(); navigate('/dashboard/analysis-board', { state: { activeTab: 'ingest' } }); }}
              className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Search size={14} /> Analyse
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigate('/dashboard/train'); }}
              className="flex-1 bg-white text-chess-accent px-3 py-1.5 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-white/90 transition-colors"
            >
              <Play size={14} fill="currentColor" /> Train
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
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen size={20} className="text-chess-accent" /> Active Playlists
              </h2>
              <button
                onClick={() => navigate('/dashboard/repertoire')}
                className="text-sm text-chess-accent hover:text-white transition-colors flex items-center gap-1"
              >
                View All <ChevronRight size={16} />
              </button>
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
                      onClick={() => navigate(`/dashboard/train?puzzleId=${puzzle.id}`)}
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
                onClick={() => navigate('/dashboard/repertoire?filter=favorites')}
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

                {favorites.length >= 3 && (
                  <button
                    onClick={() => navigate('/dashboard/repertoire?filter=favorites')}
                    className="w-full text-center text-sm text-chess-accent hover:text-white py-2 transition-colors"
                  >
                    View all favorites →
                  </button>
                )}
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
                Setup Guide (Step {tourStep} of 5)
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
                {tourStep === 1 && <Trophy size={32} />}
                {tourStep === 2 && <AlertCircle size={32} />}
                {tourStep === 3 && <Search size={32} />}
                {tourStep === 4 && <BookOpen size={32} />}
                {tourStep === 5 && <Play size={32} />}
              </div>

              {tourStep === 1 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">Welcome to Chess-OP! 🏆</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Chess-OP is a state-of-the-art opening training platform. We help you scan your games, find blunder positions, and build custom training decks to eliminate your mistakes.
                  </p>
                </>
              )}

              {tourStep === 2 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">1. Link Lichess Account 🌐</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Connect your Lichess username in the Settings panel so Chess-OP can pull your matches. (If you don't have one, you can import custom positions manually!)
                  </p>
                </>
              )}

              {tourStep === 3 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">2. Analysis Manager 🧠</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Go to the 'Analysis Manager' to run Stockfish scans. You can select Rapid/Blitz time controls, date range, or paste manual FEN/PGNs to generate puzzles.
                  </p>
                </>
              )}

              {tourStep === 4 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">3. Repertoire & Playlists 📚</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Puzzles are stored in sequential playlists under 'My Repertoire'. You can rename puzzles, shift them between folders, and monitor your opening mastery scores.
                  </p>
                </>
              )}

              {tourStep === 5 && (
                <>
                  <h3 className="text-2xl font-serif font-bold text-white">4. Training Arena 🎯</h3>
                  <p className="text-chess-text-secondary text-sm leading-relaxed max-w-md">
                    Launch sessions on the interactive chessboard. A selector will ask which playlist you want to train. Solve positions correctly to build login and session streaks!
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
                {[1, 2, 3, 4, 5].map(i => (
                  <div 
                    key={i} 
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${tourStep === i ? 'bg-chess-accent w-4' : 'bg-white/10'}`}
                  />
                ))}
              </div>

              {tourStep < 5 ? (
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
    </DashboardLayout>
  );
}