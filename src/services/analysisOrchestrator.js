/**
 * Analysis Orchestrator - Coordinates the entire puzzle generation pipeline
 * 
 * Pipeline:
 * 1. Get user's Lichess username from Firestore
 * 2. Fetch recent games from Lichess API
 * 3. Filter out already processed games (deduplication)
 * 4. Analyze each game with Stockfish
 * 5. Save puzzles to Firestore with rotation algorithm
 * 6. Mark games as processed
 */

import { getLichessUsername } from './userService';
import { saveNewPuzzles, isGameProcessed, markGameProcessed } from './puzzleService';
import { lichessApi } from '../lib/lichessApi';
import { gameAnalyzer } from '../lib/gameAnalyzer';
import { engineService } from './engineService';

/**
 * Main orchestrator function - analyzes recent games and saves puzzles
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeUserGames(userId, onProgress = () => { }) {
    const results = {
        gamesFetched: 0,
        gamesAnalyzed: 0,
        gamesSkipped: 0,
        puzzlesGenerated: 0,
        errors: []
    };

    try {
        // Step 0: Initialize Stockfish engine
        engineService.init();

        // Wait for engine to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 1: Get Lichess username
        onProgress({ stage: 'Fetching user profile...', progress: 0 });
        const lichessUsername = await getLichessUsername(userId);

        if (!lichessUsername) {
            throw new Error('No Lichess account linked. Please link your account in Settings.');
        }

        // Step 2: Fetch recent games from Lichess
        onProgress({ stage: `Fetching games for ${lichessUsername}...`, progress: 10 });
        const games = await lichessApi.fetchUserGames(lichessUsername, 10); // Fetch 10 most recent
        results.gamesFetched = games.length;

        if (games.length === 0) {
            onProgress({ stage: 'No games found', progress: 100 });
            return results;
        }

        // Step 3: Filter out already processed games (deduplication)
        onProgress({ stage: 'Checking for new games...', progress: 20 });
        const newGames = [];

        for (const game of games) {
            const gameId = game.id;
            const alreadyProcessed = await isGameProcessed(gameId);

            if (!alreadyProcessed) {
                newGames.push(game);
            } else {
                results.gamesSkipped++;
            }
        }

        if (newGames.length === 0) {
            onProgress({ stage: 'All games already analyzed', progress: 100 });
            return results;
        }

        // Step 4 & 5: Analyze each game and collect puzzles
        const allPuzzles = [];

        for (let i = 0; i < newGames.length; i++) {
            const game = newGames[i];
            const gameId = game.id;
            const progress = 20 + ((i + 1) / newGames.length) * 60; // 20-80%

            try {
                onProgress({
                    stage: `Analyzing game ${i + 1}/${newGames.length}...`,
                    progress,
                    currentGame: gameId
                });

                // Analyze game with Stockfish
                const puzzles = await gameAnalyzer.analyze(game, lichessUsername === game.players?.white?.user?.name ? 'white' : 'black');

                if (puzzles && puzzles.length > 0) {
                    // Add gameId to each puzzle for tracking
                    const puzzlesWithGameId = puzzles.map(puzzle => ({
                        ...puzzle,
                        gameId,
                        gameUrl: `https://lichess.org/${gameId}`
                    }));

                    allPuzzles.push(...puzzlesWithGameId);
                    results.puzzlesGenerated += puzzles.length;
                }

                results.gamesAnalyzed++;

                // Step 6: Mark game as processed
                await markGameProcessed(userId, gameId, puzzles?.length || 0);

            } catch (error) {
                console.error(`Failed to analyze game ${gameId}:`, error);
                results.errors.push({ gameId, error: error.message });
                // Continue with next game even if one fails
            }
        }

        // Step 7: Save all puzzles to Firestore with rotation
        if (allPuzzles.length > 0) {
            onProgress({ stage: 'Saving puzzles to database...', progress: 90 });
            await saveNewPuzzles(userId, allPuzzles);
        }

        onProgress({
            stage: 'Analysis complete!',
            progress: 100,
            results
        });

        return results;

    } catch (error) {
        console.error('Analysis orchestrator failed:', error);
        throw error;
    }
}

/**
 * Quick analysis - analyzes just 1-2 games for testing
 */
export async function quickAnalyze(userId, onProgress = () => { }) {
    const results = {
        gamesFetched: 0,
        gamesAnalyzed: 0,
        gamesSkipped: 0,
        puzzlesGenerated: 0,
        errors: []
    };

    try {
        // Initialize Stockfish engine
        engineService.init();
        await new Promise(resolve => setTimeout(resolve, 500));

        onProgress({ stage: 'Fetching user profile...', progress: 0 });
        const lichessUsername = await getLichessUsername(userId);

        if (!lichessUsername) {
            throw new Error('No Lichess account linked');
        }

        onProgress({ stage: 'Fetching recent game...', progress: 20 });
        const games = await lichessApi.fetchUserGames(lichessUsername, 1); // Just 1 game
        results.gamesFetched = games.length;

        if (games.length === 0) {
            return results;
        }

        const game = games[0];
        const gameId = game.id;

        // Check if already processed
        const alreadyProcessed = await isGameProcessed(gameId);
        if (alreadyProcessed) {
            results.gamesSkipped = 1;
            onProgress({ stage: 'Game already analyzed', progress: 100 });
            return results;
        }

        onProgress({ stage: 'Analyzing game...', progress: 50 });
        const puzzles = await gameAnalyzer.analyze(game, lichessUsername === game.players?.white?.user?.name ? 'white' : 'black');

        if (puzzles && puzzles.length > 0) {
            const puzzlesWithGameId = puzzles.map(puzzle => ({
                ...puzzle,
                gameId,
                gameUrl: `https://lichess.org/${gameId}`
            }));

            results.puzzlesGenerated = puzzles.length;
            results.gamesAnalyzed = 1;

            onProgress({ stage: 'Saving puzzles...', progress: 80 });
            await saveNewPuzzles(userId, puzzlesWithGameId);
            await markGameProcessed(userId, gameId, puzzles.length);
        }

        onProgress({ stage: 'Complete!', progress: 100, results });
        return results;

    } catch (error) {
        console.error('Quick analyze failed:', error);
        throw error;
    }
}
