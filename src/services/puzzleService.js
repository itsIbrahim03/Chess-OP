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
    }

    // PRIMARY: Update the puzzle's favorite status — must succeed
    const puzzleDocRef = doc(db, 'puzzles', puzzleId);
    await updateDoc(puzzleDocRef, { isFavorite });

    // SECONDARY: Update rotation count — non-fatal if it fails
    const userDocRef = doc(db, 'users', userId);
    const incrementValue = isFavorite ? -1 : 1;
    updateDoc(userDocRef, { rotationCount: increment(incrementValue) })
        .catch(e => console.warn('rotationCount update failed (non-fatal):', e));
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
}

/**
 * Check if a game has already been processed
 */
export async function isGameProcessed(gameId) {
    const gameRef = doc(db, 'processed_games', gameId);
    const gameSnap = await getDoc(gameRef);
    return gameSnap.exists();
}

/**
 * Mark a game as processed (deduplication)
 */
export async function markGameProcessed(userId, gameId, puzzleCount) {
    const gameRef = doc(db, 'processed_games', gameId);
    await setDoc(gameRef, {
        userId,
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

    const isFavorite = puzzleSnap.data().isFavorite;

    // Delete puzzle
    await deleteDoc(puzzleRef);

    // Update rotation count if not a favorite
    if (!isFavorite) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            rotationCount: increment(-1)
        });
    }
}
/**
 * Get the next puzzle for training
 * Prioritizes:
 * 1. Active puzzles (failed previously)
 * 2. New puzzles
 * 3. Review puzzles (backlog)
 */
export async function getNextPuzzle(userId, excludeIds = []) {
    // Ensure excludeIds is an array
    const excludes = Array.isArray(excludeIds) ? excludeIds : (excludeIds ? [excludeIds] : []);

    // 1. Try to find an active puzzle (failed previously)
    let q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        orderBy('reviewState.lastAttempt', 'asc'),
        limit(50)
    );

    let snapshot = await getDocs(q);
    let candidates = snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));

    // Filter out all excluded IDs
    if (excludes.length > 0) {
        candidates = candidates.filter(p => !excludes.includes(p.id));
    }

    // Pick random active puzzle
    if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // 2. If no active (or all excluded), get a new puzzle
    q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('status', '==', 'new'),
        orderBy('createdAt', 'desc'),
        limit(50)
    );
    snapshot = await getDocs(q);
    candidates = snapshot.docs.map(d => normalizePuzzle(d.data(), d.id));

    if (excludes.length > 0) {
        candidates = candidates.filter(p => !excludes.includes(p.id));
    }

    // Pick random new puzzle
    if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
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
            const opening = puzzle.opening || 'Unknown Opening';
            
            if (!openingGroups[opening]) {
                openingGroups[opening] = {
                    playlistIndex: opening, // use opening title as the identifier
                    title: opening,
                    total: 0,
                    solved: 0,
                    mastered: 0,
                    puzzles: []
                };
            }
            const group = openingGroups[opening];
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

        // If we have absolutely nothing, ensure at least one default playlist appears
        if (list.length === 0) {
            list.push({
                playlistIndex: 0,
                title: "Playlist 1",
                total: 0,
                solved: 0,
                mastered: 0,
                progress: 0,
                mastery: 'Novice',
                puzzles: []
            });
        }

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

        // Recalculate total non-favorite count
        const finalSnapshot = await getDocs(query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('isFavorite', '==', false)
        ));
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, { rotationCount: finalSnapshot.size });

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
                batch.delete(doc(db, 'puzzles', d.id));
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

