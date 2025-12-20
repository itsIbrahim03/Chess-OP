import { useEffect, useState } from 'react';
import { engineService } from '../services/engineService';

// Test page to verify Stockfish integration is working
export default function EngineTest() {
    const [logs, setLogs] = useState([]);
    const [status, setStatus] = useState('Not Initialized');

    useEffect(() => {
        engineService.init();

        // Subscribe to all engine messages for debugging
        const unsubscribe = engineService.onMessage((msg) => {
            console.log("Engine Msg:", msg);

            const logLine = typeof msg === 'string' ? msg : JSON.stringify(msg);

            if (typeof msg === 'string' && msg.includes('uciok')) {
                setStatus('Ready');
            }

            setLogs(prev => [...prev, logLine]);
        });

        // Clean up subscription when component unmounts
        return () => {
            unsubscribe();
        };
    }, []);

    const runTest = () => {
        engineService.sendCommand('uci');
    };

    // UCI commands to analyze the starting chess position
    // "position startpos" sets up the initial board
    // "go depth 10" tells engine to analyze 10 moves ahead
    const runAnalysis = () => {
        engineService.sendCommand('position startpos');
        engineService.sendCommand('go depth 10');
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'monospace' }}>
            <h1>Stockfish Integration Test</h1>
            <div>Status: <strong>{status}</strong></div>
            <div style={{ margin: '20px 0' }}>
                <button onClick={runTest} style={{ padding: '10px', marginRight: '10px' }}>Send "uci"</button>
                <button onClick={runAnalysis} style={{ padding: '10px' }}>Analyze Start Pos</button>
            </div>
            <div style={{ background: '#f0f0f0', padding: '10px', height: '400px', overflowY: 'auto', border: '1px solid #ccc', color: '#000' }}>
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
        </div>
    );
}
