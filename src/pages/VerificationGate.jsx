import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { Mail, Loader2, RefreshCw, LogOut, ShieldAlert } from "lucide-react";

export default function VerificationGate() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [timer, setTimer] = useState(300); // 5 minutes countdown
  const [cooldown, setCooldown] = useState(0); // 60s cooldown for resending
  const [isResending, setIsResending] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // Auto-redirect if verified
  useEffect(() => {
    if (user && user.emailVerified) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Live polling & countdown timer
  useEffect(() => {
    if (!user || user.emailVerified || isTimedOut) return;

    // Background verify polling
    pollIntervalRef.current = setInterval(async () => {
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(pollIntervalRef.current);
          navigate("/dashboard");
        }
      } catch (err) {
        console.error("Error checking verification status:", err);
      }
    }, 3000);

    // 5-minute countdown timer
    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setIsTimedOut(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [user, isTimedOut, navigate]);

  // Handle cooldown interval
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownIntervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError("");
    setMessage("");

    try {
      await sendEmailVerification(auth.currentUser);
      setCooldown(60);
      setMessage("A fresh verification link has been sent to your inbox.");
      
      if (isTimedOut) {
        setIsTimedOut(false);
        setTimer(300);
      }
    } catch (err) {
      console.error("Error resending email:", err);
      setError("Unable to resend email. Please try again later.");
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#090e1a] via-[#0f172a] to-[#060b14]" />
        <div className="relative z-10 bg-chess-panel/40 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 max-w-[420px] w-full text-center shadow-2xl">
          <Loader2 className="animate-spin text-chess-accent mx-auto mb-4" size={32} />
          <p className="text-white text-sm font-semibold">Loading authentication state...</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#090e1a] via-[#0f172a] to-[#060b14]" />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-chess-accent/6 blur-[180px] rounded-full animate-pulse pointer-events-none animate-pulse" style={{ animationDuration: "7s" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-med/8 blur-[160px] rounded-full animate-pulse pointer-events-none animate-pulse" style={{ animationDuration: "9s" }} />

      {/* Verification Card */}
      <div className="w-full max-w-[460px] relative z-10">
        <div className="absolute -inset-px bg-gradient-to-b from-chess-accent/20 via-white/5 to-chess-accent/10 rounded-2xl blur-[1.5px]" />
        
        <div className="relative bg-chess-panel/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)] p-8 sm:p-10 flex flex-col items-center text-center">
          
          {/* Animated Mail Box Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-chess-accent/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative w-20 h-20 bg-gradient-to-br from-chess-accent/15 to-[#1e293b]/50 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md animate-bounce" style={{ animationDuration: "3s" }}>
              <Mail size={32} className="text-chess-accent" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-3">Verify Your Email</h2>
          
          <p className="text-chess-text-secondary text-sm leading-relaxed mb-6 font-medium">
            We've sent a secure verification link to <strong className="text-white font-semibold">{user.email}</strong>.
            <span className="block mt-2 text-xs text-chess-text-secondary/60">
              If you don't see the email in a few minutes, please make sure to check your spam or junk folder.
            </span>
          </p>

          {isTimedOut ? (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3">
              <ShieldAlert size={18} className="text-rose-400 shrink-0" />
              <span className="text-rose-400 text-xs font-semibold text-left leading-relaxed">
                Verification session timed out. Click "Resend Email" to start polling again.
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 mb-6 bg-white/5 border border-white/5 rounded-xl px-5 py-3.5 w-full">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin text-chess-accent shrink-0" size={16} />
                <span className="text-xs text-white/80 font-medium">Waiting for email verification...</span>
              </div>
              <span className="text-[10px] text-chess-text-secondary font-bold uppercase tracking-wider">
                Timeout in {formatTime(timer)}
              </span>
            </div>
          )}

          {message && (
            <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-semibold text-center w-full animate-in">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold text-center w-full animate-in">
              {error}
            </div>
          )}

          {/* Action Button Container */}
          <div className="w-full space-y-3.5 mt-2">
            <button
              onClick={handleResend}
              disabled={cooldown > 0 || isResending}
              className={`w-full py-3 px-6 rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2 text-sm tracking-wide border ${
                cooldown > 0 || isResending
                  ? "bg-white/5 border-white/5 text-white/40 cursor-not-allowed"
                  : "bg-white hover:bg-gray-100 border-white text-gray-900 hover:-translate-y-0.5"
              }`}
            >
              {isResending ? (
                <>
                  <Loader2 size={16} className="animate-spin text-gray-900" />
                  <span>Resending...</span>
                </>
              ) : cooldown > 0 ? (
                <span>Resend in {cooldown}s</span>
              ) : (
                <>
                  <RefreshCw size={16} />
                  <span>Resend Email</span>
                </>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-lg font-bold bg-[#1b253b] hover:bg-[#242f4c] border border-white/10 hover:border-white/20 text-white transition-all shadow-md flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5"
            >
              <LogOut size={16} />
              <span>Back to Login</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
