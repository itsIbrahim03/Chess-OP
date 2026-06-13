import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Lock,
  User
} from "lucide-react";

// Animated floating chess piece component
const FloatingPiece = ({ piece, style, delay = 0 }) => (
  <div
    className="absolute text-white/[0.03] select-none pointer-events-none"
    style={{
      ...style,
      animation: `float ${8 + delay}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <span className="text-6xl sm:text-7xl lg:text-8xl">{piece}</span>
  </div>
);

export default function Login() {
  const { user, login, loginWithEmail, signupWithEmail } = useAuth();
  const navigate = useNavigate();

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UX State
  const [error, setError] = useState(null);
  const [loadingAction, setLoadingAction] = useState(null); // 'google', 'email', null
  const [rememberMe, setRememberMe] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const cardRef = useRef(null);

  // Auto-redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      const timer = setTimeout(() => navigate("/dashboard"), 800);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    if (loadingAction) return;

    let popupWindow = null;
    const originalOpen = window.open;

    // Intercept window.open to capture the popup window handle
    window.open = function (...args) {
      popupWindow = originalOpen.apply(this, args);
      // Restore immediately once captured
      window.open = originalOpen;
      return popupWindow;
    };

    let intervalId = null;

    const cleanup = () => {
      window.open = originalOpen;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };

    try {
      setError(null);
      setLoadingAction('google');

      const loginPromise = login(rememberMe);

      // Create a promise that rejects if the popup is closed
      const popupClosedPromise = new Promise((_, reject) => {
        intervalId = setInterval(() => {
          if (popupWindow && popupWindow.closed) {
            clearInterval(intervalId);
            const cancelError = new Error("Sign-in cancelled. You closed the popup before completing.");
            cancelError.code = "auth/popup-closed-by-user";
            reject(cancelError);
          }
        }, 500);
      });

      // Race the login promise against the popup closed promise
      await Promise.race([loginPromise, popupClosedPromise]);

      setShowSuccess(true);
      cleanup();
    } catch (err) {
      cleanup();
      setLoadingAction(null);
      parseAuthError(err);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (loadingAction) return;
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all credentials.");
      return;
    }
    if (isSignUp && !name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setError(null);
      setLoadingAction('email');
      if (isSignUp) {
        await signupWithEmail(email, password, name, rememberMe);
      } else {
        await loginWithEmail(email, password, rememberMe);
      }
      setShowSuccess(true);
    } catch (err) {
      setLoadingAction(null);
      parseAuthError(err);
    }
  };

  const parseAuthError = (err) => {
    console.error("Auth failed:", err);
    const code = err.code || "";
    if (code === "auth/popup-closed-by-user") {
      // Silently ignore user-cancelled login without showing an error banner
      return;
    } else if (code === "auth/popup-blocked") {
      setError("Popup was blocked by your browser. Please allow popups and try again.");
    } else if (code === "auth/network-request-failed") {
      setError("Network error. Please check your internet connection.");
    } else if (code === "auth/too-many-requests") {
      setError("Too many sign-in attempts. Please wait a moment.");
    } else if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
      setError("Invalid email or password. Please verify your credentials.");
    } else if (code === "auth/email-already-in-use") {
      setError("This email address is already in use by another account.");
    } else if (code === "auth/weak-password") {
      setError("Password must be at least 6 characters long.");
    } else if (code === "auth/invalid-email") {
      setError("Invalid email address format.");
    } else {
      setError(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  // Interactive card tilt on mouse move
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -1.5;
    const rotateY = ((x - centerX) / centerX) * 1.5;
    cardRef.current.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `perspective(1200px) rotateX(0deg) rotateY(0deg)`;
  };

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* ─── Animated Background ─────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#090e1a] via-[#0f172a] to-[#060b14]" />
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #38BDF8 1px, transparent 1px), linear-gradient(to bottom, #38BDF8 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-chess-accent/6 blur-[180px] rounded-full animate-pulse pointer-events-none" style={{ animationDuration: "7s" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-med/8 blur-[160px] rounded-full animate-pulse pointer-events-none" style={{ animationDuration: "9s" }} />

      <FloatingPiece piece="♚" style={{ top: "8%", left: "10%" }} delay={0} />
      <FloatingPiece piece="♛" style={{ top: "15%", right: "12%" }} delay={1.5} />
      <FloatingPiece piece="♜" style={{ bottom: "15%", left: "15%" }} delay={3} />
      <FloatingPiece piece="♝" style={{ bottom: "20%", right: "10%" }} delay={2} />
      <FloatingPiece piece="♞" style={{ top: "50%", left: "6%" }} delay={4} />

      <div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-chess-accent/20 to-transparent pointer-events-none"
        style={{ animation: "scanline 5s linear infinite" }}
      />

      {/* ─── Grand Horizontal Login Card (High-End & Professional) ───── */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-5xl min-h-[600px] relative z-10 transition-transform duration-300 ease-out"
      >
        <div className="absolute -inset-px bg-gradient-to-b from-chess-accent/20 via-white/5 to-chess-accent/10 rounded-3xl blur-[1.5px]" />

        <div className="relative bg-chess-panel/40 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)] overflow-hidden min-h-[600px] flex flex-col justify-between">

          {/* Back button */}
          <button
            onClick={() => navigate("/")}
            className="absolute top-6 left-6 text-chess-text-secondary hover:text-white transition-colors p-2.5 rounded-xl hover:bg-white/5 z-20 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
            title="Back to Home"
          >
            <ArrowLeft size={16} />
            <span>Home</span>
          </button>

          <div className="grid md:grid-cols-12 flex-1 min-h-[600px]">

            {/* ─── Left Side: Email & Password Form (7 cols) ──────────────── */}
            <div className="md:col-span-7 p-8 sm:p-12 lg:p-16 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
              <div className="max-w-md w-full mx-auto">
                <div className="flex gap-4 mb-8 bg-chess-bg/90 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(false); setError(null); }}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                      !isSignUp ? "bg-white/10 text-white shadow-lg" : "text-chess-text-secondary hover:text-white"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsSignUp(true); setError(null); }}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${
                      isSignUp ? "bg-white/10 text-white shadow-lg" : "text-chess-text-secondary hover:text-white"
                    }`}
                  >
                    Register
                  </button>
                </div>

                {showSuccess && (
                  <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 animate-in">
                    <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 text-sm font-semibold">Redirecting to session...</span>
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-red-400 text-sm font-medium leading-relaxed">{error}</span>
                  </div>
                )}

                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-chess-text-secondary uppercase tracking-widest block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Bobby Fischer"
                          required
                          className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-xl py-3.5 px-11 focus:outline-none focus:border-chess-accent/40 transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-chess-text-secondary uppercase tracking-widest block">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@domain.com"
                        required
                        className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-xl py-3.5 px-11 focus:outline-none focus:border-chess-accent/40 transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-chess-text-secondary uppercase tracking-widest block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-xl py-3.5 px-11 pr-12 focus:outline-none focus:border-chess-accent/40 transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-chess-text-secondary uppercase tracking-widest block">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={18} />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-xl py-3.5 px-11 pr-12 focus:outline-none focus:border-chess-accent/40 transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {!isSignUp && (
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 border border-white/20 rounded-md bg-white/5 peer-checked:bg-chess-accent peer-checked:border-chess-accent transition-all flex items-center justify-center group-hover:border-white/30">
                            {rememberMe && (
                              <svg viewBox="0 0 12 12" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-chess-text-secondary font-semibold group-hover:text-chess-accent transition-colors">Keep me signed in</span>
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!!loadingAction}
                    className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-300 text-gray-900 font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 disabled:translate-y-0 flex items-center justify-center gap-2 mt-4 text-sm tracking-wide"
                  >
                    {loadingAction === 'email' ? (
                      <>
                        <Loader2 size={18} className="animate-spin text-chess-bg" />
                        <span>{isSignUp ? "Registering..." : "Signing in..."}</span>
                      </>
                    ) : (
                      <span>{isSignUp ? "Register Account" : "Sign In"}</span>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ─── Right Side: Google Login & Premium Branding (5 cols) ───── */}
            <div className="md:col-span-5 p-8 sm:p-12 flex flex-col justify-between bg-[#131d33]/50 relative overflow-hidden">
              
              {/* Graphic Chessboard Design Effect */}
              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{
                  backgroundImage: `radial-gradient(circle at top right, #38BDF8 10%, transparent 80%)`,
                }}
              />
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-chess-accent/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col items-center justify-center my-auto text-center py-6 relative z-10">
                {/* Chess-OP Logo Icon */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-chess-accent/20 blur-3xl rounded-full scale-150" />
                  <div className="relative w-24 h-24 bg-gradient-to-br from-chess-accent/15 to-[#1e293b]/50 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md">
                    <img
                      src="/logo/Logo-icon.png"
                      alt="Chess-OP"
                      className="h-16 w-16 object-contain drop-shadow-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<span class="text-5xl">♟️</span>';
                      }}
                    />
                  </div>
                </div>

                <h1 className="text-3xl font-serif font-bold text-white mb-3 tracking-tight">
                  Chess<span className="text-chess-accent">-OP</span>
                </h1>
                
                <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-chess-accent/50 to-transparent rounded-full mb-6" />

                <p className="text-chess-text-secondary text-sm max-w-[280px] leading-relaxed mb-10 font-medium">
                  Connect your profile to synchronize opening blunder libraries and calculate game metrics.
                </p>

                {/* Google Login button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={!!loadingAction}
                  className="w-full bg-[#1b253b] hover:bg-[#242f4c] border border-white/10 hover:border-white/20 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 text-sm group relative overflow-hidden cursor-pointer disabled:cursor-not-allowed"
                >
                  {loadingAction === 'google' ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-chess-accent" />
                      <span className="text-white/60">Connecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 group-hover:scale-110 transition-transform shrink-0" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l.003-.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Minimalist Sub-Footer */}
              <div className="pt-6 border-t border-white/5 flex justify-center text-[10px] text-chess-text-secondary/40 font-semibold uppercase tracking-wider relative z-10">
                <span className="flex items-center gap-1.5">
                  Secure Enterprise Authentication
                </span>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ─── Custom Animations ───────────────────────────────────────── */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(3deg); }
          50% { transform: translateY(-5px) rotate(-2deg); }
          75% { transform: translateY(-20px) rotate(1deg); }
        }
        @keyframes scanline {
          0% { top: -5%; }
          100% { top: 105%; }
        }
        @keyframes animate-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-in {
          animation: animate-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}