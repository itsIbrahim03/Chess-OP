import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail
} from "firebase/auth";
import { initializeUserProfile, updateDailyStreak } from '../services/userService';


// Context API - allows sharing user state across the entire app without prop drilling
const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Set persistence state.
   */
  const applyPersistence = async (rememberMe) => {
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    if (rememberMe) {
      localStorage.setItem('chess-op-remember-me', 'true');
    } else {
      localStorage.removeItem('chess-op-remember-me');
    }
  };

  /**
   * Login with Google popup.
   */
  const login = async (rememberMe = false) => {
    await applyPersistence(rememberMe);
    return signInWithPopup(auth, googleProvider);
  };

  /**
   * Login with Email and Password.
   */
  const loginWithEmail = async (email, password, rememberMe = false) => {
    await applyPersistence(rememberMe);
    return signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Signup with Email and Password.
   */
  const signupWithEmail = async (email, password, displayName, rememberMe = false) => {
    await applyPersistence(rememberMe);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Set display name in the Auth profile
    if (displayName && displayName.trim()) {
      await updateProfile(userCredential.user, {
        displayName: displayName.trim()
      });
    }
    // Automatically send email verification link
    await sendEmailVerification(userCredential.user);
    return userCredential;
  };

  /**
   * Send Password Reset Email.
   */
  const resetPassword = async (email) => {
    const actionCodeSettings = {
      url: `${window.location.origin}/verify`,
      handleCodeInApp: true,
    };
    return sendPasswordResetEmail(auth, email, actionCodeSettings);
  };

  const logout = async () => {
    localStorage.removeItem('chess-op-remember-me');
    return signOut(auth);
  };

  // Listen for auth state changes (login/logout events)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Initialize user profile in Firestore on first login
      if (currentUser) {
        try {
          await initializeUserProfile(currentUser);
          // Update Chess-OP daily visit streak (non-fatal)
          updateDailyStreak(currentUser.uid).catch(() => {});
        } catch (error) {
          console.error('Failed to initialize user profile:', error);
        }
      }

      setLoading(false);
    });
    return unsubscribe; // Clean up listener when component unmounts
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginWithEmail, signupWithEmail, logout, resetPassword, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to access auth context in any component
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);