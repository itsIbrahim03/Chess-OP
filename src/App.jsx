import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Repertoire from "./pages/Repertoire";
import Settings from "./pages/Settings";
import TrainingArena from "./pages/TrainingArena";
import Onboarding from "./pages/Onboarding";
import AnalysisBoard from "./pages/AnalysisBoard";
import VerificationGate from "./pages/VerificationGate";
import VerifyAction from "./pages/VerifyAction";

// Wrapper component that redirects to login if user is not authenticated
// This protects routes that require login and email verification
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!user.emailVerified) return <Navigate to="/verification-gate" replace />;
  return children;
};

// Wrapper component for the waiting room to ensure the user is logged in
const VerificationGateRoute = ({ children }) => {
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
            path="/verification-gate"
            element={
              <VerificationGateRoute>
                <VerificationGate />
              </VerificationGateRoute>
            }
          />
          <Route path="/verify" element={<VerifyAction />} />
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

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}