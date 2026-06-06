import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Repertoire from "./pages/Repertoire";
import Settings from "./pages/Settings";
import TrainingArena from "./pages/TrainingArena";
import ChessgroundTest from "./pages/ChessgroundTest";
import Onboarding from "./pages/Onboarding";
import AnalysisBoard from "./pages/AnalysisBoard";

// Wrapper component that redirects to login if user is not authenticated
// This protects routes that require login
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider wraps everything to share user state across all components */}
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/repertoire"
            element={
              <ProtectedRoute>
                <Repertoire />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analysis-board"
            element={
              <ProtectedRoute>
                <AnalysisBoard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/train"
            element={
              <ProtectedRoute>
                <TrainingArena />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/test-board"
            element={
              <ProtectedRoute>
                <ChessgroundTest />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}