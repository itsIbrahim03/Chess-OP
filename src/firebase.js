import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAxqyNuFOnSlRJCxsv-ekxBuEkYq1KbH5Q",
  authDomain: "chess-op-45485.firebaseapp.com",
  projectId: "chess-op-45485",
  storageBucket: "chess-op-45485.firebasestorage.app",
  messagingSenderId: "195557548464",
  appId: "1:195557548464:web:0bc1ff292149c6d0587675"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);