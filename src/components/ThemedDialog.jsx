import React, { useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

export default function ThemedDialog({
    open,
    title,
    message,
    type = 'info', // 'info' | 'success' | 'warning' | 'error' | 'confirm'
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm, // Callback on confirmation or alert OK click
    onCancel, // Callback on cancel click
    loading = false, // If confirming runs an async action
    onClose, // Optional close handler (dismiss button / backdrop)
}) {
    // Prevent background scrolling when dialog is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    if (!open) return null;

    // Type configuration mapping for layout styles and colors
    const typeConfig = {
        info: {
            borderColor: 'border-chess-accent/30',
            bgGlow: 'from-chess-accent/5',
            iconBg: 'bg-chess-accent/15 border-chess-accent/25 text-chess-accent',
            icon: <Info size={24} />,
            btnColor: 'bg-chess-accent hover:bg-chess-accent-hover text-white shadow-chess-accent/15',
            defaultTitle: 'Information'
        },
        success: {
            borderColor: 'border-chess-status-success/30',
            bgGlow: 'from-chess-status-success/5',
            iconBg: 'bg-chess-status-success/15 border-chess-status-success/25 text-chess-status-success',
            icon: <CheckCircle2 size={24} className="animate-bounce" />,
            btnColor: 'bg-chess-status-success hover:bg-emerald-600 text-white shadow-chess-status-success/15',
            defaultTitle: 'Success'
        },
        warning: {
            borderColor: 'border-chess-status-warning/30',
            bgGlow: 'from-chess-status-warning/5',
            iconBg: 'bg-chess-status-warning/15 border-chess-status-warning/25 text-chess-status-warning',
            icon: <AlertTriangle size={24} className="animate-pulse" />,
            btnColor: 'bg-chess-status-warning hover:bg-amber-600 text-white shadow-chess-status-warning/15',
            defaultTitle: 'Warning'
        },
        error: {
            borderColor: 'border-chess-status-error/30',
            bgGlow: 'from-chess-status-error/5',
            iconBg: 'bg-chess-status-error/15 border-chess-status-error/25 text-chess-status-error',
            icon: <AlertCircle size={24} className="animate-pulse" />,
            btnColor: 'bg-chess-status-error hover:bg-red-600 text-white shadow-chess-status-error/15',
            defaultTitle: 'Error'
        },
        confirm: {
            borderColor: 'border-chess-accent/30',
            bgGlow: 'from-chess-accent/5',
            iconBg: 'bg-chess-accent/15 border-chess-accent/25 text-chess-accent',
            icon: <AlertTriangle size={24} />,
            btnColor: 'bg-chess-accent hover:bg-chess-accent-hover text-white shadow-chess-accent/15',
            defaultTitle: 'Are you sure?'
        }
    };

    const current = typeConfig[type] || typeConfig.info;
    const isConfirmType = type === 'confirm';

    const handleConfirm = () => {
        if (loading) return;
        if (onConfirm) onConfirm();
        if (onClose) onClose();
    };

    const handleCancel = () => {
        if (loading) return;
        if (onCancel) onCancel();
        if (onClose) onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                onClick={isConfirmType ? handleCancel : handleConfirm} 
            />

            {/* Modal Card container */}
            <div className={`relative w-full max-w-md bg-chess-panel/95 backdrop-blur-2xl border ${current.borderColor} rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col gap-5 overflow-hidden z-10 transition-all duration-300 animate-in zoom-in-95`}>
                {/* Accent ambient glow in background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${current.bgGlow} to-transparent pointer-events-none`} />

                {/* Close 'X' Button for Alert types */}
                {!loading && (
                    <button
                        onClick={isConfirmType ? handleCancel : handleConfirm}
                        className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition-colors"
                        aria-label="Close dialog"
                    >
                        <X size={16} />
                    </button>
                )}

                {/* Content Header & Icon */}
                <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${current.iconBg}`}>
                        {current.icon}
                    </div>
                    <div className="flex-1 mt-0.5">
                        <h3 className="text-lg font-bold font-serif text-white tracking-wide leading-tight">
                            {title || current.defaultTitle}
                        </h3>
                        <p className="text-chess-text-secondary text-sm leading-relaxed mt-2 whitespace-pre-line font-medium">
                            {message}
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 mt-2 shrink-0 relative z-20">
                    {isConfirmType ? (
                        <>
                            <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="px-4 py-2.5 text-sm font-semibold text-chess-text-secondary hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 disabled:opacity-50"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${current.btnColor}`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleConfirm}
                            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg w-full sm:w-auto text-center ${current.btnColor}`}
                        >
                            {confirmText}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
