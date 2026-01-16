import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Play, CheckCircle, XCircle, Loader, ArrowRight, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { analyzeUserGames, quickAnalyze } from '../services/analysisOrchestrator';

export default function GameAnalysis() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [analyzing, setAnalyzing] = useState(false);
    const [progress, setProgress] = useState({ stage: '', progress: 0 });
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    const handleAnalyze = async (quick = false) => {
        setAnalyzing(true);
        setError(null);
        setResults(null);
        setProgress({ stage: 'Starting analysis...', progress: 0 });

        try {
            const analysisFunction = quick ? quickAnalyze : analyzeUserGames;

            const finalResults = await analysisFunction(user.uid, (progressUpdate) => {
                setProgress(progressUpdate);

                // If progress update includes results, store them
                if (progressUpdate.results) {
                    setResults(progressUpdate.results);
                }
            });

            setResults(finalResults);
        } catch (err) {
            console.error('Analysis failed:', err);
            setError(err.message);
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-serif font-bold text-white mb-2">Analyze My Games</h1>
                    <p className="text-chess-text-secondary">
                        Generate personalized training puzzles from your recent Lichess games
                    </p>
                </div>

                {/* Analysis Trigger Cards */}
                {!analyzing && !results && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Quick Analysis */}
                        <div className="bg-chess-panel border border-white/5 rounded-2xl p-6 hover:border-chess-accent/30 transition-colors">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-chess-accent/20 rounded-lg flex items-center justify-center">
                                    <Play className="text-chess-accent" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Quick Analysis</h3>
                                    <p className="text-sm text-chess-text-secondary">Analyze 1 recent game</p>
                                </div>
                            </div>
                            <p className="text-chess-text-secondary text-sm mb-4">
                                Perfect for testing. Analyzes your most recent game and generates puzzles quickly.
                            </p>
                            <button
                                onClick={() => handleAnalyze(true)}
                                className="w-full px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Play size={20} />
                                Quick Analyze
                            </button>
                        </div>

                        {/* Full Analysis */}
                        <div className="bg-gradient-to-br from-chess-accent/10 to-chess-accent/5 border border-chess-accent/30 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-chess-accent rounded-lg flex items-center justify-center">
                                    <Play className="text-white" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Full Analysis</h3>
                                    <p className="text-sm text-chess-accent">Analyze 10 recent games</p>
                                </div>
                            </div>
                            <p className="text-chess-text-secondary text-sm mb-4">
                                Deep dive into your recent games. Takes 2-5 minutes but generates more puzzles.
                            </p>
                            <button
                                onClick={() => handleAnalyze(false)}
                                className="w-full px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-chess-accent/20"
                            >
                                <Play size={20} />
                                Analyze 10 Games
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress Indicator */}
                {analyzing && (
                    <div className="bg-chess-panel border border-white/5 rounded-2xl p-8 mb-8">
                        <div className="flex items-center gap-4 mb-6">
                            <Loader className="text-chess-accent animate-spin" size={32} />
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Analyzing Your Games</h3>
                                <p className="text-chess-text-secondary">{progress.stage}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-chess-bg rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-chess-accent to-chess-accent-hover transition-all duration-300"
                                style={{ width: `${progress.progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-chess-text-secondary mt-2 text-right">
                            {Math.round(progress.progress)}%
                        </p>
                    </div>
                )}

                {/* Results */}
                {results && !analyzing && (
                    <div className="bg-chess-panel border border-white/5 rounded-2xl p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <CheckCircle className="text-chess-status-success" size={32} />
                            <h3 className="text-2xl font-bold text-white">Analysis Complete!</h3>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-chess-bg p-4 rounded-lg">
                                <p className="text-xs text-chess-text-secondary mb-1">Games Fetched</p>
                                <p className="text-2xl font-bold text-white">{results.gamesFetched}</p>
                            </div>
                            <div className="bg-chess-bg p-4 rounded-lg">
                                <p className="text-xs text-chess-text-secondary mb-1">Games Analyzed</p>
                                <p className="text-2xl font-bold text-chess-accent">{results.gamesAnalyzed}</p>
                            </div>
                            <div className="bg-chess-bg p-4 rounded-lg">
                                <p className="text-xs text-chess-text-secondary mb-1">Puzzles Generated</p>
                                <p className="text-2xl font-bold text-chess-status-success">{results.puzzlesGenerated}</p>
                            </div>
                            <div className="bg-chess-bg p-4 rounded-lg">
                                <p className="text-xs text-chess-text-secondary mb-1">Already Processed</p>
                                <p className="text-2xl font-bold text-chess-text-secondary">{results.gamesSkipped}</p>
                            </div>
                        </div>

                        {/* Errors */}
                        {results.errors && results.errors.length > 0 && (
                            <div className="bg-chess-status-error/10 border border-chess-status-error/30 rounded-lg p-4 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="text-chess-status-error" size={20} />
                                    <p className="text-chess-status-error font-bold">Some games failed to analyze</p>
                                </div>
                                <p className="text-xs text-chess-text-secondary">
                                    {results.errors.length} game(s) encountered errors during analysis
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex-1 px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                            >
                                <Home size={20} />
                                Go to Dashboard
                            </button>
                            <button
                                onClick={() => {
                                    setResults(null);
                                    setError(null);
                                }}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-colors"
                            >
                                Analyze More
                            </button>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && !analyzing && (
                    <div className="bg-chess-status-error/10 border border-chess-status-error/30 rounded-2xl p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <XCircle className="text-chess-status-error" size={32} />
                            <h3 className="text-2xl font-bold text-white">Analysis Failed</h3>
                        </div>
                        <p className="text-chess-text-secondary mb-6">{error}</p>
                        <button
                            onClick={() => setError(null)}
                            className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Info Section */}
                {!analyzing && !results && !error && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-3">How it works</h3>
                        <ul className="space-y-2 text-sm text-chess-text-secondary">
                            <li className="flex items-start gap-2">
                                <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                We fetch your recent games from Lichess using your linked account
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                Stockfish analyzes each move to find mistakes (blunders with CP loss ≥ 1.0)
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                Puzzles are generated from positions where you missed the best move
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                Your puzzle library maintains a 60-puzzle rotation (oldest deleted automatically)
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="text-chess-accent mt-0.5 shrink-0" size={16} />
                                Already analyzed games are skipped to save time (deduplication)
                            </li>
                        </ul>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
