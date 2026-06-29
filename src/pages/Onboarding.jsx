import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding, verifyLichessUsername } from '../services/userService';
import { ArrowRight, User, Globe, Settings, ShieldCheck, Loader2, CheckCircle2, XCircle, Compass, AlertTriangle } from 'lucide-react';
import { translateError } from '../lib/errorTranslator';

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [lichessUsername, setLichessUsername] = useState('');
  const [minElo, setMinElo] = useState(1500);
  const [engineDepth, setEngineDepth] = useState(14);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [displayNameError, setDisplayNameError] = useState(null);
  const [lichessVerifyState, setLichessVerifyState] = useState('idle'); // idle | loading | valid | invalid
  const [lichessVerifyProfile, setLichessVerifyProfile] = useState(null);
  const verifyTimer = useRef(null);

  const triggerLichessVerification = async (val) => {
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      setLichessVerifyState('idle');
      setLichessVerifyProfile(null);
      return;
    }
    setLichessVerifyState('loading');
    try {
      const result = await verifyLichessUsername(trimmed);
      setLichessVerifyState(result.valid ? 'valid' : 'invalid');
      setLichessVerifyProfile(result.valid ? result.profile : null);
    } catch {
      setLichessVerifyState('invalid');
      setLichessVerifyProfile(null);
    }
  };

  const handleLichessChange = (val) => {
    setLichessUsername(val);
    if (verifyTimer.current) clearTimeout(verifyTimer.current);
    
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      setLichessVerifyState('idle');
      setLichessVerifyProfile(null);
      return;
    }
    
    setLichessVerifyState('loading');
    verifyTimer.current = setTimeout(() => {
      triggerLichessVerification(val);
    }, 1500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setDisplayNameError('Please fill out this field.');
      return;
    }

    try {
      setError(null);
      setDisplayNameError(null);
      setSaving(true);
      await completeOnboarding(user.uid, {
        displayName: displayName.trim(),
        lichessUsername: lichessUsername.trim(),
        settings: {
          minElo: parseInt(minElo, 10),
          engineDepth: parseInt(engineDepth, 10)
        }
      });
      // Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      setSaving(false);
      setError(translateError(err));
    }
  };

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-[3vh] relative overflow-hidden">
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
      <div className="w-[90vw] md:w-[85vw] max-w-[940px] relative z-10 my-auto">
        <div className="absolute -inset-px bg-gradient-to-r from-chess-accent/20 to-brand-med/20 rounded-3xl blur-[1px]" />
        
        <div className="relative bg-chess-panel/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 md:p-[4vh] shadow-2xl flex flex-col justify-between max-h-[95vh] overflow-hidden">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-4 md:mb-[3vh]">
            <div className="w-12 h-12 md:w-[5.5vh] md:h-[5.5vh] max-w-[50px] max-h-[50px] bg-chess-accent/10 border border-chess-accent/20 text-chess-accent rounded-2xl flex items-center justify-center mb-2 md:mb-[2vh]">
              <Compass className="w-6 h-6 md:w-[2.8vh] md:h-[2.8vh] max-w-[28px] max-h-[28px]" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-white mb-1 md:mb-[1vh] leading-tight">Let's Complete Your Setup</h1>
            <p className="text-chess-text-secondary text-xs sm:text-sm max-w-lg leading-relaxed">
              Configure your profile to start tracking opening blunders and building your repertoire.
            </p>
          </div>

          {error && (
            <div className="mb-4 md:mb-[2vh] p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-xs sm:text-sm font-medium leading-relaxed">
              <AlertTriangle className="shrink-0 mt-0.5 w-4 h-4 sm:w-5 sm:h-5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-[3vh]" noValidate>
            
            {/* 2-Column Layout Wrapper */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-[3vh]">
              
              {/* Left Column: Personalization & Lichess Connection */}
              <div className="space-y-4 md:space-y-[2.5vh]">
                {/* Step 1: Personal Details */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 md:p-[2.5vh]">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2 mb-3">
                    <User className="text-chess-accent w-4 h-4 sm:w-5 sm:h-5" />
                    <span>1. Personalize Your Profile</span>
                  </h2>
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-chess-text-secondary tracking-wider block">YOUR DISPLAY NAME</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value);
                        if (displayNameError) setDisplayNameError(null);
                      }}
                      placeholder="Enter your name"
                      className={`w-full bg-chess-bg/80 border text-white rounded-xl py-2 px-3 sm:py-3 sm:px-4 text-xs sm:text-sm focus:outline-none transition-colors ${
                        displayNameError ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-chess-accent/50"
                      }`}
                    />
                    {displayNameError && (
                      <p className="text-[10px] sm:text-xs text-rose-400 font-medium pl-1 mt-1 animate-in">{displayNameError}</p>
                    )}
                  </div>
                </div>

                {/* Step 2: Lichess Details */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 md:p-[2.5vh]">
                  <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2 mb-3">
                    <Globe className="text-chess-accent w-4 h-4 sm:w-5 sm:h-5" />
                    <span>2. Link Your Lichess Account</span>
                  </h2>
                  <div className="space-y-1 sm:space-y-2">
                    <label className="text-[10px] sm:text-xs font-semibold text-chess-text-secondary tracking-wider block">LICHESS USERNAME (OPTIONAL)</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={lichessUsername}
                        onChange={(e) => handleLichessChange(e.target.value)}
                        onBlur={() => triggerLichessVerification(lichessUsername)}
                        placeholder="e.g. LichessGM"
                        className="w-full bg-chess-bg/80 border border-white/10 text-white rounded-xl py-2 px-3 sm:py-3 sm:px-4 pr-10 text-xs sm:text-sm focus:outline-none focus:border-chess-accent/50 transition-colors"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {lichessVerifyState === 'loading' && (
                          <Loader2 className="animate-spin text-chess-text-secondary w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                        {lichessVerifyState === 'valid' && (
                          <CheckCircle2 className="text-chess-status-success w-4 h-4 sm:w-5 sm:h-5" title="Username verified" />
                        )}
                        {lichessVerifyState === 'invalid' && (
                          <XCircle className="text-chess-status-error w-4 h-4 sm:w-5 sm:h-5" title="Username not found" />
                        )}
                      </div>
                    </div>
                    {lichessVerifyState === 'valid' && lichessVerifyProfile && (
                      <p className="text-chess-status-success text-[10px] sm:text-xs pt-1 font-medium">
                        ✓ Verified: {lichessVerifyProfile.username} ({lichessVerifyProfile.count?.rated || 0} rated)
                      </p>
                    )}
                    {lichessVerifyState === 'invalid' && lichessUsername.trim() && (
                      <p className="text-chess-status-error text-[10px] sm:text-xs pt-1">
                        ✗ Username not found on Lichess
                      </p>
                    )}
                    {lichessVerifyState === 'idle' && (
                      <p className="text-[10px] sm:text-xs text-chess-text-secondary pt-1 leading-normal">
                        We use this to analyze and import games automatically.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Preferences */}
              <div className="space-y-4 md:space-y-[2.5vh]">
                {/* Step 3: Preferences */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 sm:p-5 md:p-[2.5vh] h-full flex flex-col justify-between">
                  <div>
                    <h2 className="text-xs sm:text-sm md:text-base font-bold text-white flex items-center gap-2 mb-4">
                      <Settings className="text-chess-accent w-4 h-4 sm:w-5 sm:h-5" />
                      <span>3. Initial Preferences</span>
                    </h2>
                    <div className="space-y-5 md:space-y-[3.5vh]">
                      {/* Min Elo Slider */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold text-white">Minimum Opponent ELO Rating</span>
                          <span className="text-xs sm:text-sm font-bold text-chess-accent">{minElo} ELO</span>
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

                      {/* Engine Depth Slider */}
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs sm:text-sm font-semibold text-white">Stockfish Evaluation Depth</span>
                          <span className="text-xs sm:text-sm font-bold text-chess-accent">
                            Depth {engineDepth} ({engineDepth <= 10 ? 'Fast' : engineDepth <= 14 ? 'Balanced' : 'Deep'})
                          </span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="20"
                          step="1"
                          value={engineDepth}
                          onChange={(e) => setEngineDepth(parseInt(e.target.value, 10))}
                          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-chess-accent"
                        />
                        <p className="text-[10px] sm:text-xs text-chess-text-secondary leading-normal">
                          Higher plies depth analyzes deeper but takes longer during scans.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-chess-accent hover:bg-chess-accent/90 disabled:bg-chess-accent/50 text-white font-bold py-3 px-4 sm:py-4 sm:px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm uppercase tracking-wider cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Saving Settings…</span>
                </>
              ) : (
                <>
                  <span>Save and Launch Dashboard</span>
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center gap-2 justify-center mt-4 md:mt-[2.5vh] text-[10px] sm:text-xs text-chess-text-secondary font-medium">
            <ShieldCheck className="text-chess-accent w-4 h-4 sm:w-[1.8vh] sm:h-[1.8vh]" />
            <span>Settings can be changed anytime from the Settings page.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
