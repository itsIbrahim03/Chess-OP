import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import {
    LayoutDashboard,
    BookOpen,
    History,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Search,
    Bell,
    Target,
    Brain,
    Sparkles,
    AlertCircle
} from 'lucide-react';
import { backgroundAnalysisService } from '../services/backgroundAnalysisService';
import IngestionWizard from './IngestionWizard';

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [profileData, setProfileData] = useState(null);

    // Background scan status states
    const [analysisState, setAnalysisState] = useState({
        isRunning: false,
        progress: { stage: '', progress: 0 },
        results: null,
        error: null
    });
    const [showToast, setShowToast] = useState(false);
    const [scanAlertToast, setScanAlertToast] = useState({ show: false, message: '', type: 'info' });
    const [showWizard, setShowWizard] = useState(false);
    const [isProgressCollapsed, setIsProgressCollapsed] = useState(false);
    const prevIsRunningRef = useRef(false);

    useEffect(() => {
        const unsubscribe = backgroundAnalysisService.subscribe((state) => {
            setAnalysisState(state);
        });
        return () => unsubscribe();
    }, []);

    // Expand progress card automatically when scanner starts running
    useEffect(() => {
        if (analysisState.isRunning) {
            setTimeout(() => setIsProgressCollapsed(false), 0);
        }
    }, [analysisState.isRunning]);

    useEffect(() => {
        const prevIsRunning = prevIsRunningRef.current;
        if (prevIsRunning && !analysisState.isRunning) {
            // Scanner just finished!
            if (analysisState.error) {
                setTimeout(() => {
                    setScanAlertToast({
                        show: true,
                        message: analysisState.error,
                        type: 'error'
                    });
                }, 0);
            } else if (analysisState.results && analysisState.results.puzzlesGenerated > 0) {
                if (location.pathname === '/dashboard/analysis-board') {
                    setTimeout(() => setShowWizard(true), 0);
                } else {
                    setTimeout(() => setShowToast(true), 0);
                }
            } else if (analysisState.results) {
                const res = analysisState.results;
                let msg = '';
                if (res.rawGamesFetched === 0) {
                    msg = "No recent games found on Lichess for this account within the selected timeframe. Try playing more games or change settings.";
                } else if (res.gamesFetched === 0) {
                    msg = `Fetched ${res.rawGamesFetched} game(s) from Lichess, but all were filtered out because ratings were below your ELO threshold (check Settings).`;
                } else if (res.gamesSkipped === res.gamesFetched && res.gamesFetched > 0) {
                    msg = `All ${res.gamesFetched} fetched game(s) have already been analyzed in previous scans.`;
                } else {
                    const analyzedCount = res.gamesAnalyzed || 0;
                    const skippedText = res.gamesSkipped > 0 ? ` (${res.gamesSkipped} skipped)` : '';
                    msg = `Scan complete. Analyzed ${analyzedCount} game(s)${skippedText} but no new blunder positions (eval loss ≥ 1.0) were found.`;
                }
                setTimeout(() => {
                    setScanAlertToast({ show: true, message: msg, type: 'info' });
                }, 0);
            }
        }
        prevIsRunningRef.current = analysisState.isRunning;
    }, [analysisState.isRunning, analysisState.results, analysisState.error, location.pathname]);

    // Auto-dismiss scanAlertToast after 8 seconds
    useEffect(() => {
        if (scanAlertToast.show) {
            const timer = setTimeout(() => {
                setScanAlertToast(prev => ({ ...prev, show: false }));
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [scanAlertToast.show]);

    // Listen to query parameters to open the wizard from other pages
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('review') === 'true') {
            setTimeout(() => setShowWizard(true), 0);
        } else {
            setTimeout(() => setShowWizard(false), 0);
        }
    }, [location.search]);

    useEffect(() => {
        if (!user?.uid) return;

        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (snapshot) => {
            if (snapshot.exists()) {
                setProfileData(snapshot.data());
            }
        }, (error) => {
            console.error("Error listening to profile changes:", error);
        });

        return () => unsubscribe();
    }, [user?.uid]);



    const FLAIR_MAP = {
        'king': '♔', 'queen': '♛', 'knight': '♞', 'rook': '♜', 'bishop': '♝',
        'pawn': '♟', 'trophy': '🏆', 'lightning': '⚡', 'fire': '🔥', 'brain': '🧠',
        'target': '🎯', 'star': '⭐', 'diamond': '💎', 'rocket': '🚀', 'shield': '🛡️',
    };
    const flairEmoji = profileData?.flair && profileData.flair !== 'none' ? FLAIR_MAP[profileData.flair] : null;

    // Persist sidebar state in localStorage
    const [sidebarOpen, setSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });

    // Save to localStorage when state changes
    const toggleSidebar = (value) => {
        setSidebarOpen(value);
        localStorage.setItem('sidebarOpen', JSON.stringify(value));
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/dashboard' },
        { icon: Brain, label: 'Analysis Manager', path: '/dashboard/analysis-board' },
        { icon: BookOpen, label: 'My Repertoire', path: '/dashboard/repertoire' },
        { icon: Target, label: 'Training Area', path: '/dashboard/train' },
        { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    ];

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error('Failed to log out', error);
        }
    };

    const selectedColor = { primary: '#38BDF8', hover: '#0EA5E9' };

    const getHeaderTitle = () => {
        switch (location.pathname) {
            case '/dashboard':
                return 'Dashboard';
            case '/dashboard/analysis-board':
                return 'Analysis Manager';
            case '/dashboard/repertoire':
                return 'My Repertoire';
            case '/dashboard/train':
                return 'Training Area';
            case '/dashboard/settings':
                return 'Settings';
            default:
                return 'Dashboard';
        }
    };

    return (
        <div className="h-screen bg-chess-bg text-chess-text-primary font-sans flex overflow-hidden">
            {/* Dynamic Accent Color Overrides */}
            <style>{`
                :root {
                    --chess-accent: ${selectedColor.primary} !important;
                    --chess-accent-hover: ${selectedColor.hover} !important;
                }
            `}</style>

            {/* Sidebar */}
            <aside
                className={`flex flex-col bg-chess-panel border-r border-white/5 transition-all duration-300 ease-in-out relative
                    ${sidebarOpen ? 'w-72' : 'w-20'}
                    hidden lg:flex
                `}
            >


                <div className="h-full flex flex-col w-full">
                    {/* Logo Area - Click to toggle sidebar */}
                    <div
                        onClick={() => toggleSidebar(!sidebarOpen)}
                        className={`h-24 flex items-center border-b border-white/5 transition-all cursor-pointer hover:bg-white/5 ${sidebarOpen ? 'gap-3 pl-8 pr-6' : 'justify-center'}`}
                    >
                        <img src="/logo/Logo-icon.png" alt="Logo" className={`object-contain transition-all ${sidebarOpen ? 'w-14 h-14' : 'w-12 h-12'}`} />
                        {sidebarOpen && (
                            <span className="font-serif font-bold text-3xl text-white tracking-wide">
                                Chess<span className="text-chess-accent">-OP</span>
                            </span>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 py-8 px-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <button
                                    key={item.path}
                                    onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                                    className={`w-full flex items-center p-3 rounded-xl transition-all group relative ${isActive
                                        ? 'bg-chess-accent text-white shadow-lg shadow-chess-accent/20'
                                        : 'text-chess-text-secondary hover:bg-white/5 hover:text-white'
                                        } ${!sidebarOpen && 'justify-center'}`}
                                >
                                    <item.icon size={24} className={`${isActive ? 'text-white' : 'text-chess-text-secondary group-hover:text-white'}`} style={{ minWidth: '24px' }} />

                                    {sidebarOpen && (
                                        <span className="ml-3 font-medium text-base truncate">{item.label}</span>
                                    )}

                                    {/* Tooltip for collapsed state */}
                                    {!sidebarOpen && (
                                        <div className="absolute left-full ml-4 px-3 py-1.5 bg-brand-dark text-white text-sm rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-white/10 shadow-xl">
                                            {item.label}
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t border-white/5">
                        <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
                            {profileData?.photoUrl || user?.photoURL ? (
                                <img src={profileData?.photoUrl || user?.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-white/10 object-cover shrink-0" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-med to-brand-dark border border-white/10 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
                                    {(profileData?.displayName || user?.displayName || user?.email)?.[0]?.toUpperCase() || 'G'}
                                </div>
                            )}

                            {sidebarOpen && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                                        {profileData?.country && (
                                            <img
                                                src={`https://flagcdn.com/w20/${profileData.country.toLowerCase() === 'uk' ? 'gb' : profileData.country.toLowerCase()}.png`}
                                                alt=""
                                                className="w-5 h-3.5 object-cover rounded-sm inline-block shrink-0 shadow-sm"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        )}
                                        <span className="truncate">{profileData?.displayName || user?.displayName || 'Player'}</span>
                                        {flairEmoji && <span className="ml-0.5 text-xs inline-block shrink-0">{flairEmoji}</span>}
                                    </p>
                                    <p className="text-xs text-chess-text-secondary truncate">{user?.email}</p>
                                </div>
                            )}

                            <button
                                onClick={handleLogout}
                                className={`p-2 rounded-lg text-chess-status-error/80 hover:text-chess-status-error hover:bg-chess-status-error/10 transition-colors ${!sidebarOpen && 'hidden'}`}
                                title="Sign Out"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                        {/* Collapsed Logout */}
                        {!sidebarOpen && (
                            <button
                                onClick={handleLogout}
                                className="w-full mt-2 p-2 flex justify-center rounded-lg text-chess-status-error/80 hover:text-chess-status-error hover:bg-chess-status-error/10 transition-colors"
                            >
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Mobile Sidebar (Overlay) */}
            {/* Note: Simplified mobile handling for now to focus on desktop request */}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

                {/* Top Header */}
                <header className="h-20 bg-chess-bg/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        {/* Mobile Toggle */}
                        <button className="p-2 hover:bg-white/5 rounded-lg lg:hidden text-white">
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-white hidden sm:block">{getHeaderTitle()}</h2>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Search and notification bell removed */}
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </div>

                {/* Status Progress Card (Down Right Corner) */}
                {analysisState.isRunning && (
                    <div 
                        onClick={() => setIsProgressCollapsed(true)}
                        className={`fixed bottom-6 right-6 z-[100] sm:w-[480px] w-[90vw] bg-chess-panel/98 border border-chess-accent/40 rounded-2xl p-7 shadow-2xl backdrop-blur-lg transition-all duration-500 ease-in-out cursor-pointer hover:border-chess-accent/60 ${
                            isProgressCollapsed ? 'translate-x-[calc(100%+32px)] opacity-0 pointer-events-none' : 'translate-x-0'
                        }`}
                        title="Click anywhere to minimize"
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-3">
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chess-accent opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-chess-accent"></span>
                                </span>
                                Scanning Games...
                            </h4>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-chess-accent/15 text-chess-accent font-bold px-3 py-1 rounded-lg border border-chess-accent/25">
                                    Stockfish Active
                                </span>
                                <button
                                    onClick={() => setIsProgressCollapsed(true)}
                                    className="p-1 rounded-lg text-chess-text-secondary hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                    title="Minimize Progress Card"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                        
                        <p className="text-sm text-chess-text-secondary font-medium truncate mb-4">
                            {analysisState.progress.stage || 'Initialising...'}
                        </p>
                        
                        <div className="w-full bg-black/50 rounded-full h-3.5 p-0.5 overflow-hidden border border-white/10 mb-3">
                            <div
                                className="h-full bg-gradient-to-r from-chess-accent to-emerald-450 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                                style={{ width: `${analysisState.progress.progress || 0}%` }}
                            />
                        </div>
                        
                        <div className="flex justify-between text-sm font-bold text-chess-text-secondary">
                            <span className="text-chess-accent">{Math.round(analysisState.progress.progress || 0)}% Done</span>
                            <span className="truncate max-w-[240px] text-right">
                                {analysisState.progress.currentGame ? `Game ID: ${analysisState.progress.currentGame}` : 'Preparing engine...'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Collapsed Progress Tab Indicator */}
                {analysisState.isRunning && isProgressCollapsed && (
                    <button
                        onClick={() => setIsProgressCollapsed(false)}
                        className="fixed bottom-12 right-0 z-[100] bg-chess-panel/98 border-y border-l border-chess-accent/40 rounded-l-2xl p-4 pl-3.5 shadow-2xl flex items-center gap-2.5 text-chess-accent hover:text-white hover:bg-chess-accent/10 transition-all cursor-pointer animate-in slide-in-from-right duration-300"
                        title="Expand Progress Card"
                    >
                        <div className="relative">
                            <ChevronLeft size={18} />
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chess-accent opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-chess-accent"></span>
                            </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-chess-text-secondary select-none">
                            Progress ({Math.round(analysisState.progress.progress || 0)}%)
                        </span>
                    </button>
                )}

                {/* Completion Toast Notification */}
                {showToast && (
                    <div
                        onClick={() => {
                            setShowWizard(true);
                            setShowToast(false);
                        }}
                        className="fixed bottom-6 right-6 z-[110] bg-chess-panel/90 border border-chess-accent/30 hover:border-chess-accent/60 p-4 rounded-2xl shadow-2xl flex items-center gap-4 cursor-pointer backdrop-blur-lg animate-in slide-in-from-bottom duration-300 max-w-sm group"
                    >
                        <div className="w-10 h-10 bg-chess-accent/15 border border-chess-accent/20 rounded-xl flex items-center justify-center text-chess-accent group-hover:scale-105 transition-transform shrink-0">
                            <Brain size={20} className="animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white mb-0.5">Analysis Complete!</h4>
                            <p className="text-[11px] text-chess-text-secondary leading-normal">
                                Click here to review and save your newly generated blunder puzzles.
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowToast(false);
                            }}
                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Scan Alert Toast Notification */}
                {scanAlertToast.show && (
                    <div
                        className={`fixed bottom-6 right-6 z-[110] bg-chess-panel/95 border ${
                            scanAlertToast.type === 'error' ? 'border-chess-status-error/40' : 'border-chess-accent/30'
                        } p-5 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md backdrop-blur-lg animate-in slide-in-from-bottom duration-300`}
                    >
                        <div className={`w-10 h-10 ${
                            scanAlertToast.type === 'error' ? 'bg-chess-status-error/15 text-chess-status-error' : 'bg-chess-accent/15 text-chess-accent'
                        } border ${
                            scanAlertToast.type === 'error' ? 'border-chess-status-error/25' : 'border-chess-accent/20'
                        } rounded-xl flex items-center justify-center shrink-0`}>
                            {scanAlertToast.type === 'error' ? <AlertCircle size={20} /> : <Sparkles size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white mb-0.5">
                                {scanAlertToast.type === 'error' ? 'Scan Error' : 'Scan Finished'}
                            </h4>
                            <p className="text-[11px] text-chess-text-secondary leading-normal">
                                {scanAlertToast.message}
                            </p>
                        </div>
                        <button
                            onClick={() => setScanAlertToast(prev => ({ ...prev, show: false }))}
                            className="text-chess-text-secondary hover:text-white p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Ingestion Wizard Modal */}
                {showWizard && (
                    <IngestionWizard
                        userId={user.uid}
                        onClose={() => {
                            if (location.search.includes('review')) {
                                navigate(location.pathname, { replace: true });
                            } else {
                                setShowWizard(false);
                            }
                        }}
                        onSaveSuccess={() => {
                            if (location.search.includes('review')) {
                                navigate(location.pathname, { replace: true });
                            }
                        }}
                    />
                )}

            </main>
        </div>
    );
}
