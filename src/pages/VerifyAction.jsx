import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { applyActionCode, confirmPasswordReset } from "firebase/auth";
import { CheckCircle2, XCircle, Loader2, ArrowRight, Lock, Eye, EyeOff, Info } from "lucide-react";

export default function VerifyAction() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // "loading" | "success" | "error" | "resetPassword"
  const [errorMessage, setErrorMessage] = useState("");

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  // Reset password states
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [resetError, setResetError] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setStatus("error");
      setErrorMessage("The verification link is missing its secure code token.");
      return;
    }

    if (mode === "resetPassword") {
      setStatus("resetPassword");
      return;
    }

    const verifyToken = async () => {
      try {
        await applyActionCode(auth, oobCode);
        setStatus("success");
        
        // Auto-redirect to dashboard after 3 seconds for email verification
        const timer = setTimeout(() => {
          navigate("/dashboard");
        }, 3000);
        return () => clearTimeout(timer);
      } catch (err) {
        console.error("Firebase action error:", err);
        setStatus("error");
        
        // Translate error codes safely
        const code = err.code || "";
        if (code === "auth/invalid-action-code") {
          setErrorMessage("This verification link has expired, was already used, or is invalid.");
        } else if (code === "auth/expired-action-code") {
          setErrorMessage("This verification link has expired. Please request a new one.");
        } else if (code === "auth/user-disabled") {
          setErrorMessage("This account has been disabled. Please contact support.");
        } else {
          setErrorMessage("Verification failed due to a network or server issue. Please try again.");
        }
      }
    };

    verifyToken();
  }, [oobCode, mode, navigate]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (isResetting) return;
    
    setResetError("");

    // Validate password constraints
    if (!password) {
      setResetError("Please enter your new password.");
      return;
    }
    if (password.length < 8) {
      setResetError("Password must be at least 8 characters long.");
      return;
    }
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    if (!hasUpper || !hasLower || !hasNum) {
      setResetError("Password does not meet all requirements.");
      return;
    }
    if (password !== confirmPassword) {
      setResetError("Passwords do not match.");
      return;
    }

    setIsResetting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus("success");
      setErrorMessage(""); // clear
      
      // Auto-redirect to login after 3 seconds on password reset success
      const timer = setTimeout(() => {
        navigate("/login");
      }, 3000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Password reset error:", err);
      const code = err.code || "";
      if (code === "auth/invalid-action-code") {
        setResetError("This password reset link has expired, was already used, or is invalid.");
      } else if (code === "auth/expired-action-code") {
        setResetError("This password reset link has expired. Please request a new one.");
      } else {
        setResetError("Reset failed due to a network or server issue. Please try again.");
      }
    } finally {
      setIsResetting(false);
    }
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
      <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] bg-chess-accent/6 blur-[180px] rounded-full animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-med/8 blur-[160px] rounded-full animate-pulse pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-[420px] relative z-10">
        <div className="absolute -inset-px bg-gradient-to-b from-chess-accent/20 via-white/5 to-chess-accent/10 rounded-2xl blur-[1.5px]" />
        
        <div className="relative bg-chess-panel/40 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_48px_96px_-24px_rgba(0,0,0,0.8)] p-8 sm:p-10 flex flex-col items-center text-center">
          
          {/* Action icon based on status */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-chess-accent/20 blur-3xl rounded-full scale-150" />
            <div className={`relative w-20 h-20 bg-gradient-to-br border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl backdrop-blur-md ${
              status === "loading" || status === "resetPassword"
                ? "from-chess-accent/15 to-[#1e293b]/50 animate-pulse" 
                : status === "success" 
                ? "from-emerald-500/15 to-[#1e293b]/50" 
                : "from-rose-500/15 to-[#1e293b]/50"
            }`}>
              {status === "loading" && (
                <Loader2 size={32} className="text-chess-accent animate-spin" />
              )}
              {status === "success" && (
                <CheckCircle2 size={32} className="text-emerald-400" />
              )}
              {status === "error" && (
                <XCircle size={32} className="text-rose-400" />
              )}
              {status === "resetPassword" && (
                <Lock size={32} className="text-chess-accent" />
              )}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-xl font-bold text-white mb-3">
            {status === "loading" && "Verifying Token..."}
            {status === "success" && (mode === "resetPassword" ? "Password Reset Complete" : "Verification Complete")}
            {status === "error" && "Link Verification Failed"}
            {status === "resetPassword" && "Reset Password"}
          </h2>
          
          {/* Subtext */}
          {status !== "resetPassword" && (
            <p className="text-chess-text-secondary text-sm leading-relaxed mb-6 font-medium">
              {status === "loading" && "Applying secure verification token to your account profile."}
              {status === "success" && (mode === "resetPassword" 
                ? "Your password has been successfully updated. Redirecting you to the login page..." 
                : "Your email has been securely verified. Redirecting you to your dashboard shortly...")}
              {status === "error" && errorMessage}
            </p>
          )}

          {/* Reset password form */}
          {status === "resetPassword" && (
            <form onSubmit={handleResetPassword} className="w-full text-left space-y-4" noValidate>
              {resetError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-semibold text-center animate-in">
                  {resetError}
                </div>
              )}

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between pb-0.5">
                  <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">New Password</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowRequirements(!showRequirements)}
                      onMouseEnter={() => setShowRequirements(true)}
                      onMouseLeave={() => setShowRequirements(false)}
                      className="text-chess-text-secondary hover:text-white transition-colors p-0.5 focus:outline-none"
                    >
                      <Info size={14} />
                    </button>
                    
                    {showRequirements && (
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#1b253b] border border-white/10 rounded-xl p-4 shadow-2xl z-30 text-left animate-in">
                        <h4 className="text-xs font-bold text-white mb-2 uppercase tracking-wide">Password Requirements</h4>
                        <ul className="space-y-1.5 text-[11px] text-chess-text-secondary font-medium">
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-chess-accent" />
                            At least 8 characters
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-chess-accent" />
                            At least one uppercase letter
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-chess-accent" />
                            At least one lowercase letter
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-chess-accent" />
                            At least one number (0-9)
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-lg py-2.5 px-10 pr-11 focus:outline-none focus:border-chess-accent/40 text-sm font-medium transition-colors placeholder:text-chess-text-secondary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-chess-text-secondary uppercase tracking-widest block">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary" size={16} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-chess-bg/75 border border-white/10 text-white rounded-lg py-2.5 px-10 pr-11 focus:outline-none focus:border-chess-accent/40 text-sm font-medium transition-colors placeholder:text-chess-text-secondary/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-chess-text-secondary hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isResetting}
                className="w-full font-bold py-3 px-6 rounded-lg bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-lg flex items-center justify-center gap-2 mt-4 text-sm hover:-translate-y-0.5 border border-white"
              >
                {isResetting ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-chess-bg" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </form>
          )}

          {/* Action buttons (Verified state) */}
          {status === "success" && (
            <button
              onClick={() => navigate(mode === "resetPassword" ? "/login" : "/dashboard")}
              className="w-full py-3 px-6 rounded-lg font-bold bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-md flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 border border-white"
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          )}

          {status === "error" && (
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3 px-6 rounded-lg font-bold bg-white hover:bg-gray-100 text-gray-900 transition-all shadow-md flex items-center justify-center gap-2 text-sm hover:-translate-y-0.5 border border-white"
            >
              <span>Back to Login</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
