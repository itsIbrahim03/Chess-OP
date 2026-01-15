import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Play, Star, Clock, Plus, ArrowUpRight, Trophy, Flame, BookOpen, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  // Extract first name for greeting
  const firstName = user?.displayName?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'Player';

  // Dummy Data for UI Development
  const activePlaylists = [
    { id: 1, title: "Sicilian Defense: Najdorf", progress: 65, count: 124, mastery: "Expert" },
    { id: 2, title: "Queen's Gambit Declined", progress: 32, count: 48, mastery: "Novice" },
  ];

  const recentPuzzles = [
    // Using a static FEN for preview
    { id: 101, fen: "r1bqkb1r/pp2pppp/2n2n2/2p5/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 6", rating: 1450, theme: "Opening Blunder" },
    { id: 102, fen: "rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQ - 0 6", rating: 1600, theme: "Missed Win" },
  ];

  return (
    <DashboardLayout>

      {/* Welcome Section */}
      <div className="mb-10">
        <h1 className="text-3xl font-serif font-bold text-white mb-2">
          Good Evening, {firstName}
        </h1>
        <p className="text-chess-text-secondary">
          Ready to punish some blunders? You have <span className="text-chess-accent font-bold">12 new puzzles</span> waiting.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Total Puzzles Solved</h3>
          <div className="text-3xl font-bold text-white mb-2">1,284</div>
          <div className="text-chess-status-success text-sm flex items-center gap-1">
            <ArrowUpRight size={16} /> +24 this week
          </div>
        </div>
        <div className="bg-chess-panel border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Flame size={64} />
          </div>
          <h3 className="text-chess-text-secondary text-sm font-medium mb-1">Current Streak</h3>
          <div className="text-3xl font-bold text-white mb-2">12 Days</div>
          <div className="text-brand-med text-sm">Keep it up!</div>
        </div>
        <div className="bg-gradient-to-br from-chess-accent to-chess-accent/80 p-6 rounded-2xl relative overflow-hidden text-white shadow-lg shadow-chess-accent/20 cursor-pointer hover:shadow-chess-accent/40 transition-shadow">
          <h3 className="text-white/90 text-sm font-medium mb-1">Quick Start</h3>
          <div className="text-2xl font-bold mb-4">Resume Training</div>
          <button className="bg-white text-chess-accent px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
            <Play size={16} fill="currentColor" /> Continue Session
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Playlists & Favorites */}
        <div className="lg:col-span-2 space-y-8">

          {/* Active Playlists */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen size={20} className="text-chess-accent" /> Active Playlists
              </h2>
              <button className="text-sm text-chess-accent hover:text-white transition-colors flex items-center gap-1">
                <Plus size={16} /> New Playlist
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activePlaylists.map((playlist) => (
                <div key={playlist.id} className="bg-chess-panel border border-white/5 p-5 rounded-xl hover:border-chess-accent/50 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-brand-med/20 rounded-lg flex items-center justify-center text-chess-accent">
                      <BookOpen size={20} />
                    </div>
                    <span className="bg-white/5 text-xs font-medium px-2 py-1 rounded text-chess-text-secondary">{playlist.mastery}</span>
                  </div>
                  <h3 className="text-white font-bold mb-1 group-hover:text-chess-accent transition-colors">{playlist.title}</h3>
                  <p className="text-sm text-chess-text-secondary mb-4">{playlist.count} Puzzles</p>

                  {/* Progress Bar */}
                  <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-chess-accent h-full rounded-full" style={{ width: `${playlist.progress}%` }} />
                  </div>
                </div>
              ))}

              {/* Create New Card */}
              <div className="border border-dashed border-white/10 p-5 rounded-xl flex flex-col items-center justify-center text-chess-text-secondary hover:border-chess-accent/50 hover:text-chess-accent transition-colors cursor-pointer h-full min-h-[160px]">
                <Plus size={32} className="mb-2" />
                <span className="font-medium">Create Repertoire</span>
              </div>
            </div>
          </section>

          {/* Recent History */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History size={20} className="text-chess-text-secondary" /> Recent History
              </h2>
              <button className="text-sm text-chess-text-secondary hover:text-white transition-colors">View All</button>
            </div>

            <div className="bg-chess-panel border border-white/5 rounded-xl overflow-hidden">
              {[1, 2, 3].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-chess-status-success' : 'bg-chess-status-error'}`} />
                    <div>
                      <p className="text-white font-medium">Puzzle #{1000 + i}</p>
                      <p className="text-xs text-chess-text-secondary">Sicilian Defense • 10 mins ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${i === 0 ? 'text-chess-status-success' : 'text-chess-status-error'}`}>
                      {i === 0 ? '+12' : '-8'}
                    </p>
                    <p className="text-xs text-chess-text-secondary">1542 Elo</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Favorites & Quick Training */}
        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
              <Star size={20} className="text-chess-status-warning" /> Favorites
            </h2>
            <div className="space-y-4">
              {recentPuzzles.map((puzzle) => (
                <div key={puzzle.id} className="bg-chess-panel border border-white/5 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                  {/* Mini Board Preview */}
                  <div className="aspect-square w-full bg-black/20 relative pointer-events-none">
                    {/* <CustomChessboard fen={puzzle.fen} boardWidth={300} orientation="white" /> */}
                    <div className="absolute inset-0 bg-gradient-to-t from-chess-panel to-transparent opacity-50" />
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-white">
                      {puzzle.theme}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">{puzzle.rating}</span>
                      <button className="text-chess-accent text-xs font-medium hover:underline">Review</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </DashboardLayout>
  );
}