import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding, verifyLichessUsername } from '../services/userService';
import { ArrowRight, User, Globe, Settings, ShieldCheck, Loader2 } from 'lucide-react';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [lichessUsername, setLichessUsername] = useState('');
  const [minElo, setMinElo] = useState(1500);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lichessVerifyState, setLichessVerifyState] = useState('idle'); // idle | loading | valid | invalid
  const [lichessVerifyProfile, setLichessVerifyProfile] = useState(null);
  const verifyTimer = useRef(null);

  const handleLichessChange = (val) => {
    setLichessUsername(val);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    if (!val.trim()) {
      setLichessVerifyState('idle');
      setLichessVerifyProfile(null);
      return;
    }
    setLichessVerifyState('loading');
    verifyTimer.current = setTimeout(async () => {
      try {
        const result = await verifyLichessUsername(val);
        setLichessVerifyState(result.valid ? 'valid' : 'invalid');
        setLichessVerifyProfile(result.valid ? result.profile : null);
      } catch {
        setLichessVerifyState('invalid');
        setLichessVerifyProfile(null);
      }
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Please enter your name.');
      return;
    }

    try {
      setError(null);
      setSaving(true);
      await completeOnboarding(user.uid, {
        displayName: displayName.trim(),
        lichessUsername: lichessUsername.trim(),
        settings: {
          minElo: parseInt(minElo, 10)
        }
      });
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setSaving(false);
      setError(err.message || 'Failed to complete setup. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-radial-gradient from-chess-bg via-chess-bg to-[#020617] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
      
      {/* Glassmorphism Card */}
      <div className="w-full max-w-2xl relative z-10">
        <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/20 to-brand-med/20 rounded-3xl blur-[1px]" />
        
        <div className="relative bg-chess-panel/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 bg-chess-accent/10 border border-chess-accent/20 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl text-chess-accent">🏆</span>
            </div>
            <h1 className="text-3xl font-serif font-bold text-white mb-2">Let's Complete Your Setup</h1>
            <p className="text-chess-text-secondary text-sm max-w-md">
              Configure your profile to start tracking opening blunders and building your repertoire.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-chess-status-error/10 border border-chess-status-error/20 rounded-xl text-chess-status-error text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Personal Details */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <User size={18} className="text-chess-accent" />
                <span>1. Personalize Your Profile</span>
              </h2>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-chess-text-secondary">YOUR DISPLAY NAME</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Ibrahim"
                  required
                  className="w-full bg-chess-bg/80 border border-white/10 text-white rounded-xl py-3.5 px-4 focus:outline-none focus:border-chess-accent/50 transition-colors"
                />
              </div>
            </div>

            {/* Step 2: Lichess Details */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Globe size={18} className="text-chess-accent" />
                <span>2. Link Your Lichess Account</span>
              </h2>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-chess-text-secondary">LICHESS USERNAME (OPTIONAL)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={lichessUsername}
                    onChange={(e) => handleLichessChange(e.target.value)}
                    placeholder="e.g. LichessGM"
                    className="w-full bg-chess-bg/80 border border-white/10 text-white rounded-xl py-3.5 px-4 pr-10 focus:outline-none focus:border-chess-accent/50 transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lichessVerifyState === 'loading' && (
                      <Loader2 size={18} className="animate-spin text-chess-text-secondary" />
                    )}
                    {lichessVerifyState === 'valid' && (
                      <span className="text-chess-status-success" title="Username verified">✓</span>
                    )}
                    {lichessVerifyState === 'invalid' && (
                      <span className="text-chess-status-error" title="Username not found">✗</span>
                    )}
                  </div>
                </div>
                {lichessVerifyState === 'valid' && lichessVerifyProfile && (
                  <p className="text-chess-status-success text-[11px] pt-1 font-medium">
                    ✓ Verified: {lichessVerifyProfile.username} ({lichessVerifyProfile.count?.rated || 0} rated games)
                  </p>
                )}
                {lichessVerifyState === 'invalid' && lichessUsername.trim() && (
                  <p className="text-chess-status-error text-[11px] pt-1">
                    ✗ Username not found on Lichess
                  </p>
                )}
                {lichessVerifyState === 'idle' && (
                  <p className="text-[11px] text-chess-text-secondary pt-1">
                    We use this to analyse and import your actual games automatically. You can also connect it later.
                  </p>
                )}
              </div>
            </div>

            {/* Step 3: Preferences */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <Settings size={18} className="text-chess-accent" />
                <span>3. Initial Preferences</span>
              </h2>
              <div className="space-y-6">
                {/* Min Elo Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Minimum Opponent ELO Rating</span>
                    <span className="text-sm font-bold text-chess-accent">{minElo} ELO</span>
                  </div>
                  <input
                    type="range"
                    min="600"
                    max="1800"
                    step="50"
                    value={minElo}
                    onChange={(e) => setMinElo(e.target.value)}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-chess-accent"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-chess-accent hover:bg-chess-accent/90 disabled:bg-chess-accent/50 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Saving Settings…</span>
                </>
              ) : (
                <>
                  <span>Save and Launch Dashboard</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center gap-2 justify-center mt-6 text-xs text-chess-text-secondary">
            <ShieldCheck size={14} className="text-chess-accent" />
            <span>Settings can be changed anytime from the Settings page.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
