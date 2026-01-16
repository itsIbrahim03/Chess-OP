import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    Bell
} from 'lucide-react';

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

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
        { icon: BookOpen, label: 'My Repertoire', path: '/dashboard/repertoire' },
        { icon: History, label: 'Game History', path: '/dashboard/history' },
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

    return (
        <div className="h-screen bg-chess-bg text-chess-text-primary font-sans flex overflow-hidden">

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
                            <span className="font-serif font-bold text-2xl text-white tracking-wide">
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-med to-brand-dark border border-white/10 flex items-center justify-center text-white font-bold text-sm shadow-inner shrink-0">
                                {user?.email?.[0].toUpperCase() || 'G'}
                            </div>

                            {sidebarOpen && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{user?.displayName || 'Player'}</p>
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
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                            <input
                                type="text"
                                placeholder="Search openings, players..."
                                className="bg-chess-panel border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-chess-accent w-64 transition-all text-white placeholder:text-chess-text-secondary"
                            />
                        </div>
                        <button className="relative p-2 hover:bg-white/5 rounded-full transition-colors">
                            <Bell size={20} className="text-chess-text-secondary hover:text-white" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-chess-status-error rounded-full" />
                        </button>
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
