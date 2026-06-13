/**
 * Puzzle Service - Handles all puzzle-related Firestore operations
 * 
 * Features:
 * - Save new puzzles with 60-puzzle rotation logic
 * - Fetch puzzles for playlists (Recent, History, Archive, Favorites)
 * - Toggle favorite status
 * - Update puzzle review state
 * - Game deduplication
 */

import { db } from '../firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    increment,
    deleteField
} from 'firebase/firestore';

/**
 * Normalize puzzle field names for backward compatibility.
 * The gameAnalyzer originally output openingName/tags/playerColor,
 * but all UI consumers expect opening/theme/userColor.
 */
function normalizePuzzle(data, docId) {
    return {
        ...data,
        id: docId,
        opening: data.opening || data.openingName || 'Unknown Opening',
        theme: data.theme || (Array.isArray(data.tags) ? data.tags[0] : null) || 'Opening Blunder',
        userColor: data.userColor || data.playerColor || 'white',
        playlistIndex: data.playlistIndex !== undefined ? data.playlistIndex : 0
    };
}

/**
 * Get a single puzzle by its Firestore document ID.
 * Used by Training Arena when loading a specific puzzle from history/favorites.
 */
export async function getPuzzleById(puzzleId) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    const snap = await getDoc(puzzleRef);
    if (!snap.exists()) return null;
    return normalizePuzzle(snap.data(), snap.id);
}

/**
 * Save new puzzles to Firestore with rotation logic
 * 
 * - Enters Playlist 1 (playlistIndex = 0) by default
 * - Sequentially rotates oldest puzzles to subsequent playlists (max 20 per playlist)
 * - Deletes oldest puzzles from Playlist 3 if total rotation exceeds 60
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Array} newPuzzles - Array of puzzle objects from gameAnalyzer
 * @returns {Promise<number>} New rotation count
 */
export async function saveNewPuzzles(userId, newPuzzles) {
    if (!newPuzzles || newPuzzles.length === 0) {
        throw new Error('No puzzles to save');
    }

    const stats = await getUserPuzzleStats(userId);
    if (stats.total + newPuzzles.length > 70) {
        throw new Error('REPERTOIRE_LIMIT_EXCEEDED');
    }

    const saveBatch = writeBatch(db);

    newPuzzles.forEach(puzzle => {
        const puzzleRef = doc(collection(db, 'puzzles'));
        // Strip the custom `id` field from gameAnalyzer — Firestore will assign its own doc ID.
        // Keeping it would cause all map functions to return the wrong ID.
        const { id: _customId, ...puzzleData } = puzzle;

        // ── Normalize field names ──────────────────────────────────────
        const opening = puzzleData.openingName || puzzleData.opening || 'Unknown Opening';
        const theme = Array.isArray(puzzleData.tags)
            ? puzzleData.tags[0] || 'Opening Blunder'
            : (puzzleData.theme || 'Opening Blunder');
        const userColor = puzzleData.playerColor || puzzleData.userColor || 'white';

        // Remove the raw analyzer fields so we don't store duplicates
        delete puzzleData.openingName;
        delete puzzleData.tags;
        delete puzzleData.playerColor;

        saveBatch.set(puzzleRef, {
            ...puzzleData,
            opening,
            theme,
            userColor,
            type: 'opening_blunder',
            userId,
            isFavorite: false,
            playlistIndex: 0, // Default to Playlist 1
            status: 'new',
            createdAt: serverTimestamp(),
            reviewState: {
                isSolved: false,
                attempts: 0,
                lastAttempt: null,
                successCount: 0,
                failCount: 0
            }
        });
    });

    await saveBatch.commit();

    // Enforce limits and rotate oldest to next playlists (max 20 each)
    await enforcePlaylistLimits(userId);

    // Update lastScan and stats in user profile
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        lastScan: serverTimestamp(),
        'stats.totalGamesAnalyzed': increment(1)
    });

    // Get final count
    const finalSnapshot = await getDocs(query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('isFavorite', '==', false)
    ));
    return finalSnapshot.size;
}

/**
 * Get recent puzzles (Playlist 1: Newest 20)
 */
export async function getRecentPuzzles(userId, limitCount = 20) {
    const q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('isFavorite', '==', false),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));
}

/**
 * Get history puzzles (Playlist 2: Next 20 after recent)
 */
