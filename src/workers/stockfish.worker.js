/* eslint-disable no-restricted-globals */

// Web Worker - runs Stockfish in a separate thread so chess calculations don't freeze the UI
// This worker loads the Stockfish WASM binary and handles communication between main thread and engine

let engine = null;
let isEngineReady = false;

// Load stockfish.js script into the worker context
try {
    importScripts('/stockfish.js');
} catch (err) {
    console.error('Failed to load stockfish.js:', err);
    self.postMessage({ type: 'error', data: 'Failed to load stockfish script: ' + err.message });
}

// Initialize Stockfish engine with WASM support
function initStockfish() {
    if (typeof Stockfish !== 'function') {
        console.error('Stockfish function not found after import');
        self.postMessage({ type: 'error', data: 'Stockfish function not available' });
        return;
    }

    try {
        // Configure where to find the WebAssembly file
        // WASM gives much better performance than pure JavaScript
        engine = Stockfish({
            locateFile: (path) => {
                if (path.endsWith('.wasm')) {
                    return '/stockfish.wasm';
                }
                return path;
            }
        });

        // Set up listener for engine responses
        if (engine && typeof engine.onmessage !== 'undefined') {
            engine.onmessage = function (message) {
                // Forward engine output to main thread
                self.postMessage({ type: 'engine', data: message });

                if (message && message.includes && message.includes('uciok')) {
                    isEngineReady = true;
                }
            };
        } else {
            console.warn('Engine created but no onmessage property');
        }

        // Initialize engine with UCI protocol
        if (engine && engine.postMessage) {
            engine.postMessage('uci');
        }

        self.postMessage({ type: 'system', data: 'Engine loaded' });

    } catch (err) {
        console.error('Failed to initialize Stockfish:', err);
        self.postMessage({ type: 'error', data: 'Failed to initialize engine: ' + err.message });
    }
}

// Wait for scripts to load before initializing
setTimeout(() => {
    if (typeof Stockfish === 'function') {
        initStockfish();
    } else {
        console.error('Stockfish still not defined after timeout');
        self.postMessage({ type: 'error', data: 'Stockfish not available' });
    }
}, 100);

// Handle messages from main thread
self.addEventListener('message', function (event) {
    const { cmd, message } = event.data;

    switch (cmd) {
        case 'send':
            // Forward UCI commands to the engine
            if (engine && engine.postMessage) {
                engine.postMessage(message);
            } else {
                console.error('Engine not ready, cannot send:', message);
                self.postMessage({
                    type: 'error',
                    data: 'Engine not ready'
                });
            }
            break;

        case 'init':
            if (!engine) {
                initStockfish();
            }
            break;

        default:
            console.warn('Unknown command:', cmd);
            break;
    }
});
