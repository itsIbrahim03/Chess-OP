import { useAuth } from "../context/AuthContext";

// Protected page - only accessible to logged-in users
export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>
      <p>Welcome, {user?.displayName}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}