export async function getHistoryPuzzles(userId, lastVisibleDoc, limitCount = 20) {
    let q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('isFavorite', '==', false),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    if (lastVisibleDoc) {
        q = query(q, startAfter(lastVisibleDoc));
    }

    const snapshot = await getDocs(q);
    return {
        puzzles: snapshot.docs.map(d => normalizePuzzle(d.data(), d.id)),
        lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
}

/**
 * Get favorite puzzles — fetches all user puzzles and filters client-side.
 * No composite index required.
 */
export async function getFavoritePuzzles(userId) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => normalizePuzzle(d.data(), d.id))
            .filter(p => p.isFavorite === true)
            .sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
    } catch (e) {
        console.warn('getFavoritePuzzles failed:', e);
        return [];
    }
}

/**
 * Get puzzles sorted by difficulty (hardest first)
 */
export async function getPuzzlesByDifficulty(userId, limitCount = 20) {
    const q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('isFavorite', '==', false),
        orderBy('cpLoss', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));
}

/**
 * Get puzzles by status (new, active, solved, mastered)
 */
export async function getPuzzlesByStatus(userId, status, limitCount = 20) {
    const q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));
}

export async function toggleFavorite(userId, puzzleId, isFavorite) {
    if (isFavorite) {
        // Enforce maximum 10 favorites limit
        const favorites = await getFavoritePuzzles(userId);
        if (favorites.length >= 10) {
            throw new Error('FAVORITES_LIMIT_EXCEEDED');
        }
        
        // Update the puzzle's favorite status — must succeed
        const puzzleDocRef = doc(db, 'puzzles', puzzleId);
        await updateDoc(puzzleDocRef, { isFavorite: true });
    } else {
        // Unfavoriting flow: put in first available playlist spot
        // Fetch all puzzles for this user to check playlist occupancy
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const allPuzzles = snapshot.docs.map(d => d.data());
        
        const nonFavorites = allPuzzles.filter(p => !p.isFavorite);
        
        const count0 = nonFavorites.filter(p => p.playlistIndex === 0).length;
        const count1 = nonFavorites.filter(p => p.playlistIndex === 1).length;
        const count2 = nonFavorites.filter(p => p.playlistIndex === 2).length;
        
        let targetIndex = -1;
        if (count0 < 20) {
            targetIndex = 0;
        } else if (count1 < 20) {
            targetIndex = 1;
        } else if (count2 < 20) {
            targetIndex = 2;
        } else {
            throw new Error('PLAYLISTS_FULL');
        }
        
        // Ensure the playlist is created in the user profile if it doesn't exist
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const playlistNames = userSnap.data()?.playlistNames || {};
        
        if (targetIndex > 0 && playlistNames[targetIndex] === undefined) {
            await updateDoc(userRef, {
                [`playlistNames.${targetIndex}`]: `Playlist ${targetIndex + 1}`
            });
        }
        
        // Update puzzle: playlistIndex and isFavorite
        const puzzleDocRef = doc(db, 'puzzles', puzzleId);
        await updateDoc(puzzleDocRef, { 
            playlistIndex: targetIndex,
            isFavorite: false 
        });
        
        // Trigger limit enforcement / rotation
        await enforcePlaylistLimits(userId);
    }
}



/**
 * Update puzzle review state after attempt.
 * Uses setDoc with merge so it works even if the document doesn't exist in cache.
 */
export async function updatePuzzleReview(userId, puzzleId, success, timeTaken) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);

    // Use updateDoc so we don't create "ghost" documents if the puzzle doesn't exist
    await updateDoc(puzzleRef, {
        'reviewState.isSolved': success ? true : false,
        'reviewState.attempts': increment(1),
        'reviewState.lastAttempt': serverTimestamp(),
        'reviewState.successCount': success ? increment(1) : increment(0),
        'reviewState.failCount': success ? increment(0) : increment(1),
        status: success ? 'solved' : 'active',
        lastAttemptedAt: serverTimestamp(),
        lastResult: success ? 'success' : 'fail'
    });


    // Log activity (non-fatal)
    try {
        await logPuzzleAttempt(userId, puzzleId, success ? 'success' : 'fail', timeTaken);
    } catch (e) {
        console.warn('logPuzzleAttempt failed (non-fatal):', e);
    }

    return { status: success ? 'solved' : 'active' };

}

/**
 * Log puzzle attempt to activity_logs collection
 */
