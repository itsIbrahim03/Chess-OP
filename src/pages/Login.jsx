import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Welcome to Chess-OP</h1>
      <button onClick={login} style={{ padding: "10px 20px" }}>
        Sign in with Google
      </button>
    </div>
  );
}