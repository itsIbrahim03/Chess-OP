import { useState, useEffect } from 'react';
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
    Brain
} from 'lucide-react';
import { getUserProfile } from '../services/userService';

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [profileData, setProfileData] = useState(null);

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
                        <h2 className="text-xl font-bold text-white hidden sm:block">Dashboard</h2>
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

            </main>
        </div>
    );
}
