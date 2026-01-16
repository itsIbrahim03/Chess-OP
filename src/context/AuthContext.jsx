import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { initializeUserProfile } from '../services/userService';

// Context API - allows sharing user state across the entire app without prop drilling
const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = () => signInWithPopup(auth, googleProvider);
  const logout = () => signOut(auth);

  // Listen for auth state changes (login/logout events)
  // onAuthStateChanged returns an unsubscribe function for cleanup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Initialize user profile in Firestore on first login
      if (currentUser) {
        try {
          await initializeUserProfile(currentUser);
        } catch (error) {
          console.error('Failed to initialize user profile:', error);
        }
      }

      setLoading(false);
    });
    return unsubscribe; // Clean up listener when component unmounts
  }, []);

  // Don't render children until we know the auth state to prevent flashing
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to access auth context in any component
export const useAuth = () => useContext(AuthContext);