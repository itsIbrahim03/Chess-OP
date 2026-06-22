import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Lock,
  User,
  CaseSensitive,
  CaseUpper,
  Ruler
} from "lucide-react";
import { translateError } from "../lib/errorTranslator";

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

// Custom "123" number icon component
const Number123Icon = ({ size = 12, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* 1 */}
    <path d="M2 9l2-3v12" />
    {/* 2 */}
    <path d="M9 6h4v6h-4v6h4" />
    {/* 3 */}
    <path d="M16 6h4v12h-4" />
    <path d="M16 12h4" />
  </svg>
);

export default function Login() {
  const { user, login, loginWithEmail, signupWithEmail, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UX State
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadingAction, setLoadingAction] = useState(null); // 'google', 'email', null
  const [rememberMe, setRememberMe] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const cardRef = useRef(null);

  // Password strength real-time tracking
  const passwordStrength = useMemo(() => ({
    length: /.{8,}/.test(password),
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }), [password]);

  const allCriteriaMet = useMemo(() =>
    passwordStrength.length && passwordStrength.uppercase && passwordStrength.lowercase && passwordStrength.number,
    [passwordStrength]
  );

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const registerDisabled = isSignUp && (!allCriteriaMet || !passwordsMatch);

  // Auto-redirect to appropriate page if already logged in
  useEffect(() => {
    if (user) {
      if (user.emailVerified) {
        const timer = setTimeout(() => navigate("/dashboard"), 800);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => navigate("/verification-gate"), 800);
        return () => clearTimeout(timer);
      }
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

    const errors = {};
    if (!email.trim()) {
      errors.email = "Please fill out this field.";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!isForgotPassword) {
      if (isSignUp && !name.trim()) {
        errors.name = "Please fill out this field.";
      }
      if (!password) {
        errors.password = "Please fill out this field.";
      }
      if (isSignUp && !allCriteriaMet) {
        errors.password = "Password does not meet all requirements.";
      }
      if (isSignUp && !confirmPassword) {
        errors.confirmPassword = "Please fill out this field.";
      } else if (isSignUp && password !== confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setError(null);
      setFieldErrors({});
      setResetSuccessMessage("");
      setLoadingAction('email');

      if (isForgotPassword) {
        await resetPassword(email);
        setResetSuccessMessage("check your email for reseting the password");
        setLoadingAction(null);
      } else if (isSignUp) {
        await signupWithEmail(email, password, name, rememberMe);
        setShowSuccess(true);
        setLoadingAction(null);
      } else {
        await loginWithEmail(email, password, rememberMe);
        setShowSuccess(true);
        setLoadingAction(null);
      }
    } catch (err) {
      setLoadingAction(null);
      parseAuthError(err);
    }
  };

  const parseAuthError = (err) => {
    const code = err ? (err.code || err.message || "") : "";
    if (code === "auth/popup-closed-by-user") {
      return;
    } else if (code === "auth/popup-blocked") {
      console.error("Popup was blocked by browser:", err);
      setError("Popup was blocked by your browser. Please allow popups and try again.");
    } else {
      setError(translateError(err));
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

  // Password criteria config
  const criteria = [
    { key: 'length', label: '8+ characters', icon: Ruler },
    { key: 'uppercase', label: 'Uppercase', icon: CaseUpper },
    { key: 'lowercase', label: 'Lowercase', icon: CaseSensitive },
    { key: 'number', label: 'Number', icon: Number123Icon },
  ];

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

      {/* ─── Grand Horizontal Login Card ───── */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full max-w-[840px] relative z-10 transition-transform duration-300 ease-out"
      >
        <div className="absolute -inset-px bg-gradient-to-b from-chess-accent/20 via-white/5 to-chess-accent/10 rounded-2xl blur-[1.5px]" />

        <div className="relative bg-chess-panel/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">

          <div className="grid md:grid-cols-12">

            {/* ─── Left Side: Email & Password Form (7 cols) ──────────────── */}
            <div className="md:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
              <div className="w-full max-w-[360px] mx-auto flex flex-col">

                {/* Back button */}
                <button
                  onClick={() => navigate("/")}
                  className="self-start mb-6 -ml-2 text-chess-text-secondary hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                  title="Back to Home"
                >
                  <ArrowLeft size={14} />
                  <span>Home</span>
                </button>

                {/* Tab Switcher / Forgot Password Title */}
                {isForgotPassword ? (
                  <div className="mb-6 text-left animate-in">
                    <h2 className="text-xl font-bold text-white mb-2">Reset Password</h2>
                    <p className="text-xs text-chess-text-secondary leading-relaxed font-medium">Enter your email address to receive a secure link to reset your password.</p>
                  </div>
                ) : (
                  <div className="flex gap-4 mb-6 bg-chess-bg/90 p-1 rounded-xl border border-white/5 relative">
                    {/* Sliding background indicator */}
                    <div
                      className="absolute top-1 bottom-1 rounded-lg bg-white/10 shadow-lg transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
                      style={{
                        left: isSignUp ? '50%' : '4px',
                        width: 'calc(50% - 4px)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => { setIsSignUp(false); setError(null); setFieldErrors({}); setResetSuccessMessage(""); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors duration-300 relative z-10 ${
                        !isSignUp ? "text-white" : "text-chess-text-secondary hover:text-white"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsSignUp(true); setError(null); setFieldErrors({}); setResetSuccessMessage(""); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors duration-300 relative z-10 ${
                        isSignUp ? "text-white" : "text-chess-text-secondary hover:text-white"
                      }`}
                    >
                      Register
                    </button>
                  </div>
                )}

                {showSuccess && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 animate-in">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 text-xs font-semibold">Redirecting to session...</span>
                  </div>
                )}

                {resetSuccessMessage && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 animate-in">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    <span className="text-emerald-400 text-xs font-semibold">{resetSuccessMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 animate-in">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-rose-400 text-xs font-medium leading-relaxed">{error}</span>
                  </div>
                )}

                <form onSubmit={handleEmailAuth} className="flex flex-col" noValidate>
                  {/* Full Name (Register only) */}
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isSignUp && !isForgotPassword ? 'max-h-[100px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-1 pb-0">
                      <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: null }));
                          }}
                          placeholder="e.g. Bobby Fischer"
                          tabIndex={isSignUp && !isForgotPassword ? 0 : -1}
                          className={`w-full bg-chess-bg/75 border text-white rounded-lg py-2.5 px-10 focus:outline-none transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium ${
                            fieldErrors.name ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-chess-accent/40"
                          }`}
                        />
                      </div>
                      {fieldErrors.name && (
                        <p className="text-xs text-rose-400 font-medium pl-1 animate-in">{fieldErrors.name}</p>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div className={`transition-all duration-300 ${(isSignUp && !isForgotPassword) ? 'mt-3.5' : 'mt-0'}`}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: null }));
                          }}
                          placeholder="name@domain.com"
                          className={`w-full bg-chess-bg/75 border text-white rounded-lg py-2.5 px-10 focus:outline-none transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium ${
                            fieldErrors.email ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-chess-accent/40"
                          }`}
                        />
                      </div>
                      {fieldErrors.email && (
                        <p className="text-xs text-rose-400 font-medium pl-1 animate-in">{fieldErrors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Password */}
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${!isForgotPassword ? 'max-h-[100px] opacity-100 mt-3.5' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: null }));
                          }}
                          placeholder="••••••••"
                          className={`w-full bg-chess-bg/75 border text-white rounded-lg py-2.5 px-10 pr-11 focus:outline-none transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium ${
                            fieldErrors.password ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-chess-accent/40"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.password && (
                        <p className="text-xs text-rose-400 font-medium pl-1 animate-in">{fieldErrors.password}</p>
                      )}
                    </div>
                  </div>

                  {/* Password Strength Matrix (Register only) */}
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isSignUp && !isForgotPassword ? 'max-h-[120px] opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 pb-1">
                      {criteria.map((item) => {
                        const met = passwordStrength[item.key];
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center gap-2 transition-all duration-200 ${met ? 'text-emerald-400' : 'text-slate-500'}`}
                          >
                            <div className={`w-3.5 h-3.5 flex items-center justify-center transition-all duration-200 ${met ? 'scale-110' : 'scale-100'}`}>
                              {met ? (
                                <CheckCircle2 size={12} className="text-emerald-400" />
                              ) : (
                                <item.icon size={12} className="text-slate-500/70" />
                              )}
                            </div>
                            <span className={`text-[10px] font-semibold transition-colors duration-200 ${met ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {item.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Confirm Password (Register only) */}
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${isSignUp && !isForgotPassword ? 'max-h-[120px] opacity-100 mt-3.5' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            if (fieldErrors.confirmPassword) setFieldErrors(prev => ({ ...prev, confirmPassword: null }));
                          }}
                          placeholder="••••••••"
                          tabIndex={isSignUp && !isForgotPassword ? 0 : -1}
                          className={`w-full bg-chess-bg/75 border text-white rounded-lg py-2.5 px-10 pr-11 focus:outline-none transition-colors placeholder:text-chess-text-secondary/30 text-sm font-medium ${
                            fieldErrors.confirmPassword ? "border-rose-500/50 focus:border-rose-500" : "border-white/10 focus:border-chess-accent/40"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                          tabIndex={isSignUp && !isForgotPassword ? 0 : -1}
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.confirmPassword && (
                        <p className="text-xs text-rose-400 font-medium pl-1 animate-in">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  </div>

                  {/* Forgot Password Link (Sign In only) */}
                  <div className={`flex justify-end transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${!isSignUp && !isForgotPassword ? 'max-h-[30px] opacity-100 mt-0.5' : 'max-h-0 opacity-0 mt-0'}`}>
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); setFieldErrors({}); setResetSuccessMessage(""); }}
                      className="text-xs text-chess-accent hover:text-white transition-colors font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* Remember Me (Sign In only) */}
                  <div className={`transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden ${!isSignUp && !isForgotPassword ? 'max-h-[50px] opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 border border-white/20 rounded-md bg-white/5 peer-checked:bg-chess-accent peer-checked:border-chess-accent transition-all flex items-center justify-center group-hover:border-white/30">
                            {rememberMe && (
                              <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-chess-text-secondary font-semibold group-hover:text-chess-accent transition-colors">Keep me signed in</span>
                      </label>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!!loadingAction || (!isForgotPassword && registerDisabled)}
                    className={`w-full font-bold py-3 px-6 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 mt-4 text-sm tracking-wide ${
                      (!!loadingAction || (!isForgotPassword && registerDisabled))
                        ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'
                        : 'bg-white hover:bg-gray-100 text-gray-900 hover:-translate-y-0.5'
                    }`}
                  >
                    {loadingAction === 'email' ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-chess-bg" />
                        <span>{isForgotPassword ? "Sending Link..." : isSignUp ? "Registering..." : "Signing in..."}</span>
                      </>
                    ) : (
                      <span>{isForgotPassword ? "Send Reset Link" : isSignUp ? "Register Account" : "Sign In"}</span>
                    )}
                  </button>

                  {/* Back to Sign In (Forgot Password only) */}
                  {isForgotPassword && (
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(false); setError(null); setFieldErrors({}); setResetSuccessMessage(""); }}
                      className="w-full mt-3 py-3 px-6 rounded-lg font-bold bg-[#1b253b] hover:bg-[#242f4c] border border-white/10 hover:border-white/20 text-white transition-all shadow-md text-sm text-center hover:-translate-y-0.5"
                    >
                      Back to Sign In
                    </button>
                  )}

                  {/* ─── OR Divider ─── */}
                  {!isForgotPassword && (
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[10px] font-bold text-chess-text-secondary/50 uppercase tracking-widest">or</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}

                  {/* Google Login button */}
                  {!isForgotPassword && (
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={!!loadingAction}
                      className="w-full mt-4 bg-[#1b253b] hover:bg-[#242f4c] border border-white/10 hover:border-white/20 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-xl flex items-center justify-center gap-3 text-sm group relative overflow-hidden cursor-pointer disabled:cursor-not-allowed"
                    >
                      {loadingAction === 'google' ? (
                        <>
                          <Loader2 size={16} className="animate-spin text-chess-accent" />
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
                  )}
                </form>
              </div>
            </div>

            {/* ─── Right Side: Premium Branding (5 cols) ───── */}
            <div className="md:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-[#131d33]/50 relative overflow-hidden">
              
              {/* Graphic Chessboard Design Effect */}
              <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{
                  backgroundImage: `radial-gradient(circle at top right, #38BDF8 10%, transparent 80%)`,
                }}
              />
              <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-chess-accent/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col items-center justify-center h-full text-center py-4 relative z-10">
                {/* Chess-OP Logo Icon */}
                <div className="relative mb-5">
                  <div className="absolute inset-0 bg-chess-accent/20 blur-3xl rounded-full scale-150" />
                  <div className="relative w-[88px] h-[88px] bg-gradient-to-br from-chess-accent/15 to-[#1e293b]/50 border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md">
                    <img
                      src="/logo/Logo-icon.png"
                      alt="Chess-OP"
                      className="h-[56px] w-[56px] object-contain drop-shadow-xl"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = '<span class="text-[44px]">♟️</span>';
                      }}
                    />
                  </div>
                </div>

                <h1 className="text-[26px] font-serif font-bold text-white mb-2 tracking-tight">
                  Chess<span className="text-chess-accent">-OP</span>
                </h1>
                
                <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-chess-accent/50 to-transparent rounded-full mb-5" />

                <p className="text-chess-text-secondary text-[13px] max-w-[260px] leading-relaxed font-medium">
                  Connect your profile to synchronize opening blunder libraries and calculate game metrics.
                </p>
              </div>

              {/* Minimalist Sub-Footer */}
              <div className="pt-4 border-t border-white/5 flex justify-center text-[10px] text-chess-text-secondary/40 font-semibold uppercase tracking-wider relative z-10 mt-auto">
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