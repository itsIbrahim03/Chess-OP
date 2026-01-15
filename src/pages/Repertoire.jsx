import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { BookOpen, Plus, Folder, MoreVertical, Search, Filter, Clock } from 'lucide-react';

export default function Repertoire() {

    const repertoires = [
        { id: 1, title: "Sicilian Defense: Najdorf", color: "Black", moves: 124, progress: 65, lastUpdated: "2 hours ago" },
        { id: 2, title: "Queen's Gambit Declined", color: "Black", moves: 48, progress: 32, lastUpdated: "1 day ago" },
        { id: 3, title: "Ruy Lopez: Berlin", color: "White", moves: 85, progress: 12, lastUpdated: "3 days ago" },
    ];

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-white mb-2">My Repertoire</h1>
                        <p className="text-chess-text-secondary">Manage your opening books and punishment lines.</p>
                    </div>
                    <button className="bg-chess-accent hover:bg-chess-accent-hover text-white px-5 py-2.5 rounded-lg font-bold shadow-lg shadow-chess-accent/20 flex items-center gap-2 transition-all hover:-translate-y-0.5">
                        <Plus size={20} /> Create New Book
                    </button>
                </div>

                {/* Filters & Search */}
                <div className="flex items-center gap-4 mb-6 bg-chess-panel border border-white/5 p-2 rounded-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                            type="text"
                            placeholder="Search your repertoires..."
                            className="w-full bg-transparent border-none focus:ring-0 text-white pl-10 pr-4 placeholder:text-chess-text-secondary"
                        />
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <button className="flex items-center gap-2 text-chess-text-secondary hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium">
                        <Filter size={16} /> Filters
                    </button>
                </div>

                {/* Repertoire Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* New Repertoire Card */}
                    <div className="border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-8 min-h-[200px] text-chess-text-secondary hover:border-chess-accent/50 hover:text-chess-accent hover:bg-chess-accent/5 transition-all cursor-pointer group">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 group-hover:bg-chess-accent/20 transition-colors">
                            <Plus size={32} />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Create Empty Book</h3>
                        <p className="text-sm opacity-60 text-center">Start from scratch or import PGN</p>
                    </div>

                    {/* Existing Repertoires */}
                    {repertoires.map((rep) => (
                        <div key={rep.id} className="bg-chess-panel border border-white/5 rounded-2xl p-6 relative group hover:border-chess-accent/30 transition-all hover:-translate-y-1 hover:shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rep.color === 'White' ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-200'}`}>
                                    <span className="text-2xl">♟</span>
                                </div>
                                <button className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all">
                                    <MoreVertical size={20} />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-chess-accent transition-colors">{rep.title}</h3>

                            <div className="flex items-center gap-4 text-xs text-chess-text-secondary mb-6">
                                <span className="flex items-center gap-1"><Folder size={14} /> {rep.moves} lines</span>
                                <span className="flex items-center gap-1"><Clock size={14} /> {rep.lastUpdated}</span>
                            </div>

                            {/* Progress */}
                            <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
                                <span>Mastery</span>
                                <span>{rep.progress}%</span>
                            </div>
                            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                <div className="bg-chess-accent h-full rounded-full transition-all duration-1000" style={{ width: `${rep.progress}%` }} />
                            </div>
                        </div>
                    ))}

                </div>
            </div>
        </DashboardLayout>
    );
}