export async function logPuzzleAttempt(userId, puzzleId, result, timeTaken, moveSequence = []) {
    const logRef = doc(collection(db, 'activity_logs'));
    await setDoc(logRef, {
        userId,
        puzzleId,
        result,
        timeTaken,
        timestamp: serverTimestamp(),
        moveSequence
    });

    // Run pruning worker in background to prevent storage bloat (limit to 200 most recent logs)
    pruneActivityLogs(userId).catch(e => console.warn('Prune activity logs failed:', e));
}

/**
 * Prune activity logs older than 200 entries for a user
 */
export async function pruneActivityLogs(userId) {
    try {
        const q = query(
            collection(db, 'activity_logs'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc')
        );
        const snapshot = await getDocs(q);
        if (snapshot.size > 200) {
            const batch = writeBatch(db);
            const docsToDelete = snapshot.docs.slice(200);
            docsToDelete.forEach(d => {
                batch.delete(d.ref);
            });
            await batch.commit();
            console.log(`Pruned ${docsToDelete.length} old activity logs for user ${userId}`);
        }
    } catch (e) {
        console.warn('Failed to prune activity logs:', e);
    }
}

/**
 * Check if a game has already been processed by this user
 */
export async function isGameProcessed(userId, gameId) {
    const docId = `${userId}_${gameId}`;
    const gameRef = doc(db, 'processed_games', docId);
    const gameSnap = await getDoc(gameRef);
    return gameSnap.exists();
}

/**
 * Mark a game as processed for this user (deduplication)
 */
export async function markGameProcessed(userId, gameId, puzzleCount) {
    const docId = `${userId}_${gameId}`;
    const gameRef = doc(db, 'processed_games', docId);
    await setDoc(gameRef, {
        userId,
        gameId,
        analyzedAt: serverTimestamp(),
        puzzleCount
    });
}

/**
 * Get user's puzzle statistics
 */
export async function getUserPuzzleStats(userId) {
    // Get total puzzles
    const allPuzzlesQuery = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId)
    );
    const allPuzzles = await getDocs(allPuzzlesQuery);

    const stats = {
        total: allPuzzles.size,
        favorites: 0,
        rotation: 0,
        byStatus: {
            new: 0,
            active: 0,
            solved: 0,
            mastered: 0
        }
    };

    allPuzzles.docs.forEach(doc => {
        const data = doc.data();
        if (data.isFavorite) {
            stats.favorites++;
        } else {
            stats.rotation++;
        }
        stats.byStatus[data.status] = (stats.byStatus[data.status] || 0) + 1;
    });

    return stats;
}

/**
 * Delete a puzzle
 */
export async function deletePuzzle(userId, puzzleId) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    const puzzleSnap = await getDoc(puzzleRef);

    if (!puzzleSnap.exists()) {
        throw new Error('Puzzle not found');
    }

    if (puzzleSnap.data().userId !== userId) {
        throw new Error('Unauthorized');
    }

    // Delete puzzle
    await deleteDoc(puzzleRef);
}
/**
 * Get the next puzzle for training
 * Prioritizes:
 * 1. Active puzzles (failed previously)
 * 2. New puzzles
 * 3. Review puzzles (backlog)
 */
export async function getNextPuzzle(userId, excludeIds = []) {
    const excludes = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);

    try {
        // Fetch all puzzles for this user (index-free query using single-field userId filter)
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const allPuzzles = snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));

        // 1. Try to find an active puzzle (failed previously)
        let activeCandidates = allPuzzles.filter(p => p.status === 'active' && !excludes.includes(p.id));
        if (activeCandidates.length > 0) {
            // Sort by reviewState.lastAttempt asc (oldest attempts first)
            activeCandidates.sort((a, b) => {
                const aTime = a.reviewState?.lastAttempt?.toMillis?.() || 0;
                const bTime = b.reviewState?.lastAttempt?.toMillis?.() || 0;
                return aTime - bTime;
            });
            const top50 = activeCandidates.slice(0, 50);
            return top50[Math.floor(Math.random() * top50.length)];
        }

        // 2. Try to find a new puzzle
        let newCandidates = allPuzzles.filter(p => p.status === 'new' && !excludes.includes(p.id));
        if (newCandidates.length > 0) {
            // Sort by createdAt desc (newest first)
            newCandidates.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            const top50 = newCandidates.slice(0, 50);
            return top50[Math.floor(Math.random() * top50.length)];
        }

        // 3. Fall back to solved puzzles so the user can review them and train even if all are solved
        let solvedCandidates = allPuzzles.filter(p => p.status === 'solved' && !excludes.includes(p.id));
        if (solvedCandidates.length > 0) {
            // Sort by lastAttemptedAt asc (least recently trained first)
            solvedCandidates.sort((a, b) => {
                const aTime = a.lastAttemptedAt?.toMillis?.() || 0;
                const bTime = b.lastAttemptedAt?.toMillis?.() || 0;
                return aTime - bTime;
            });
            const top50 = solvedCandidates.slice(0, 50);
            return top50[Math.floor(Math.random() * top50.length)];
        }
    } catch (e) {
        console.error('getNextPuzzle failed:', e);
    }

    return null;
}

