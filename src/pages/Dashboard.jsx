import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { lichessApi } from "../lib/lichessApi";
import { gameAnalyzer } from "../lib/gameAnalyzer";
import { engineService } from "../services/engineService";
import { CustomChessboard } from "../components/CustomChessboard";
import { Chess } from "chess.js";

// Isolated Puzzle Component for cleaner lifecycle and validation
function PuzzleCard({ puzzle, index }) {
  // CLIENT-SIDE VALIDATION
  try {
    const tempChess = new Chess(puzzle.fen);
  } catch (e) {
    // console.error(`[Puzzle ${index}] FEN INVALID:`, puzzle.fen, e); // Debug log removed
  }

  return (
    <div style={{ background: "white", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", transition: "transform 0.2s" }}>
      <div style={{ padding: "15px", background: "#f5f5f5", borderBottom: "1px solid #eee" }}>
        <h4 style={{ margin: 0, color: "#333" }}>{puzzle.openingName}</h4>
        {/* Removed: <small>{puzzle.fen}</small> */}
      </div>

      <div style={{ padding: "15px" }}>
        <div style={{ marginBottom: "10px", textAlign: "center", fontWeight: "bold", color: "#666" }}>
          {puzzle.playerColor === 'white' ? "White" : "Black"} to move
        </div>

        <div style={{ width: "100%", maxWidth: "280px", margin: "0 auto" }}>

          <CustomChessboard
            fen={puzzle.fen}
            boardWidth={280}
            orientation={puzzle.playerColor}
          />
        </div>

        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#555", marginBottom: "8px" }}>
            Find the best move for <strong>{puzzle.playerColor}</strong>
          </p>

          <p style={{ margin: "5px 0", fontSize: "14px" }}>
            You played: <strong style={{ color: "#d32f2f" }}>{puzzle.playerMove}</strong>
          </p>
          <p style={{ margin: "5px 0", fontSize: "14px", color: "#2e7d32" }}>
            Best move: <strong>{puzzle.correctMove}</strong>
          </p>
        </div>

        <a
          href={puzzle.gameUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            marginTop: "15px",
            textAlign: "center",
            color: "#2196F3",
            textDecoration: "none",
            fontSize: "13px",
            border: "1px solid #e3f2fd",
            padding: "8px",
            borderRadius: "4px"
          }}
        >
          View Game on Lichess
        </a>
      </div>
    </div>
  );
}

// Protected page - only accessible to logged-in users
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [lichessUsername, setLichessUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [puzzles, setPuzzles] = useState([]);
  const [status, setStatus] = useState("");

  const handleStartAnalysis = async () => {
    if (!lichessUsername) return alert("Please enter a Lichess username");

    setIsAnalyzing(true);
    setStatus("Connecting to engine...");
    engineService.init();

    try {
      setStatus(`Fetching last 30 Rapid/Blitz/Classical games for ${lichessUsername}...`);
      const games = await lichessApi.fetchUserGames(lichessUsername, 30); // Fetch last 30 games

      setStatus(`Found ${games.length} games. Starting analysis...`);
      const allFoundPuzzles = [];

      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        setStatus(`Analyzing game ${i + 1}/${games.length}...`);

        // Determine player color
        // Note: Lichess username might differ in case, or be missing context if anonymous
        let playerColor = 'white';
        if (game.players?.white?.user?.name?.toLowerCase() === lichessUsername.toLowerCase()) {
          playerColor = 'white';
        } else if (game.players?.black?.user?.name?.toLowerCase() === lichessUsername.toLowerCase()) {
          playerColor = 'black';
        } else {
          // Fallback or skip? For now, we assume user plays white if not found (or maybe they entered opponent's name)
          // But let's log it
          console.warn(`Could not determine color for ${lichessUsername} in game ${game.id}. Defaulting to white.`);
        }

        const gamePuzzles = await gameAnalyzer.analyze(game, playerColor);
        allFoundPuzzles.push(...gamePuzzles);
      }

      setPuzzles(allFoundPuzzles);
      setStatus(`Analysis complete! Found ${allFoundPuzzles.length} puzzles.`);
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Chess-OP Dashboard</h1>
          <p style={{ margin: "5px 0 0", color: "#666" }}>Welcome, {user?.displayName}</p>
        </div>
        <button onClick={logout} style={{ background: "#ff4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer" }}>Logout</button>
      </header>

      <section style={{ background: "white", padding: "25px", borderRadius: "12px", boxShadow: "0 4px 6px rgba(0,0,0,0.05)", marginBottom: "30px" }}>
        <h3 style={{ marginTop: 0 }}>Analyze Your Lichess Games</h3>
        <div style={{ display: "flex", gap: "15px", marginBottom: "15px" }}>
          <input
            type="text"
            placeholder="Enter Lichess Username"
            value={lichessUsername}
            onChange={(e) => setLichessUsername(e.target.value)}
            style={{ padding: "12px", flex: 1, borderRadius: "6px", border: "1px solid #ddd", fontSize: "16px" }}
            disabled={isAnalyzing}
          />
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            style={{
              padding: "12px 25px",
              background: isAnalyzing ? "#ccc" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              fontSize: "16px",
              fontWeight: "bold"
            }}
          >
            {isAnalyzing ? "Analyzing..." : "Find My Blunders"}
          </button>
        </div>
        {status && <div style={{ padding: "10px", background: "#f8f9fa", borderRadius: "4px", color: "#555" }}>{status}</div>}
      </section>

      <section>
        <h2 style={{ marginBottom: "20px" }}>Your Personal Puzzle Feed ({puzzles.length})</h2>
        {puzzles.length === 0 && !isAnalyzing && (
          <div style={{ textAlign: "center", padding: "40px", color: "#888", background: "#f9f9f9", borderRadius: "12px" }}>
            <p>No puzzles found yet. Enter your username above to start!</p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "25px" }}>
          {puzzles.map((puzzle, index) => (
            <PuzzleCard key={puzzle.id} puzzle={puzzle} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}