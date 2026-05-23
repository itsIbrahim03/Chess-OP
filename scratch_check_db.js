import { db } from './src/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';

async function checkData() {
  const q = query(collection(db, 'puzzles'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("No puzzles found in DB");
    return;
  }
  const data = snap.docs[0].data();
  console.log("Puzzle ID:", snap.docs[0].id);
  console.log("Puzzle Data Keys:", Object.keys(data));
  console.log("FEN field content:", data.fen);
  console.log("FEN field (uppercase) content:", data.FEN);
}

checkData();