/**
 * Get recent activity logs for the dashboard history section.
 * Fetches the last N log entries then enriches with puzzle opening/theme.
 */
export async function getRecentActivityLogs(userId, limitCount = 10) {
    try {
        const q = query(
            collection(db, 'activity_logs'),
            where('userId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return [];

        const logs = await Promise.all(
            snapshot.docs.map(async (logDoc) => {
                const log = { id: logDoc.id, ...logDoc.data() };
                try {
                    const puzzleSnap = await getDoc(doc(db, 'puzzles', log.puzzleId));
                    if (puzzleSnap.exists()) {
                        const p = puzzleSnap.data();
                        log.opening = p.opening || p.openingName || 'Unknown Opening';
                        log.theme = p.theme || (Array.isArray(p.tags) ? p.tags[0] : null) || 'Blunder';
                    }
                } catch {
                    log.opening = 'Unknown Opening';
                    log.theme = 'Blunder';
                }
                return log;
            })
        );
        return logs;
    } catch (e) {
        console.warn('getRecentActivityLogs failed:', e);
        return [];
    }
}

export async function getPuzzlesGroupedByOpening(userId) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return [];

        const openingGroups = {};

        snapshot.docs.forEach(d => {
            const data = d.data();
            const puzzle = normalizePuzzle(data, d.id);
            const fullOpening = puzzle.opening || 'Unknown Opening';
            
            // Extract main opening name (e.g. "Sicilian Defense: Najdorf" -> "Sicilian Defense")
            const mainOpening = fullOpening.split(':')[0].split(',')[0].split(' - ')[0].trim() || 'Unknown Opening';
            
            if (!openingGroups[mainOpening]) {
                openingGroups[mainOpening] = {
                    playlistIndex: mainOpening, // use main opening title as the identifier
                    title: mainOpening,
                    total: 0,
                    solved: 0,
                    mastered: 0,
                    puzzles: []
                };
            }
            const group = openingGroups[mainOpening];
            group.total++;
            if (data.reviewState?.isSolved) group.solved++;
            if (data.status === 'mastered') group.mastered++;
            group.puzzles.push(puzzle);
        });

        // Convert to array and sort by total puzzles descending
        return Object.values(openingGroups).map(g => {
            g.puzzles.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            return {
                ...g,
                progress: g.total > 0 ? Math.round((g.solved / g.total) * 100) : 0,
                mastery: g.mastered >= g.total * 0.8 ? 'Expert'
                       : g.mastered >= g.total * 0.5 ? 'Advanced'
                       : g.solved  >= g.total * 0.5 ? 'Intermediate'
                       : 'Novice'
            };
        }).sort((a, b) => b.total - a.total);
    } catch (e) {
        console.error('getPuzzlesGroupedByOpening failed:', e);
        return [];
    }
}

/**
 * Count puzzles with status === 'new' (unseen) for the banner in Dashboard.
 */
export async function getNewPuzzleCount(userId) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('status', '==', 'new')
        );
        const snapshot = await getDocs(q);
        return snapshot.size;
    } catch (e) {
        console.warn('getNewPuzzleCount failed:', e);
        return 0;
    }
}

/**
 * Get the most recently attempted puzzles for the dashboard history section.
 * Uses the top-level `lastAttemptedAt` field (no composite index required).
 *
 * @param {string} userId
 * @param {number} limitCount
 * @returns {Promise<Array>} Array of puzzle objects with lastResult, opening, customName
 */
export async function getRecentlyAttemptedPuzzles(userId, limitCount = 5) {
    try {
        // Single-field query — no composite index needed
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(d => normalizePuzzle(d.data(), d.id))
            .filter(p => p.lastAttemptedAt != null)
            .sort((a, b) => {
                const aTime = a.lastAttemptedAt?.toMillis?.() || 0;
                const bTime = b.lastAttemptedAt?.toMillis?.() || 0;
                return bTime - aTime;
            })
            .slice(0, limitCount);
    } catch (e) {
        console.warn('getRecentlyAttemptedPuzzles failed:', e);
        return [];
    }
}

