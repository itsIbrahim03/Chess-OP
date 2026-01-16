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
    increment
} from 'firebase/firestore';

/**
 * Save new puzzles to Firestore with rotation logic
 * - Maximum 60 non-favorite puzzles per user
 * - Deletes oldest puzzles when limit exceeded
 * - Updates rotation count
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Array} newPuzzles - Array of puzzle objects from gameAnalyzer
 * @returns {Promise<number>} New rotation count
 */
export async function saveNewPuzzles(userId, newPuzzles) {
    if (!newPuzzles || newPuzzles.length === 0) {
        throw new Error('No puzzles to save');
    }

    // 1. Get current rotation count
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error('User profile not found');
    }

    const currentCount = userSnap.data()?.rotationCount || 0;

    // 2. Calculate overflow
    const totalAfter = currentCount + newPuzzles.length;
    const overflow = Math.max(0, totalAfter - 60);

    // 3. Delete oldest non-favorites if over limit
    if (overflow > 0) {
        const toDeleteQuery = query(
            collection(db, 'puzzles'),
            where('userId', '==', userId),
            where('isFavorite', '==', false),
            orderBy('createdAt', 'asc'),
            limit(overflow)
        );

        const toDelete = await getDocs(toDeleteQuery);
        const deleteBatch = writeBatch(db);

        toDelete.docs.forEach(puzzleDoc => {
            deleteBatch.delete(puzzleDoc.ref);
        });

        await deleteBatch.commit();
    }

    // 4. Save new puzzles
    const saveBatch = writeBatch(db);

    newPuzzles.forEach(puzzle => {
        const puzzleRef = doc(collection(db, 'puzzles'));
        saveBatch.set(puzzleRef, {
            ...puzzle,
            userId,
            isFavorite: false,
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

    // 5. Update rotation count and stats
    const newCount = Math.min(60, currentCount - overflow + newPuzzles.length);

    await updateDoc(userRef, {
        rotationCount: newCount,
        lastScan: serverTimestamp(),
        'stats.totalGamesAnalyzed': increment(1)
    });

    return newCount;
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        puzzles: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
}

/**
 * Get favorite puzzles (Vault - Unlimited)
 */
export async function getFavoritePuzzles(userId) {
    const q = query(
        collection(db, 'puzzles'),
        where('userId', '==', userId),
        where('isFavorite', '==', true),
        orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Toggle favorite status of a puzzle
 * - Updates puzzle isFavorite field
 * - Updates user rotationCount (favorites don't count toward 60 limit)
 */
export async function toggleFavorite(userId, puzzleId, isFavorite) {
    const batch = writeBatch(db);

    // Update puzzle
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    batch.update(puzzleRef, { isFavorite });

    // Update rotation count
    const userRef = doc(db, 'users', userId);
    const incrementValue = isFavorite ? -1 : 1; // Favorites free up rotation slots
    batch.update(userRef, {
        rotationCount: increment(incrementValue)
    });

    await batch.commit();
}

/**
 * Update puzzle review state after attempt
 */
export async function updatePuzzleReview(userId, puzzleId, success, timeTaken) {
    const puzzleRef = doc(db, 'puzzles', puzzleId);
    const puzzleSnap = await getDoc(puzzleRef);

    if (!puzzleSnap.exists()) {
        throw new Error('Puzzle not found');
    }

    const currentState = puzzleSnap.data().reviewState || {};

    // Update review state
    const newState = {
        isSolved: success ? true : currentState.isSolved,
        attempts: (currentState.attempts || 0) + 1,
        lastAttempt: serverTimestamp(),
        successCount: (currentState.successCount || 0) + (success ? 1 : 0),
        failCount: (currentState.failCount || 0) + (success ? 0 : 1)
    };

    // Determine new status
    let newStatus = puzzleSnap.data().status || 'new';
    if (success && newState.attempts === 1) {
        newStatus = 'solved';
    } else if (success && newState.successCount >= 3) {
        newStatus = 'mastered';
    } else if (!success && newState.attempts > 0) {
        newStatus = 'active';
    }

    await updateDoc(puzzleRef, {
        reviewState: newState,
        status: newStatus
    });

    // Log activity
    await logPuzzleAttempt(userId, puzzleId, success ? 'success' : 'fail', timeTaken);

    return { reviewState: newState, status: newStatus };
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
