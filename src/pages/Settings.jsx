import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { User, Link2, Bell, Palette, Shield, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getUserProfile, linkLichessAccount, updateUserSettings } from '../services/userService';

export default function Settings() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [lichessUsername, setLichessUsername] = useState('');
    const [settings, setSettings] = useState({
        theme: 'dark',
        minElo: 1000,
        autoAnalyze: false,
        notificationsEnabled: true
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadUserProfile();
    }, [user]);

    const loadUserProfile = async () => {
        try {
            const profile = await getUserProfile(user.uid);
            setUserProfile(profile);
            setLichessUsername(profile.lichessUsername || '');
            setSettings(profile.settings || settings);
        } catch (error) {
            console.error('Failed to load profile:', error);
            setMessage({ type: 'error', text: 'Failed to load settings' });
        } finally {
            setLoading(false);
        }
    };

    const handleLinkLichess = async () => {
        if (!lichessUsername.trim()) {
            setMessage({ type: 'error', text: 'Please enter a Lichess username' });
            return;
        }

        setSaving(true);
        try {
            await linkLichessAccount(user.uid, lichessUsername);
            setMessage({ type: 'success', text: 'Lichess account linked successfully!' });
            await loadUserProfile();
        } catch (error) {
            console.error('Failed to link account:', error);
            setMessage({ type: 'error', text: 'Failed to link Lichess account' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await updateUserSettings(user.uid, settings);
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
        } catch (error) {
            console.error('Failed to save settings:', error);
            setMessage({ type: 'error', text: 'Failed to save settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <p className="text-chess-text-secondary">Loading settings...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-serif font-bold text-white mb-2">Settings</h1>
                    <p className="text-chess-text-secondary">Manage your account and preferences</p>
                </div>

                {/* Message Banner */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg border ${message.type === 'success'
                            ? 'bg-chess-status-success/10 border-chess-status-success/30 text-chess-status-success'
                            : 'bg-chess-status-error/10 border-chess-status-error/30 text-chess-status-error'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* Lichess Account Section */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Link2 className="text-chess-accent" size={24} />
                        <h2 className="text-xl font-bold text-white">Lichess Account</h2>
                    </div>

                    {userProfile?.lichessUsername ? (
                        <div className="mb-4">
                            <p className="text-sm text-chess-text-secondary mb-2">Connected as:</p>
                            <div className="flex items-center gap-2">
                                <p className="text-lg font-bold text-chess-accent">{userProfile.lichessUsername}</p>
                                <span className="text-xs bg-chess-status-success/20 text-chess-status-success px-2 py-1 rounded">
                                    Connected
                                </span>
                            </div>
                            <p className="text-xs text-chess-text-secondary mt-1">
                                Linked {userProfile.lichessConnectedAt ? new Date(userProfile.lichessConnectedAt.toDate()).toLocaleDateString() : 'recently'}
                            </p>
                        </div>
                    ) : (
                        <div className="mb-4 p-4 bg-chess-status-warning/10 border border-chess-status-warning/30 rounded-lg">
                            <p className="text-chess-status-warning text-sm">
                                ⚠️ No Lichess account linked. Link your account to analyze games and generate puzzles.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={lichessUsername}
                            onChange={(e) => setLichessUsername(e.target.value)}
                            placeholder="Enter Lichess username"
                            className="flex-1 px-4 py-2 bg-chess-bg border border-white/10 rounded-lg text-white placeholder:text-chess-text-secondary focus:outline-none focus:border-chess-accent transition-colors"
                        />
                        <button
                            onClick={handleLinkLichess}
                            disabled={saving}
                            className="px-6 py-2 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : userProfile?.lichessUsername ? 'Update' : 'Link Account'}
                        </button>
                    </div>
                </div>

                {/* User Preferences Section */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <Palette className="text-chess-accent" size={24} />
                        <h2 className="text-xl font-bold text-white">Preferences</h2>
                    </div>

                    <div className="space-y-4">
                        {/* Min ELO */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2">
                                Minimum Rating Filter
                            </label>
                            <input
                                type="number"
                                value={settings.minElo}
                                onChange={(e) => setSettings({ ...settings, minElo: parseInt(e.target.value) })}
                                min="0"
                                max="3000"
                                step="100"
                                className="w-full px-4 py-2 bg-chess-bg border border-white/10 rounded-lg text-white focus:outline-none focus:border-chess-accent transition-colors"
                            />
                            <p className="text-xs text-chess-text-secondary mt-1">
                                Only analyze games above this rating
                            </p>
                        </div>

                        {/* Auto-analyze */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Auto-analyze New Games</p>
                                <p className="text-xs text-chess-text-secondary">
                                    Automatically analyze games when you visit the dashboard
                                </p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, autoAnalyze: !settings.autoAnalyze })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.autoAnalyze ? 'bg-chess-accent' : 'bg-white/10'
                                    }`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.autoAnalyze ? 'translate-x-7' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>

                        {/* Notifications */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-bold text-white">Notifications</p>
                                <p className="text-xs text-chess-text-secondary">
                                    Receive notifications about new puzzles and achievements
                                </p>
                            </div>
                            <button
                                onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.notificationsEnabled ? 'bg-chess-accent' : 'bg-white/10'
                                    }`}
                            >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
                                    }`} />
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={saving}
                        className="mt-6 w-full px-6 py-3 bg-chess-accent hover:bg-chess-accent-hover text-white rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Save size={20} />
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>

                {/* Account Info Section */}
                <div className="bg-chess-panel border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="text-chess-accent" size={24} />
                        <h2 className="text-xl font-bold text-white">Account Information</h2>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <p className="text-sm text-chess-text-secondary">Email</p>
                            <p className="text-white font-bold">{user?.email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-chess-text-secondary">Display Name</p>
                            <p className="text-white font-bold">{user?.displayName || 'Player'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-chess-text-secondary">Member Since</p>
                            <p className="text-white font-bold">
                                {userProfile?.createdAt ? new Date(userProfile.createdAt.toDate()).toLocaleDateString() : 'Recently'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