export async function getAllPuzzlesGroupedByOpening(userId) {
    return getPuzzlesGroupedByOpening(userId);
}

/**
 * Rename a puzzle by updating its customName field.
 */
export async function renamePuzzle(userId, puzzleId, newName) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    const snap = await getDoc(puzzleRef);
    if (!snap.exists()) {
        throw new Error('Puzzle not found');
    }
    if (snap.data().userId !== userId) {
        throw new Error('Unauthorized to rename this puzzle');
    }
    await updateDoc(puzzleRef, { customName: newName.trim() });
}

/**
 * Calculate the mean solve rate percentage of the last 3 full attempts at a playlist.
 * If N is the number of puzzles, we take the last 3 * N attempts.
 * Purely index-free: queries by userId, filters and sorts client-side.
 */
export async function getPlaylistSolveRate(userId, puzzleIds) {
    try {
        if (!puzzleIds || puzzleIds.length === 0) return 0;
        const N = puzzleIds.length;
        const targetAttemptLimit = N * 3;

        // Fetch logs for this user (index-free query)
        const q = query(
            collection(db, 'activity_logs'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return 0;

        // Filter and sort client-side
        const matchingLogs = snapshot.docs
            .map(d => d.data())
            .filter(log => puzzleIds.includes(log.puzzleId))
            .sort((a, b) => {
                const aTime = a.timestamp?.toMillis?.() || 0;
                const bTime = b.timestamp?.toMillis?.() || 0;
                return bTime - aTime;
            });

        if (matchingLogs.length === 0) return 0;

        // Take the latest 3 * N attempts
        const latestAttempts = matchingLogs.slice(0, targetAttemptLimit);
        const successCount = latestAttempts.filter(log => log.result === 'success').length;

        return Math.round((successCount / latestAttempts.length) * 100);
    } catch (e) {
        console.warn('getPlaylistSolveRate failed:', e);
        return 0;
    }
}

/**
 * Get the 3 playlists for the user. Matches names in their profile or defaults to Playlist 1-3.
 */
export async function getUserPlaylists(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const playlistNames = userSnap.data()?.playlistNames || {};

        const groups = {};

        // 1. Populate custom-named playlists dynamically (even if empty)
        Object.keys(playlistNames).forEach(idx => {
            const index = parseInt(idx, 10);
            groups[index] = {
                playlistIndex: index,
                title: playlistNames[idx] || `Playlist ${index + 1}`,
                total: 0,
                solved: 0,
                mastered: 0,
                puzzles: []
            };
        });

        // 2. Load puzzles and group them (auto-creates default playlists if puzzles exist inside them)
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);

        snapshot.docs.forEach(d => {
            const data = d.data();
            if (data.isFavorite === true) return; // Exclude favorited puzzles from playlists
            const puzzle = normalizePuzzle(data, d.id);
            const idx = puzzle.playlistIndex !== undefined ? puzzle.playlistIndex : 0;
            const targetIdx = parseInt(idx, 10);

            if (!groups[targetIdx]) {
                groups[targetIdx] = {
                    playlistIndex: targetIdx,
                    title: `Playlist ${targetIdx + 1}`,
                    total: 0,
                    solved: 0,
                    mastered: 0,
                    puzzles: []
                };
            }

            groups[targetIdx].total++;
            if (data.reviewState?.isSolved) groups[targetIdx].solved++;
            if (data.status === 'mastered') groups[targetIdx].mastered++;
            groups[targetIdx].puzzles.push(puzzle);
        });

        // Convert groups map to a sorted list
        const list = Object.values(groups).map(g => {
            g.puzzles.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
            });
            return {
                ...g,
                progress: g.total > 0 ? Math.round((g.solved / g.total) * 100) : 0,
                mastery: g.mastered >= g.total * 0.8 ? 'Expert'
                       : g.mastered >= g.total * 0.5 ? 'Advanced'
                       : g.solved  >= g.total * 0.5 ? 'Intermediate'
                       : 'Novice'
            };
        });

        list.sort((a, b) => a.playlistIndex - b.playlistIndex);
        return list;

    } catch (e) {
        console.error('getUserPlaylists failed:', e);
        return [];
    }
}

/**
 * Find the first unused playlist index and reserve its name in the user's profile map
 */
