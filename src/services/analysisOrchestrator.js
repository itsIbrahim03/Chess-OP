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

import { getUserProfile } from './userService';
import { isGameProcessed, markGameProcessed, getUserPlaylists, savePendingPuzzles, saveNewPuzzles } from './puzzleService';
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
export async function analyzeUserGames(userId, onProgress = () => { }, options = {}) {
    const {
        timeControls = ['blitz', 'rapid', 'classical'],
        maxGames = 10,
        dateRange = 'all' // '7', '30', '90', 'all'
    } = options;

    const results = {
        rawGamesFetched: 0,
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

        // Step 1: Get user profile and settings
        onProgress({ stage: 'Fetching user profile...', progress: 0 });
        const profile = await getUserProfile(userId);
        const lichessUsername = profile?.lichessUsername;
        const minElo = profile?.settings?.minElo || 1000;
        const engineDepth = profile?.settings?.engineDepth || 14;

        if (!lichessUsername) {
            throw new Error('No Lichess account linked. Please link your account in Settings.');
        }

        // Calculate remaining playlist capacity space (max 60 total in standard playlists 1, 2, 3)
        const playlists = await getUserPlaylists(userId);
        const totalCurrentPuzzles = playlists
            .filter(pl => pl.playlistIndex <= 2)
            .reduce((sum, pl) => sum + pl.total, 0);
        const maxNewPuzzlesAllowed = Math.max(0, 60 - totalCurrentPuzzles);

        if (maxNewPuzzlesAllowed === 0) {
            throw new Error('Ingestion blocked: Your training playlists are fully populated (60/60 puzzles). Clear some playlists or train them to free up space.');
        }

        // Step 2: Fetch recent games from Lichess
        onProgress({ stage: `Fetching games for ${lichessUsername}...`, progress: 10 });
        
        let since = null;
        if (dateRange !== 'all') {
            const days = parseInt(dateRange, 10);
            since = Date.now() - days * 24 * 60 * 60 * 1000;
        }
        const perfType = timeControls.join(',');

        const games = await lichessApi.fetchUserGames(lichessUsername, maxGames, perfType, since);
        results.rawGamesFetched = games.length;
        
        // Filter games based on user's minElo setting (at least one player must be >= minElo)
        const filteredGames = games.filter(g => {
            const wRating = g.players?.white?.rating || 0;
            const bRating = g.players?.black?.rating || 0;
            return wRating >= minElo || bRating >= minElo;
        });

        results.gamesFetched = filteredGames.length;

        if (filteredGames.length === 0) {
            onProgress({ stage: 'No games matching ELO filter found', progress: 100 });
            return results;
        }

        // Step 3: Filter out already processed games (deduplication)
        onProgress({ stage: 'Checking for new games...', progress: 20 });
        const newGames = [];

        for (const game of filteredGames) {
            const gameId = game.id;
            const alreadyProcessed = await isGameProcessed(userId, gameId);

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
        let puzzlesCount = 0;

        for (let i = 0; i < newGames.length; i++) {
            // Stop analyzing immediately if we hit our capacity limit
            if (puzzlesCount >= maxNewPuzzlesAllowed) {
                console.log(`Scan stopped early: reached maximum playlist capacity space (${maxNewPuzzlesAllowed})`);
                break;
            }

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
                const puzzles = await gameAnalyzer.analyze(game, lichessUsername === game.players?.white?.user?.name ? 'white' : 'black', engineDepth);

                if (puzzles && puzzles.length > 0) {
                    const remainingSpace = maxNewPuzzlesAllowed - puzzlesCount;
                    const puzzlesToTake = puzzles.slice(0, remainingSpace);

                    // Add gameId to each puzzle for tracking
                    const puzzlesWithGameId = puzzlesToTake.map(puzzle => ({
                        ...puzzle,
                        gameId,
                        gameUrl: `https://lichess.org/${gameId}`
                    }));

                    allPuzzles.push(...puzzlesWithGameId);
                    puzzlesCount += puzzlesToTake.length;
                    results.puzzlesGenerated += puzzlesToTake.length;
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

        // Step 7: Save all puzzles to Firestore as PENDING (not final) so user can choose name/playlist
        if (allPuzzles.length > 0) {
            onProgress({ stage: 'Saving pending puzzles to cache...', progress: 90 });
            await savePendingPuzzles(userId, allPuzzles);
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
        const profile = await getUserProfile(userId);
        const lichessUsername = profile?.lichessUsername;
        const minElo = profile?.settings?.minElo || 1000;
        const engineDepth = profile?.settings?.engineDepth || 14;

        if (!lichessUsername) {
            throw new Error('No Lichess account linked');
        }

        onProgress({ stage: 'Fetching recent game...', progress: 20 });
        const games = await lichessApi.fetchUserGames(lichessUsername, 1); // Just 1 game
        
        // Filter games based on user's minElo setting (at least one player must be >= minElo)
        const filteredGames = games.filter(g => {
            const wRating = g.players?.white?.rating || 0;
            const bRating = g.players?.black?.rating || 0;
            return wRating >= minElo || bRating >= minElo;
        });

        results.gamesFetched = filteredGames.length;

        if (filteredGames.length === 0) {
            onProgress({ stage: 'Game skipped due to ELO filter settings', progress: 100 });
            return results;
        }

        const game = filteredGames[0];
        const gameId = game.id;

        // Check if already processed
        const alreadyProcessed = await isGameProcessed(userId, gameId);
        if (alreadyProcessed) {
            results.gamesSkipped = 1;
            onProgress({ stage: 'Game already analyzed', progress: 100 });
            return results;
        }

        onProgress({ stage: 'Analyzing game...', progress: 50 });
        const puzzles = await gameAnalyzer.analyze(game, lichessUsername === game.players?.white?.user?.name ? 'white' : 'black', engineDepth);

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
