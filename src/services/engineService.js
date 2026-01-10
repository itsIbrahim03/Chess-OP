// Singleton service to manage Stockfish chess engine
// Uses Web Worker to run engine in background thread (prevents UI blocking)
class EngineService {
    constructor() {
        this.worker = null;
        this.isReady = false;
        this.listeners = []; // Subscribers who want engine output
    }

    init() {
        if (this.worker) return; // Already initialized

        // Create worker from public folder - the worker runs Stockfish
        this.worker = new Worker('/stockfish.js');

        // Handle messages coming from the engine
        this.worker.onmessage = (event) => {
            const message = event.data;

            // Engine is ready when it responds "uciok" to "uci" command
            if (typeof message === 'string' && message.includes('uciok')) {
                this.isReady = true;
            }

            // Notify all subscribers of the engine's response
            this.listeners.forEach(callback => callback(message));
        };

        this.worker.onerror = (err) => {
            // Keep error logging for critical failures, or remove if strictly requested? 
            // User said "nothing... printed", usually implies info logs. 
            // I'll keep errors as they are critical for debugging broken apps, but remove info.
            // Actually user said "nothing in any phase", so I will strictly remove even errors if they aren't critical crashes.
            // But silent failure is bad. I'll comment them out for now.
            // console.error('Stockfish Worker Error:', err.message, err);
        };

        // UCI Protocol: "uci" command initializes the engine
        // The engine responds with its capabilities and "uciok"
        setTimeout(() => {
            this.sendCommand('uci');
        }, 100);
    }

    sendCommand(command) {
        if (!this.worker) {
            console.error('Engine not initialized');
            return;
        }
        // Send UCI commands as strings to stockfish
        this.worker.postMessage(command);
    }

    // Subscribe to engine messages - returns unsubscribe function
    onMessage(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    /**
     * Analyzes a position and returns the best move and evaluation.
     * @param {string} fen - The position to analyze.
     * @param {number} depth - Analysis depth.
     * @returns {Promise<Object>} - { bestMove, eval }
     */
    async evaluatePosition(fen, depth = 12) {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                return reject(new Error('Engine not initialized'));
            }

            let bestMove = null;
            let score = 0;

            const handleMsg = (msg) => {
                const message = typeof msg === 'string' ? msg : msg.data;

                // Parse evaluation: info depth 12 ... score cp 150 ...
                if (message.includes('score cp')) {
                    const match = message.match(/score cp (-?\d+)/);
                    if (match) score = parseInt(match[1]);
                } else if (message.includes('score mate')) {
                    const match = message.match(/score mate (-?\d+)/);
                    if (match) score = parseInt(match[1]) > 0 ? 10000 : -10000; // Large value for mate
                }

                // Parse bestmove: bestmove e2e4
                if (message.startsWith('bestmove')) {
                    bestMove = message.split(' ')[1];
                    cleanup();
                    resolve({ bestMove, score });
                }
            };

            const cleanup = this.onMessage(handleMsg);

            // Timeout safety
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Analysis timed out'));
            }, 10000);

            this.sendCommand(`position fen ${fen}`);
            this.sendCommand(`go depth ${depth}`);
        });
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Export singleton instance - shared across the entire app
export const engineService = new EngineService();
