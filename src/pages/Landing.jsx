import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    BookOpen, 
    Crosshair, 
    Swords, 
    Cpu, 
    ArrowRight, 
    Wand2, 
    HelpCircle, 
    ChevronDown, 
    AlertTriangle, 
    Trophy, 
    Flame, 
    Search, 
    Check, 
    Info,
    LineChart,
    Shield
} from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);

    // Feature Carousel states
    const [activeSlide, setActiveSlide] = useState(0);
    const [itemsPerView, setItemsPerView] = useState(3);

    const features = [
        {
            icon: <Crosshair className="text-chess-accent" size={32} />,
            title: "Precision Auditing",
            description: "Scan your Lichess matches (Rapid, Blitz, Classical) in seconds to isolate critical centipawn evaluation drops outside opening theory.",
            badge: "Lichess API"
        },
        {
            icon: <Cpu className="text-emerald-400" size={32} />,
            title: "Local Stockfish Engine",
            description: "Analyze games using Stockfish running locally in your browser. Zero server lag, adjustable search depth, and absolute privacy.",
            badge: "Stockfish WASM"
        },
        {
            icon: <BookOpen className="text-amber-400" size={32} />,
            title: "Spaced Repetition System",
            description: "Leitner-style scheduling queue. Puzzles you fail are reviewed tomorrow; correct solves unlock longer review intervals.",
            badge: "Leitner System"
        },
        {
            icon: <Swords className="text-indigo-400" size={32} />,
            title: "Interactive Training Arena",
            description: "Practice positions with real-time green/red move indicators, piece highlights (hints), show solution refutations, and automatic streak tracking.",
            badge: "Active Learning"
        },
        {
            icon: <LineChart className="text-rose-400" size={32} />,
            title: "Blunder Heatmaps",
            description: "Visualise your weaknesses on a heatmap grid mapping exactly which squares, pieces, and openings you blunder on most.",
            badge: "Visual Analytics"
        },
        {
            icon: <HelpCircle className="text-sky-400" size={32} />,
            title: "Repertoire & Playlists",
            description: "Organise blunders into custom opening decks (up to 3 playlists + separate Favorites), filter by side or status, and monitor live mastery progress.",
            badge: "Playlist Manager"
        },
        {
            icon: <Wand2 className="text-purple-400" size={32} />,
            title: "Manual PGN Ingestion",
            description: "Analyze custom games from Chess.com or OTB tournaments. Paste raw PGN text directly to extract puzzles in seconds.",
            badge: "Manual Import"
        },
        {
            icon: <Trophy className="text-orange-400" size={32} />,
            title: "Custom Board & Piece Themes",
            description: "Customize your training experience with multiple high-contrast board color themes and beautiful minimalist piece sets.",
            badge: "Personalization"
        }
    ];

    const maxSlideIndex = features.length - itemsPerView;
    const currentSlide = Math.min(activeSlide, maxSlideIndex);

    // Adjust items per view on screen resize
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) setItemsPerView(3);
            else if (window.innerWidth >= 768) setItemsPerView(2);
            else setItemsPerView(1);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-rotation timer - runs continuously every 5 seconds, resetting on activeSlide change to ensure a full 5s on the new slide
    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide((prev) => {
                const limit = 8 - itemsPerView;
                return prev >= limit ? 0 : prev + 1;
            });
        }, 5000);
        return () => clearInterval(timer);
    }, [activeSlide, itemsPerView]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        handleScroll();
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Premium custom smooth scroll to top
    const smoothScrollToTop = () => {
        const duration = 1200;
        const start = window.scrollY || document.documentElement.scrollTop;
        const startTime = performance.now();

        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        };

        const scroll = (timestamp) => {
            const time = Math.min(1, (timestamp - startTime) / duration);
            const easedTime = easeInOutCubic(time);
            window.scrollTo(0, Math.ceil(easedTime * (0 - start) + start));

            if (time < 1) {
                requestAnimationFrame(scroll);
            }
        };

        requestAnimationFrame(scroll);
    };

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const toggleFaq = (index) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const faqItems = [
        {
            question: "How does Chess-OP generate puzzles?",
            answer: "We fetch your recent games from Lichess, parse your moves, and run them through Stockfish. If the evaluation drops by more than 1.0 centipawn outside of standard opening book moves, we extract the position as a training puzzle."
        },
        {
            question: "Is Chess-OP free to use?",
            answer: "Yes! Chess-OP is completely free and runs entirely in your web browser. Analysis and chess engines run locally on your device, which keeps the service fast, secure, and free."
        },
        {
            question: "Can I import custom PGNs?",
            answer: "Absolutely. You can copy and paste raw PGN text from Chess.com, over-the-board tournament games, or custom engines directly into our manual PGN analyzer."
        },
        {
            question: "How does the Spaced Repetition System (SRS) work?",
            answer: "Chess-OP utilizes a Leitner-style system. Puzzles you solve correctly are scheduled for review at increasing intervals (1 day, 3 days, 7 days, etc.). Puzzles you fail are immediately reset and scheduled for review tomorrow."
        },
        {
            question: "Is my data secure?",
            answer: "Yes. Your game history, settings, and custom playlists are securely stored in your personal account via Google Firebase. No third parties ever have access to your database."
        }
    ];



    return (
        <div className="min-h-screen bg-chess-bg text-chess-text-primary font-sans selection:bg-brand-light selection:text-brand-dark flex flex-col justify-between relative overflow-x-hidden">

            {/* Live Chess Background - Tactical Grid (Engine HUD Style) */}
            {/* Added overflow-hidden to prevent absolute child glows from stretching document scroll height */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                {/* Base Gradient - Deep & Serious */}
                <div className="absolute inset-0 bg-gradient-to-b from-chess-bg via-chess-bg to-[#020617]" />

                {/* Animated Grid Lines - Optimized opacity with no maskImage to eliminate scrolling lag */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)`,
                        backgroundSize: '80px 80px',
                    }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-chess-bg via-transparent to-chess-bg opacity-80" />

                {/* Glows for depth - positioned with transforms to prevent height leaks */}
                <div className="absolute top-0 left-0 w-[40%] h-[40%] bg-chess-accent/10 blur-[150px] rounded-full -translate-x-1/4 -translate-y-1/4" />
                <div className="absolute bottom-0 right-0 w-[50%] h-[50%] bg-brand-med/5 blur-[150px] rounded-full translate-x-1/4 translate-y-1/4" />
            </div>

            {/* Content Container */}
            <div className="w-full flex-1 flex flex-col relative z-10">
                {/* Navigation */}
                <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-chess-bg/95 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'}`}>
                    <div className="max-w-7xl mx-auto px-6 h-20 lg:h-24 flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={smoothScrollToTop}>
                            <img src="/logo/Logo-icon.png" alt="Chess-OP" className="h-12 w-12 lg:h-16 lg:w-16 object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300" />
                            <span className="text-2xl lg:text-3xl font-serif font-bold text-white tracking-wide group-hover:text-chess-accent transition-colors ml-1">
                                Chess<span className="text-chess-accent">-OP</span>
                            </span>
                        </div>

                        {/* Navigation Links */}
                        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-chess-text-secondary">
                            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Features</button>
                            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors cursor-pointer">How It Works</button>
                            <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors cursor-pointer">FAQ</button>
                        </div>

                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => navigate('/login')}
                                className="group relative px-6 py-2.5 lg:px-8 lg:py-3 bg-chess-accent text-white font-bold rounded-lg overflow-hidden transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)] hover:-translate-y-0.5 cursor-pointer"
                            >
                                <span className="relative flex items-center gap-2 text-xs lg:text-sm">
                                    Start Training <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </span>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Hero Section */}
                <section className="relative pt-36 pb-16 lg:pt-48 lg:pb-32 z-10 px-6">
                    <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
                        {/* Hero Text */}
                        <div className="lg:col-span-7 text-center lg:text-left space-y-6 lg:space-y-8">
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold leading-tight drop-shadow-2xl tracking-tight text-white">
                                Turn Your Blunders Into <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-light via-white to-chess-accent">
                                    Relentless Mastery.
                                </span>
                            </h1>
                            <p className="text-base sm:text-lg lg:text-xl text-chess-text-secondary max-w-2xl mx-auto lg:mx-0 leading-relaxed font-light">
                                Generic chess puzzles won't help you fix your own habits. We automatically scan your Lichess matches, extract your actual blunders, and build a <strong>personalized study library</strong>.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="w-full sm:w-auto px-8 py-4 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-chess-accent/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Wand2 size={20} />
                                    Analyse My Games
                                </button>
                            </div>
                            <p className="text-xs text-chess-text-secondary/70 flex items-center justify-center lg:justify-start gap-1.5">
                                <Info size={14} className="text-chess-accent shrink-0" />
                                100% Free & Browser-Based. No credit card required.
                            </p>
                        </div>

                        {/* Hero Graphic - Static High-Fidelity Training Arena Screenshot */}
                        <div className="lg:col-span-5 flex justify-center">
                            <div className="w-full max-w-[420px] select-none relative animate-in fade-in slide-in-from-bottom-8 duration-1000 p-4 bg-chess-panel/75 rounded-[32px] border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.7)] backdrop-blur-sm">
                                <img 
                                    src="/images/hero-board.png" 
                                    alt="Chess-OP Training Arena Board" 
                                    className="w-full h-auto rounded-[20px] border border-white/5"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Slider / Carousel Section */}
                <section 
                    id="features" 
                    className="py-20 bg-brand-dark/30 border-t border-brand-light/5 px-6 scroll-mt-20"
                >
                    <div className="max-w-7xl mx-auto space-y-12">
                        <div className="space-y-4 text-center md:text-left">
                            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white">Smarter Chess Training</h2>
                            <div className="w-24 h-1 bg-gradient-to-r from-chess-accent to-transparent rounded-full md:mx-0 mx-auto" />
                            <p className="text-chess-text-secondary text-sm sm:text-base max-w-xl">
                                We've engineered an optimized loop to target, isolate, and eliminate your recurring blunders.
                            </p>
                        </div>

                        {/* Sliding Grid Container */}
                        <div className="relative overflow-hidden w-full py-4">
                            <div 
                                className="flex transition-transform duration-500 ease-in-out -mx-3"
                                style={{
                                    transform: `translate3d(-${currentSlide * (100 / itemsPerView)}%, 0, 0)`,
                                }}
                            >
                                {features.map((f, idx) => (
                                    <div 
                                        key={idx} 
                                        className="w-full md:w-1/2 lg:w-1/3 shrink-0 px-3"
                                    >
                                         <div className="p-8 rounded-3xl bg-gradient-to-br from-[#1e293b]/70 to-[#0f172a]/95 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgba(56,189,248,0.1)] hover:border-chess-accent/30 transition-all duration-300 group relative overflow-hidden h-full flex flex-col justify-between space-y-6">
                                            {/* Ambient glow effect inside card on hover */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-chess-accent/0 via-chess-accent/[0.02] to-chess-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                            
                                            <div className="space-y-4 relative z-10">
                                                 <div className="w-12 h-12 bg-gradient-to-br from-white/5 to-white/[0.02] rounded-2xl flex items-center justify-center border border-white/10 shadow-lg relative z-10 shrink-0 group-hover:border-chess-accent/30 group-hover:bg-white/10 transition-all duration-300">
                                                     <div className="transition-transform duration-300">
                                                         {f.icon}
                                                     </div>
                                                 </div><h3 className="text-xl font-bold text-white tracking-wide">{f.title}</h3>
                                                <p className="text-chess-text-secondary text-xs sm:text-sm leading-relaxed font-light">
                                                    {f.description}
                                                </p>
                                            </div>

                                            <span className="text-[10px] uppercase font-bold tracking-widest text-chess-accent bg-chess-accent/10 border border-chess-accent/20 px-2.5 py-1 rounded-lg w-fit relative z-10">
                                                {f.badge}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Controls under carousel */}
                        <div className="flex flex-col items-center gap-6 pt-4">
                            {/* Bullet Indicators */}
                            <div className="flex items-center justify-center gap-2">
                                {Array.from({ length: maxSlideIndex + 1 }).map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setActiveSlide(idx);
                                        }}
                                        className={`rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-chess-accent w-8 h-2' : 'bg-slate-700 w-2 h-2 hover:bg-slate-600'}`}
                                        title={`Go to slide ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works Section */}
                <section id="how-it-works" className="py-20 border-t border-brand-light/5 px-6 scroll-mt-20 space-y-24">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center space-y-4 mb-16">
                            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white">How It Works</h2>
                            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-chess-accent to-transparent mx-auto rounded-full" />
                            <p className="text-chess-text-secondary text-sm sm:text-base max-w-xl mx-auto">
                                Building a personalized Chess repertoire from your own games has never been this simple.
                            </p>
                        </div>

                        {/* Alternate Section 1: Text Left, Mockup Right */}
                        <div className="grid lg:grid-cols-12 gap-12 items-center">
                            <div className="lg:col-span-6 space-y-6">
                                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white">Build a Custom Study Repertoire</h3>
                                <p className="text-chess-text-secondary text-sm sm:text-base leading-relaxed font-light">
                                    Stray from standard opening books and focus on what you actually play. Organise openings into custom playlists and monitor your progress:
                                </p>
                                <ul className="space-y-3.5 text-sm text-chess-text-secondary">
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-chess-accent/15 border border-chess-accent/25 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-chess-accent" strokeWidth={3} />
                                        </div>
                                        Organise puzzles into 3 custom opening playlist decks
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-chess-accent/15 border border-chess-accent/25 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-chess-accent" strokeWidth={3} />
                                        </div>
                                        Search and filter positions inside playlists dynamically
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-chess-accent/15 border border-chess-accent/25 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-chess-accent" strokeWidth={3} />
                                        </div>
                                        Observe live mastery and progress updates on every action
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-chess-accent/15 border border-chess-accent/25 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-chess-accent" strokeWidth={3} />
                                        </div>
                                        Rename and move puzzles between decks instantly
                                    </li>
                                </ul>
                            </div>

                            {/* Repertoire Playlist Mockup */}
                            <div className="lg:col-span-6 flex justify-center">
                                <div className="w-full max-w-sm bg-chess-panel border border-white/5 p-6 rounded-3xl shadow-2xl space-y-4 select-none relative animate-in fade-in duration-700">
                                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">My Repertoire</h4>
                                        <span className="text-[10px] bg-chess-accent/15 text-chess-accent font-bold px-2.5 py-0.5 rounded-lg border border-chess-accent/20">3 / 3 Decks</span>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-chess-accent/15 text-chess-accent rounded-lg">
                                                    <BookOpen size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-bold text-white">Caro-Kann Defense</div>
                                                    <div className="text-[9px] text-chess-text-secondary">14 Puzzles</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] font-bold text-emerald-400">75% Mastery</span>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between opacity-80">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white/5 text-white/40 rounded-lg">
                                                    <BookOpen size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-[11px] font-bold text-white/70">Sicilian Defense</div>
                                                    <div className="text-[9px] text-chess-text-secondary">22 Puzzles</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] font-bold text-white/50">40% Mastery</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-black/20 p-2.5 rounded-xl flex items-center gap-2 border border-white/5">
                                        <Search size={12} className="text-chess-text-secondary" />
                                        <span className="text-[9px] text-chess-text-secondary font-medium">Search: Caro-Kann...</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Alternate Section 2: Mockup Left, Text Right */}
                        <div className="grid lg:grid-cols-12 gap-12 items-center pt-12">
                            {/* Stats & Toast Mockup */}
                            <div className="lg:col-span-6 flex justify-center order-last lg:order-first">
                                <div className="w-full max-w-sm bg-chess-panel border border-white/5 p-6 rounded-3xl shadow-2xl space-y-4 select-none relative animate-in fade-in duration-700">
                                    <div className="flex justify-between items-center pb-3 border-b border-white/5">
                                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Training Stats</h4>
                                        <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                                            <Check size={9} strokeWidth={3} /> Active Session
                                        </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-white/5 rounded-xl flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/5 rounded-md text-chess-accent">
                                                <Trophy size={14} />
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-white leading-none">8</div>
                                                <div className="text-[8px] text-chess-text-secondary mt-0.5">Solved</div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-white/5 rounded-xl flex items-center gap-2.5">
                                            <div className="p-1.5 bg-white/5 rounded-md text-orange-400">
                                                <Flame size={14} />
                                            </div>
                                            <div>
                                                <div className="text-base font-bold text-green-400 leading-none">5</div>
                                                <div className="text-[8px] text-chess-text-secondary mt-0.5">Streak</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Toast warning element */}
                                    <div className="bg-[#131a2e] border border-rose-500/30 text-rose-450 text-[10px] py-2.5 px-3.5 rounded-xl flex items-center gap-2 font-bold shadow-md animate-pulse">
                                        <AlertTriangle className="text-rose-455 shrink-0" size={12} />
                                        <span>Careful! You repeated your exact blunder.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Text Right */}
                            <div className="lg:col-span-6 space-y-6">
                                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white">Interactive Training Arena</h3>
                                <p className="text-chess-text-secondary text-sm sm:text-base leading-relaxed font-light">
                                    Train your generated blunder library with instant feedback. Use helpers to learn opening lines and refutations:
                                </p>
                                <ul className="space-y-3.5 text-sm text-chess-text-secondary">
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-emerald-400" strokeWidth={3} />
                                        </div>
                                        Piece hints to help guide you in difficult puzzles
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-emerald-400" strokeWidth={3} />
                                        </div>
                                        Correct vs blunder overlays (green and red markers)
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-emerald-400" strokeWidth={3} />
                                        </div>
                                        Interactive Try Again / Show Solution refutation helpers
                                    </li>
                                    <li className="flex items-center gap-3.5">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                            <Check size={12} className="text-emerald-400" strokeWidth={3} />
                                        </div>
                                        Streak calibration that resets instantly upon blunder/hint/solution
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section id="faq" className="py-20 border-t border-brand-light/5 bg-brand-dark/20 px-6 scroll-mt-20">
                    <div className="max-w-4xl mx-auto space-y-12">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white">Frequently Asked Questions</h2>
                            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-chess-accent to-transparent mx-auto rounded-full" />
                            <p className="text-chess-text-secondary text-sm sm:text-base">
                                Clarifying details on how the system manages your blunders.
                            </p>
                        </div>

                        {/* Accordion List */}
                        <div className="space-y-4">
                            {faqItems.map((item, idx) => {
                                const isOpen = openFaq === idx;
                                return (
                                    <div 
                                        key={idx} 
                                        className="bg-chess-panel border border-white/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-lg"
                                    >
                                        <button
                                            onClick={() => toggleFaq(idx)}
                                            className="w-full p-6 text-left flex justify-between items-center text-white font-bold text-sm sm:text-base hover:bg-white/[0.01] transition-colors cursor-pointer"
                                        >
                                            <span>{item.question}</span>
                                            <ChevronDown 
                                                size={18} 
                                                className={`text-chess-text-secondary transform transition-transform duration-300 ${isOpen ? 'rotate-180 text-chess-accent' : ''}`} 
                                            />
                                        </button>
                                        <div 
                                            className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-40 border-t border-white/5' : 'max-h-0'}`}
                                        >
                                            <div className="p-6 text-chess-text-secondary text-xs sm:text-sm leading-relaxed font-light">
                                                {item.answer}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Last Call to Action */}
                <section className="py-20 border-t border-brand-light/5 px-6 text-center relative overflow-hidden z-10 bg-radial-gradient from-chess-accent/5 to-transparent">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <span className="text-xs uppercase tracking-widest text-chess-accent font-extrabold">Calculated Repertoire Training</span>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-white leading-tight">
                            Ready to Eliminate Your Blunders?
                        </h2>
                        <p className="text-chess-text-secondary text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
                            Stop memorizing dry engine theories. Practice your real opening failures today.
                        </p>
                        <div className="pt-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-4 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-xl font-bold text-base transition-all shadow-lg hover:shadow-chess-accent/30 hover:-translate-y-0.5 flex items-center gap-2 mx-auto cursor-pointer"
                            >
                                Start Training Now <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer - Minimalist & Bounded */}
            <footer className="w-full bg-[#050b14] border-t border-white/5 px-6 py-8 relative z-20 shrink-0 select-none">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Logo - Static / Unclickable */}
                    <div className="flex items-center gap-2 select-none">
                        <img src="/logo/Logo-icon.png" alt="Chess-OP" className="h-10 w-10 object-contain drop-shadow-md" />
                        <span className="text-xl font-serif font-bold text-white tracking-wide">
                            Chess<span className="text-chess-accent">-OP</span>
                        </span>
                    </div>

                    {/* Copyright & minimal links */}
                    <div className="flex flex-col sm:flex-row sm:items-center items-center gap-4 sm:gap-8 text-xs text-chess-text-secondary font-medium">
                        <span>© {new Date().getFullYear()} Chess-OP. All rights reserved.</span>
                        <div className="flex items-center gap-4">
                            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Features</button>
                            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition-colors cursor-pointer">How It Works</button>
                            <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors cursor-pointer">FAQ</button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
