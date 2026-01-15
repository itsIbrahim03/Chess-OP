import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  // Auto-redirect to dashboard if already logged in
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleLogin = async () => {
    try {
      setError(null);
      await login();
    } catch (err) {
      setError(err.message);
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-chess-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-med blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-chess-accent blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md bg-chess-panel border border-white/10 rounded-2xl shadow-2xl p-8 relative z-10 backdrop-blur-sm">
        <button
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 text-chess-text-secondary hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex flex-col items-center mb-8 pt-8">
          <div className="w-16 h-16 bg-gradient-to-br from-brand-med to-brand-dark rounded-2xl flex items-center justify-center shadow-lg shadow-black/30 mb-4">
            <span className="text-4xl">♟️</span>
          </div>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-chess-text-secondary text-center">
            Continue building your repertoire
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-chess-status-error/10 border border-chess-status-error/20 rounded-lg text-chess-status-error text-sm text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full bg-white text-gray-900 hover:bg-gray-100 font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 group"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
          <span>Sign in with Google</span>
        </button>

        <p className="mt-8 text-center text-sm text-chess-text-secondary">
          By signing in, you agree to our <span className="text-chess-accent cursor-pointer hover:underline">Terms</span> and <span className="text-chess-accent cursor-pointer hover:underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}