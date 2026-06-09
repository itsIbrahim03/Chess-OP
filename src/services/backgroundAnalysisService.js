import { analyzeUserGames } from './analysisOrchestrator';

class BackgroundAnalysisService {
    constructor() {
        this.isRunning = false;
        this.progress = { stage: '', progress: 0 };
        this.results = null;
        this.error = null;
        this.listeners = new Set();
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener({
            isRunning: this.isRunning,
            progress: this.progress,
            results: this.results,
            error: this.error
        });
        return () => this.listeners.delete(listener);
    }

    notify() {
        const state = {
            isRunning: this.isRunning,
            progress: this.progress,
            results: this.results,
            error: this.error
        };
        this.listeners.forEach(listener => {
            try { listener(state); } catch (e) { console.error(e); }
        });
    }

    async start(userId, options) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.progress = { stage: 'Initializing...', progress: 0 };
        this.results = null;
        this.error = null;
        this.notify();

        try {
            const finalResults = await analyzeUserGames(
                userId,
                (progressUpdate) => {
                    this.progress = {
                        stage: progressUpdate.stage,
                        progress: progressUpdate.progress
                    };
                    if (progressUpdate.results) {
                        this.results = progressUpdate.results;
                    }
                    this.notify();
                },
                options
            );
            this.results = finalResults;
            this.isRunning = false;
            this.notify();
        } catch (err) {
            console.error('Background analysis failed:', err);
            this.error = err.message || 'An error occurred during game scanning.';
            this.isRunning = false;
            this.notify();
        }
    }

    reset() {
        this.isRunning = false;
        this.progress = { stage: '', progress: 0 };
        this.results = null;
        this.error = null;
        this.notify();
    }
}

export const backgroundAnalysisService = new BackgroundAnalysisService();
