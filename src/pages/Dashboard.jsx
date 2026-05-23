import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import {
  Play, Star, Plus, Trophy, Flame, BookOpen,
  History, ArrowRight, CheckCircle, XCircle,
  Loader2, AlertCircle, ChevronRight
} from 'lucide-react';
import { getUserProfile } from '../services/userService';
import {
  getUserPuzzleStats,
  getPuzzlesGroupedByOpening,
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

  const firstName = user?.displayName?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'Player';

  const loadAll = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError(null);
    try {
      // Load profile + stats together — these are the most critical
      const [profile, stats] = await Promise.all([
        getUserProfile(user.uid),
        getUserPuzzleStats(user.uid),
      ]);
      setUserProfile(profile);
      setPuzzleStats(stats);
    } catch (e) {
      console.error('Critical dashboard load error (profile/stats):', e);
      setError('Failed to load your profile. Please refresh.');
      setLoading(false);
      return; // Stop here if profile fails
    }

    // Load remaining data independently — errors are non-fatal
    const [groups, logs, favs, count] = await Promise.allSettled([
      getPuzzlesGroupedByOpening(user.uid, 4),
      getRecentlyAttemptedPuzzles(user.uid, 5),
      getFavoritePuzzles(user.uid),
      getNewPuzzleCount(user.uid),
    ]);

    if (groups.status === 'fulfilled') setPlaylists(groups.value);
    if (logs.status === 'fulfilled') setHistory(logs.value);
    if (favs.status === 'fulfilled') setFavorites(favs.value.slice(0, 3));
    if (count.status === 'fulfilled') setNewCount(count.value);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      const timer = setTimeout(() => {
        loadAll();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user, loadAll]);

  // ─── Mastery badge colour ───────────────────────────────────────────────────
  const masteryColor = {
    Expert: 'text-yellow-400 bg-yellow-400/10',
    Advanced: 'text-blue-400 bg-blue-400/10',
    Intermediate: 'text-green-400 bg-green-400/10',
    Novice: 'text-chess-text-secondary bg-white/5',
  };

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

      {/* ── Welcome ──────────────────────────────────────────────────────────── */}
      <div className="mb-10">
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
            All puzzles reviewed! <span className="text-chess-accent font-bold">Analyze more games</span> to generate new ones.
          </p>
        )}
      </div>

      {/* ── Stats Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

        {/* Total Solved */}
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Total Puzzles Solved</h3>
          <div className="text-4xl font-bold text-white mb-2">
            {loading ? <Loader2 size={28} className="animate-spin text-chess-accent" /> : (userProfile?.stats?.totalSolved ?? 0).toLocaleString()}
          </div>
          <div className="text-chess-text-secondary text-sm">
            {loading ? '—' : `${puzzleStats?.total ?? 0} total puzzles in deck`}
          </div>
        </div>

        {/* Current Streak */}
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Current Streak</h3>
          <div className="text-4xl font-bold text-white mb-2">
            {loading ? <Loader2 size={28} className="animate-spin text-chess-accent" /> : `${userProfile?.stats?.streak ?? 0} Days`}
          </div>
          <div className="text-sm text-chess-text-secondary">
            {loading ? '—' : 'Consecutive days on Chess-OP'}
          </div>
        </div>

        {/* Resume Training CTA */}
        <div
          onClick={() => navigate('/dashboard/train')}
          className="bg-gradient-to-br from-chess-accent to-chess-accent/80 p-6 rounded-2xl relative overflow-hidden text-white shadow-lg shadow-chess-accent/20 cursor-pointer hover:shadow-chess-accent/40 hover:-translate-y-0.5 transition-all"
        >
          <h3 className="text-white/90 text-sm font-medium mb-1">Quick Start</h3>
          <div className="text-2xl font-bold mb-4">Resume Training</div>
          <button className="bg-white text-chess-accent px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-white/90 transition-colors">
            <Play size={16} fill="currentColor" /> Continue Session
          </button>
        </div>
      </div>

      {/* ── Main Grid ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT: Playlists + History */}
        <div className="lg:col-span-2 space-y-8">

          {/* Active Playlists */}
          <section>
            <div className="flex items-center justify-between mb-4">
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
            ) : playlists.length === 0 ? (
              /* Empty State */
              <div className="bg-chess-panel border border-dashed border-white/10 rounded-xl p-10 text-center">
                <BookOpen size={40} className="text-chess-text-secondary mx-auto mb-3 opacity-50" />
                <p className="text-white font-medium mb-1">No playlists yet</p>
                <p className="text-chess-text-secondary text-sm mb-4">Analyze your games to generate your first puzzle set.</p>
                <button
                  onClick={() => navigate('/dashboard/analyze')}
                  className="bg-chess-accent text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-chess-accent/90 transition-colors"
                >
                  Analyze My Games
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {playlists.map((pl, i) => (
                  <div
                    key={i}
                    onClick={() => navigate('/dashboard/repertoire')}
                    className="bg-chess-panel border border-white/5 p-5 rounded-xl hover:border-chess-accent/50 transition-all cursor-pointer group hover:-translate-y-0.5"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 bg-chess-accent/10 rounded-lg flex items-center justify-center text-chess-accent">
                        <BookOpen size={20} />
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${masteryColor[pl.mastery] ?? masteryColor.Novice}`}>
                        {pl.mastery}
                      </span>
                    </div>
                    <h3 className="text-white font-bold mb-1 group-hover:text-chess-accent transition-colors truncate" title={pl.title}>
                      {pl.title}
                    </h3>
                    <p className="text-sm text-chess-text-secondary mb-4">
                      {pl.total} puzzle{pl.total !== 1 ? 's' : ''} · {pl.solved} solved
                    </p>
                    <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-chess-accent h-full rounded-full transition-all duration-700"
                        style={{ width: `${pl.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-chess-text-secondary mt-1 text-right">{pl.progress}%</p>
                  </div>
                ))}

                {/* Add more CTA if space */}
                {playlists.length < 4 && (
                  <div
                    onClick={() => navigate('/dashboard/analyze')}
                    className="border border-dashed border-white/10 p-5 rounded-xl flex flex-col items-center justify-center text-chess-text-secondary hover:border-chess-accent/50 hover:text-chess-accent transition-colors cursor-pointer min-h-[160px]"
                  >
                    <Plus size={32} className="mb-2" />
                    <span className="font-medium text-sm">Analyze More Games</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Recent History */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History size={20} className="text-chess-text-secondary" /> Recent History
              </h2>
              <button className="text-sm text-chess-text-secondary hover:text-white transition-colors">View All</button>
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
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Star size={20} className="text-yellow-400" /> Favorites
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
                          {puzzle.theme || 'Opening Blunder'} · {puzzle.status}
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
                    onClick={() => navigate('/dashboard/repertoire')}
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
    </DashboardLayout>
  );
}