import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Crosshair, Swords, Cpu, ArrowRight, Wand2, LineChart } from 'lucide-react';

const Landing = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-chess-bg text-chess-text-primary font-sans selection:bg-brand-light selection:text-brand-dark overflow-hidden relative">

            {/* Live Chess Background - Tactical Grid (Engine HUD Style) */}
            <div className="absolute inset-0 pointer-events-none z-0">

                {/* Base Gradient - Deep & Serious */}
                <div className="absolute inset-0 bg-radial-gradient from-chess-bg via-chess-bg to-[#020617]" />

                {/* Animated Grid Lines - The "War Room" Feel */}
                <div className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)`,
                        backgroundSize: '80px 80px',
                        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
                    }}
                />

                {/* Floating 'Data Particles' - Calculation aesthetic */}
                <div className="absolute top-[10%] left-[20%] w-2 h-2 bg-chess-accent rounded-full animate-ping duration-[3000ms] opacity-20" />
                <div className="absolute top-[60%] right-[15%] w-1.5 h-1.5 bg-brand-light rounded-full animate-ping duration-[5000ms] opacity-20" />
                <div className="absolute bottom-[20%] left-[10%] w-3 h-3 bg-chess-status-success rounded-full animate-ping duration-[7000ms] opacity-10" />

                {/* Glows for depth */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-chess-accent/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-med/10 blur-[150px] rounded-full" />
            </div>

            {/* Navigation */}
            <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-chess-bg/95 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
                        {/* Icon Only Logo - Bigger & Closer */}
                        <img src="/logo/Logo-icon.png" alt="Chess-OP" className="h-16 w-16 object-contain drop-shadow-lg group-hover:scale-110 transition-transform duration-300" />
                        <span className="text-3xl font-serif font-bold text-white tracking-wide group-hover:text-chess-accent transition-colors ml-1">
                            Chess<span className="text-chess-accent">-OP</span>
                        </span>
                    </div>

                    {/* Main Action Button - Blue/Brand Theme */}
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/login')}
                            className="group relative px-8 py-3 bg-chess-accent text-white font-bold rounded-lg overflow-hidden transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:-translate-y-0.5"
                        >
                            <span className="relative flex items-center gap-2">
                                Start Training <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-48 pb-24 lg:pt-64 lg:pb-40 z-10">
                <div className="max-w-7xl mx-auto px-6 text-center">

                    {/* Impact Headline */}
                    <h1 className="text-5xl lg:text-7xl font-serif font-bold leading-tight mb-8 drop-shadow-2xl tracking-tight">
                        Turn Your Blunders Into <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-light via-white to-chess-accent">
                            Relentless Mastery.
                        </span>
                    </h1>

                    {/* Value Proposition */}
                    <p className="text-xl text-chess-text-secondary max-w-3xl mx-auto mb-14 leading-relaxed font-light">
                        Generic tactics don't work. We analyze your actual games to build a <span className="text-brand-light font-medium">Personalized Punishment Library</span>.
                        Target the exact mistakes your opponents make against <strong>you</strong>.
                    </p>

                    {/* Primary Call to Action */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <button
                            onClick={() => navigate('/login')}
                            className="px-10 py-5 bg-white/5 hover:bg-white/10 text-white border border-chess-accent/50 rounded-xl font-bold text-xl transition-all shadow-2xl shadow-chess-accent/10 hover:shadow-chess-accent/30 hover:-translate-y-1 flex items-center gap-3 backdrop-blur-md"
                        >
                            <Wand2 size={28} className="text-chess-accent" />
                            Analyze My Games
                        </button>
                    </div>
                </div>
            </div>

            {/* Features Grid - High End Cards */}
            <div className="py-24 bg-brand-dark/40 border-t border-brand-light/5 relative z-10 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-20">
                        <h2 className="text-4xl font-serif font-bold text-brand-light mb-4">Strategic Optimization System</h2>
                        <div className="w-32 h-1.5 bg-gradient-to-r from-transparent via-chess-accent to-transparent mx-auto rounded-full mb-6" />
                        <p className="text-chess-text-secondary text-lg">Engineered Framework for Performance Enhancement.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Feature 1: Precision Audit */}
                        <div className="p-8 rounded-3xl bg-chess-panel/80 border border-white/5 hover:border-chess-accent/30 transition-all hover:-translate-y-2 hover:shadow-2xl group relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-chess-accent/5 rounded-bl-[100px] -mr-8 -mt-8 transition-all group-hover:bg-chess-accent/10" />

                            <div className="w-16 h-16 bg-brand-dark rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg border border-white/10 relative z-10">
                                <Crosshair className="text-chess-accent" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-brand-light mb-3 relative z-10 whitespace-nowrap">Precision Audit</h3>
                            <p className="text-chess-text-secondary text-sm leading-relaxed relative z-10">
                                Isolate specific move sequences where your probability of victory dropped. We filter noise to focus purely on critical decision failures.
                            </p>
                        </div>

                        {/* Feature 2: Dynamic Repertoire (Fixed: whitespace-nowrap) */}
                        <div className="p-8 rounded-3xl bg-chess-panel/80 border border-white/5 hover:border-chess-status-warning/30 transition-all hover:-translate-y-2 hover:shadow-2xl group relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-chess-status-warning/5 rounded-bl-[100px] -mr-8 -mt-8 transition-all group-hover:bg-chess-status-warning/10" />

                            <div className="w-16 h-16 bg-brand-dark rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg border border-white/10 relative z-10">
                                <BookOpen className="text-chess-status-warning" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-brand-light mb-3 relative z-10 whitespace-nowrap">Dynamic Repertoire</h3>
                            <p className="text-chess-text-secondary text-sm leading-relaxed relative z-10">
                                Construct a living opening book based on your actual gameplay patterns. Automatically catalog new lines as you encounter them.
                            </p>
                        </div>

                        {/* Feature 3: Tactical Refutation */}
                        <div className="p-8 rounded-3xl bg-chess-panel/80 border border-white/5 hover:border-chess-status-error/30 transition-all hover:-translate-y-2 hover:shadow-2xl group relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-chess-status-error/5 rounded-bl-[100px] -mr-8 -mt-8 transition-all group-hover:bg-chess-status-error/10" />

                            <div className="w-16 h-16 bg-brand-dark rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg border border-white/10 relative z-10">
                                <Swords className="text-chess-status-error" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-brand-light mb-3 relative z-10 whitespace-nowrap">Tactical Refutation</h3>
                            <p className="text-chess-text-secondary text-sm leading-relaxed relative z-10">
                                Train to punish the specific psychological and tactical errors humans make against you, rather than memorizing dry engine lines.
                            </p>
                        </div>

                        {/* Feature 4: Hybrid Engine */}
                        <div className="p-8 rounded-3xl bg-chess-panel/80 border border-white/5 hover:border-chess-status-success/30 transition-all hover:-translate-y-2 hover:shadow-2xl group relative overflow-hidden backdrop-blur-sm">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-chess-status-success/5 rounded-bl-[100px] -mr-8 -mt-8 transition-all group-hover:bg-chess-status-success/10" />

                            <div className="w-16 h-16 bg-brand-dark rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg border border-white/10 relative z-10">
                                <Cpu className="text-chess-status-success" size={32} />
                            </div>
                            <h3 className="text-2xl font-bold text-brand-light mb-3 relative z-10 whitespace-nowrap">Hybrid Engine</h3>
                            <p className="text-chess-text-secondary text-sm leading-relaxed relative z-10">
                                Powered by Stockfish 16 running locally in your browser. Zero latency, infinite depth, and complete privacy for all analysis.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Landing;