export async function createPlaylist(userId, name) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        const playlistNames = userSnap.data()?.playlistNames || {};

        let newIndex = 0;
        while (playlistNames[newIndex] !== undefined) {
            newIndex++;
        }

        await updateDoc(userRef, {
            [`playlistNames.${newIndex}`]: name.trim()
        });

        return newIndex;
    } catch (e) {
        console.error('createPlaylist failed:', e);
        throw e;
    }
}

/**
 * Enforce sequential limits (max 20 per playlist) and handles FIFO overflows and deletes.
 */
export async function enforcePlaylistLimits(userId) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('isFavorite', '==', false)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const p1 = [];
        const p2 = [];
        const p3 = [];

        snapshot.docs.forEach(d => {
            const data = d.data();
            const puzzle = { ...data, id: d.id };
            const idx = data.playlistIndex !== undefined ? data.playlistIndex : 0;
            if (idx === 0) p1.push(puzzle);
            else if (idx === 1) p2.push(puzzle);
            else p3.push(puzzle);
        });

        const sortByTime = (a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        };

        p1.sort(sortByTime);
        p2.sort(sortByTime);
        p3.sort(sortByTime);

        const batch = writeBatch(db);
        let updated = false;

        // 1. Enforce Playlist 1 limit -> move to Playlist 2
        if (p1.length > 20) {
            const overflow = p1.slice(20);
            overflow.forEach(puzzle => {
                const puzzleRef = doc(db, 'puzzles', puzzle.id);
                batch.update(puzzleRef, { playlistIndex: 1 });
                p2.push({ ...puzzle, playlistIndex: 1 });
            });
            p2.sort(sortByTime);
            updated = true;
        }

        // 2. Enforce Playlist 2 limit -> move to Playlist 3
        if (p2.length > 20) {
            const overflow = p2.slice(20);
            overflow.forEach(puzzle => {
                const puzzleRef = doc(db, 'puzzles', puzzle.id);
                batch.update(puzzleRef, { playlistIndex: 2 });
                p3.push({ ...puzzle, playlistIndex: 2 });
            });
            p3.sort(sortByTime);
            updated = true;
        }

        // 3. Enforce Playlist 3 limit -> delete oldest
        if (p3.length > 20) {
            const overflow = p3.slice(20);
            overflow.forEach(puzzle => {
                const puzzleRef = doc(db, 'puzzles', puzzle.id);
                batch.delete(puzzleRef);
            });
            updated = true;
        }

        if (updated) {
            await batch.commit();
        }

    } catch (e) {
        console.error('enforcePlaylistLimits failed:', e);
    }
}

/**
 * Rename one of the 3 playlists
 */
export async function renamePlaylist(userId, playlistIndex, newName) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        [`playlistNames.${playlistIndex}`]: newName.trim()
    });
}

/**
 * Move a puzzle to a target playlist and enforces Limits
 */
export async function movePuzzle(userId, puzzleId, targetPlaylistIndex) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    await updateDoc(puzzleRef, { playlistIndex: targetPlaylistIndex });
    await enforcePlaylistLimits(userId);
}

/**
 * Calculate the success stats of the last 5 tries of a playlist/puzzle list.
 */
export async function getPlaylistRecentStats(userId, puzzleIds) {
    try {
        if (!puzzleIds || puzzleIds.length === 0) {
            return { percentage: 0, successCount: 0, totalCount: 0 };
        }

        // Fetch logs for this user (index-free query)
        const q = query(
            collection(db, 'activity_logs'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            return { percentage: 0, successCount: 0, totalCount: 0 };
        }

        // Filter and sort client-side
        const matchingLogs = snapshot.docs
            .map(d => d.data())
            .filter(log => puzzleIds.includes(log.puzzleId))
            .sort((a, b) => {
                const aTime = a.timestamp?.toMillis?.() || 0;
                const bTime = b.timestamp?.toMillis?.() || 0;
                return bTime - aTime;
            });

        if (matchingLogs.length === 0) {
            return { percentage: 0, successCount: 0, totalCount: 0 };
        }

        // Take the latest 5 attempts
        const latestAttempts = matchingLogs.slice(0, 5);
        const successCount = latestAttempts.filter(log => log.result === 'success').length;
        const totalCount = latestAttempts.length;

        return {
            percentage: Math.round((successCount / totalCount) * 100),
            successCount,
            totalCount
        };
    } catch (e) {
        console.warn('getPlaylistRecentStats failed:', e);
        return { percentage: 0, successCount: 0, totalCount: 0 };
    }
}

/**
 * Delete all puzzles inside a given playlist
 */
export async function clearPlaylist(userId, playlistIndex) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('playlistIndex', '==', playlistIndex)
        );
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        if (!snapshot.empty) {
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.isFavorite !== true) {
                    batch.delete(doc(db, 'puzzles', d.id));
                }
            });
        }

        // Reset the custom playlist name in user's profile to default
        const userRef = doc(db, 'users', userId);
        batch.update(userRef, {
            [`playlistNames.${playlistIndex}`]: deleteField()
        });

        await batch.commit();
        await enforcePlaylistLimits(userId);
    } catch (e) {
        console.error('clearPlaylist failed:', e);
        throw e;
    }
}

