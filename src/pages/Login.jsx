import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to Chess-OP</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleLogin} style={{ padding: "10px 20px" }}>
        Sign in with Google
      </button>
    </div>
  );
}