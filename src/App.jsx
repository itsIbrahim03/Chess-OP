import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EngineTest from "./pages/EngineTest";

// Wrapper component that redirects to login if user is not authenticated
// This protects routes that require login
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider wraps everything to share user state across all components */}
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/test-engine" element={<EngineTest />} />
          {/* Dashboard is wrapped in ProtectedRoute - only accessible after login */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}