/**
 * Save a custom manually ingested puzzle
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Object} puzzle - Puzzle data (fen, correctMove, customName, opening, userColor, isFavorite)
 */
export async function saveCustomPuzzle(userId, puzzle) {
    const stats = await getUserPuzzleStats(userId);
    if (stats.total >= 70) {
        throw new Error('REPERTOIRE_LIMIT_EXCEEDED');
    }
    if (puzzle.isFavorite) {
        const favorites = await getFavoritePuzzles(userId);
        if (favorites.length >= 10) {
            throw new Error('FAVORITES_LIMIT_EXCEEDED');
        }
    }
    const puzzleRef = doc(collection(db, 'puzzles'));
    
    await setDoc(puzzleRef, {
        fen: puzzle.fen,
        correctMove: puzzle.correctMove,
        customName: puzzle.customName || 'Custom Position',
        opening: puzzle.opening || 'Custom Analysis',
        theme: puzzle.theme || 'Custom Ingestion',
        userColor: puzzle.userColor || 'white',
        type: 'custom',
        userId,
        isFavorite: puzzle.isFavorite || false,
        playlistIndex: puzzle.playlistIndex !== undefined ? puzzle.playlistIndex : 0, // defaults to Playlist 1
        status: 'new',
        createdAt: serverTimestamp(),
        reviewState: {
            isSolved: false,
            attempts: 0,
            lastAttempt: null,
            successCount: 0,
            failCount: 0
        }
    });

    // Enforce limits and rotate oldest to next playlists (max 20 each)
    await enforcePlaylistLimits(userId);
    return puzzleRef.id;
}

/**
 * Mark all existing 'new' puzzles as 'active' for a user
 */
export async function clearOldNewPuzzles(userId) {
    try {
        const q = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('status', '==', 'new')
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => {
                batch.update(d.ref, { status: 'active' });
            });
            await batch.commit();
            console.log(`Cleared 'new' status for ${snapshot.size} puzzles of user ${userId}`);
        }
    } catch (e) {
        console.warn('Failed to clear old new puzzles:', e);
    }
}

/**
 * Save pending scans to a temporary document field
 */
export async function savePendingPuzzles(userId, puzzles) {
    // Clear the 'new' status on all previous puzzles in the repertoire
    await clearOldNewPuzzles(userId);

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        pendingScan: {
            status: 'completed',
            count: puzzles.length,
            shown: false,
            timestamp: Date.now(),
            puzzles
        }
    });
}

/**
 * Get pending scans from Firestore
 */
export async function getPendingPuzzles(userId) {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return [];
    return snap.data().pendingScan?.puzzles || [];
}

/**
 * Clear pending scans from Firestore
 */
export async function clearPendingPuzzles(userId) {
    const userRef = doc(db, 'users', userId);
    try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            const pendingScan = data?.pendingScan;
            if (pendingScan && Array.isArray(pendingScan.puzzles)) {
                // Find all unique game IDs from the pending puzzles
                const gameIds = [...new Set(pendingScan.puzzles.map(p => p.gameId).filter(Boolean))];
                if (gameIds.length > 0) {
                    const batch = writeBatch(db);
                    gameIds.forEach(gameId => {
                        const docId = `${userId}_${gameId}`;
                        const gameRef = doc(db, 'processed_games', docId);
                        batch.delete(gameRef);
                    });
                    await batch.commit();
                    console.log(`Deleted ${gameIds.length} processed games from history for user ${userId}`);
                }
            }
        }
    } catch (err) {
        console.error('Failed to unmark processed games on discard:', err);
    }

    // Reset user profile status
    await updateDoc(userRef, {
        pendingScan: deleteField()
    }).catch((err) => {
        console.error('Failed to delete pendingScan field:', err);
    });
}

/**
 * Save a single approved pending puzzle and update the user's pendingScan list:
 * 1. Save the puzzle to the 'puzzles' collection.
 * 2. Update the user document's pendingScan list with the puzzle removed.
 * 3. Enforce sequential playlist limits.
 */
