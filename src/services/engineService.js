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
                console.log('Stockfish Engine Service: Ready');
            }

            // Notify all subscribers of the engine's response
            this.listeners.forEach(callback => callback(message));
        };

        this.worker.onerror = (err) => {
            console.error('Stockfish Worker Error:', err.message, err);
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

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

// Export singleton instance - shared across the entire app
export const engineService = new EngineService();
