import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';

export default function Toast({ message, type = 'success', duration = 3000, onClose, className = '' }) {
    useEffect(() => {
        if (!message) return;
        const timer = setTimeout(() => {
            if (onClose) onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [message, duration, onClose]);

    if (!message) return null;

    const config = {
        success: {
            bg: 'bg-slate-950/90 border-white/10 border-l-4 border-l-emerald-500 text-white',
            icon: <CheckCircle2 className="text-emerald-400 shrink-0 animate-bounce" size={18} />,
            shadow: 'shadow-emerald-500/5',
        },
        error: {
            bg: 'bg-slate-950/90 border-white/10 border-l-4 border-l-rose-500 text-white',
            icon: <AlertTriangle className="text-rose-400 shrink-0 animate-pulse" size={18} />,
            shadow: 'shadow-rose-500/5',
        },
        info: {
            bg: 'bg-slate-950/90 border-white/10 border-l-4 border-l-chess-accent text-white',
            icon: <Loader2 className="animate-spin text-chess-accent shrink-0" size={18} />,
            shadow: 'shadow-chess-accent/5',
        }
    };

    const current = config[type] || config.success;

    return (
        <div className={`fixed z-50 animate-slide-in-right ${className || 'bottom-6 right-6'}`}>
            <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${current.bg} ${current.shadow} backdrop-blur-md max-w-sm`}>
                {current.icon}
                <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-bold tracking-wide">{message}</p>
                </div>
                <button 
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