export async function approvePendingPuzzle(userId, puzzleToSave, puzzlesList, indexToApprove) {
    const stats = await getUserPuzzleStats(userId);
    if (stats.total >= 70) {
        throw new Error('REPERTOIRE_LIMIT_EXCEEDED');
    }
    if (puzzleToSave.isFavorite) {
        const favorites = await getFavoritePuzzles(userId);
        if (favorites.length >= 10) {
            throw new Error('FAVORITES_LIMIT_EXCEEDED');
        }
    }
    const batch = writeBatch(db);

    const puzzleRef = doc(collection(db, 'puzzles'));
    
    batch.set(puzzleRef, {
        fen: puzzleToSave.fen,
        correctMove: puzzleToSave.correctMove,
        customName: puzzleToSave.customName || 'Blunder Position',
        opening: puzzleToSave.opening || puzzleToSave.openingName || 'Unknown Opening',
        theme: puzzleToSave.theme || 'Blunder',
        userColor: puzzleToSave.userColor || puzzleToSave.playerColor || 'white',
        type: 'opening_blunder',
        userId,
        isFavorite: puzzleToSave.isFavorite || false,
        playlistIndex: puzzleToSave.playlistIndex !== undefined ? puzzleToSave.playlistIndex : 0,
        status: 'new',
        createdAt: serverTimestamp(),
        reviewState: {
            isSolved: false,
            attempts: 0,
            lastAttempt: null,
            successCount: 0,
            failCount: 0
        }
    });

    const updatedPuzzles = puzzlesList.filter((_, idx) => idx !== indexToApprove);
    const userRef = doc(db, 'users', userId);

    if (updatedPuzzles.length === 0) {
        batch.update(userRef, {
            pendingScan: deleteField()
        });
    } else {
        batch.update(userRef, {
            'pendingScan.puzzles': updatedPuzzles,
            'pendingScan.count': updatedPuzzles.length
        });
    }

    await batch.commit();
    await enforcePlaylistLimits(userId);
    return updatedPuzzles;
}

/**
 * Save approved puzzles in batch
 */
export async function saveApprovedPuzzles(userId, approvedPuzzles) {
    const stats = await getUserPuzzleStats(userId);
    if (stats.total + approvedPuzzles.length > 70) {
        throw new Error('REPERTOIRE_LIMIT_EXCEEDED');
    }
    const batch = writeBatch(db);
    
    approvedPuzzles.forEach(puzzle => {
        const puzzleRef = doc(collection(db, 'puzzles'));
        
        batch.set(puzzleRef, {
            fen: puzzle.fen,
            correctMove: puzzle.correctMove,
            customName: puzzle.customName || 'Blunder Position',
            opening: puzzle.opening || puzzle.openingName || 'Unknown Opening',
            theme: puzzle.theme || 'Blunder',
            userColor: puzzle.userColor || puzzle.playerColor || 'white',
            type: 'opening_blunder',
            userId,
            isFavorite: puzzle.isFavorite || false,
            playlistIndex: puzzle.playlistIndex !== undefined ? puzzle.playlistIndex : 0,
            status: 'new',
            createdAt: serverTimestamp(),
            reviewState: {
                isSolved: false,
                attempts: 0,
                lastAttempt: null,
                successCount: 0,
                failCount: 0
            }
        });
    });

    await batch.commit();
    await enforcePlaylistLimits(userId);
}

/**
 * Ignore a specific pending puzzle:
 * 1. Delete the corresponding processed_games document.
 * 2. Update the user document's pendingScan list with the puzzle removed.
 */
export async function ignorePendingPuzzle(userId, gameId, puzzlesList, indexToIgnore) {
    const batch = writeBatch(db);
    
    if (gameId) {
        const docId = `${userId}_${gameId}`;
        const gameRef = doc(db, 'processed_games', docId);
        batch.delete(gameRef);
    }
    
    const updatedPuzzles = puzzlesList.filter((_, idx) => idx !== indexToIgnore);
    const userRef = doc(db, 'users', userId);
    
    if (updatedPuzzles.length === 0) {
        batch.update(userRef, {
            pendingScan: deleteField()
        });
    } else {
        batch.update(userRef, {
            'pendingScan.puzzles': updatedPuzzles,
            'pendingScan.count': updatedPuzzles.length
        });
    }
    
    await batch.commit();
    return updatedPuzzles;
}


