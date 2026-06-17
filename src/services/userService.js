/**
 * User Service - Handles user profile and Lichess account management
 * 
 * Features:
 * - Initialize new user profiles
 * - Link/update Lichess username
 * - Update user settings
 * - Fetch user stats
 */

import { db } from '../firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    increment,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    deleteField
} from 'firebase/firestore';


/**
 * Initialize a new user profile in Firestore
 * Called after first Google sign-in
 * 
 * @param {Object} user - Firebase Auth user object
 * @returns {Promise<void>}
 */
export async function initializeUserProfile(user) {
    const userRef = doc(db, 'users', user.uid);

    // Check if profile already exists
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return; // Profile already initialized
    }

    // Create new profile
    await setDoc(userRef, {
        // Authentication data
        email: user.email,
        displayName: user.displayName || 'Player',
        photoUrl: user.photoURL || null,
        country: '',
        flair: '',
        onboardingCompleted: false,

        // Lichess Integration (initially empty)
        lichessUsername: '',
        lichessConnectedAt: null,

        // Playlists (initially empty map to allow creating custom playlists)
        playlistNames: {},

        // Dashboard Stats
        stats: {
            totalSolved: 0,
            lastActive: serverTimestamp(),
            xp: 0,
            level: 1
        },

        // User Preferences
        settings: {
            minElo: 1000,
            boardTheme: 'classic',
            pieceSet: 'cburnett',
            showCoordinates: true,
            autoNext: false,
            engineDepth: 14
        },

        // Metadata
        createdAt: serverTimestamp()
    });
}

/**
 * Complete user onboarding setup
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Object} data - Profile updates (displayName, lichessUsername, settings)
 * @returns {Promise<void>}
 */
export async function completeOnboarding(userId, { displayName, lichessUsername, settings }) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        displayName: displayName.trim() || 'Player',
        lichessUsername: lichessUsername.trim() || '',
        'settings.minElo': settings?.minElo ?? 1000,
        onboardingCompleted: true,
        showWelcomeTour: true
    });
}

/**
 * Get user profile from Firestore
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<Object>} User profile data
 */
export async function getUserProfile(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        throw new Error('User profile not found');
    }

    const data = userSnap.data();

    // Silent database migration to remove unused deprecated fields
    const deletes = {};
    if (data.rotationCount !== undefined) deletes.rotationCount = deleteField();
    if (data.settings?.theme !== undefined) deletes['settings.theme'] = deleteField();
    if (data.settings?.autoAnalyze !== undefined) deletes['settings.autoAnalyze'] = deleteField();
    if (data.settings?.accentColor !== undefined) deletes['settings.accentColor'] = deleteField();
    if (data.settings?.notificationsEnabled !== undefined) deletes['settings.notificationsEnabled'] = deleteField();
    if (data.settings?.soundEnabled !== undefined) deletes['settings.soundEnabled'] = deleteField();
    if (data.settings?.piecesSet !== undefined) deletes['settings.piecesSet'] = deleteField();
    
    // Purge new unused fields
    if (data.lastScan !== undefined) deletes.lastScan = deleteField();
    if (data.stats?.streak !== undefined) deletes['stats.streak'] = deleteField();
    if (data.stats?.totalGamesAnalyzed !== undefined) deletes['stats.totalGamesAnalyzed'] = deleteField();
    if (data.stats?.totalReviews !== undefined) deletes['stats.totalReviews'] = deleteField();
    if (data.stats?.totalCorrectReviews !== undefined) deletes['stats.totalCorrectReviews'] = deleteField();
    if (data.stats?.reviewAccuracy !== undefined) deletes['stats.reviewAccuracy'] = deleteField();

    if (Object.keys(deletes).length > 0) {
        await updateDoc(userRef, deletes);
        delete data.rotationCount;
        delete data.lastScan;
        if (data.settings) {
            delete data.settings.theme;
            delete data.settings.autoAnalyze;
            delete data.settings.accentColor;
            delete data.settings.notificationsEnabled;
            delete data.settings.soundEnabled;
            delete data.settings.piecesSet;
        }
        if (data.stats) {
            delete data.stats.streak;
            delete data.stats.totalGamesAnalyzed;
            delete data.stats.totalReviews;
            delete data.stats.totalCorrectReviews;
            delete data.stats.reviewAccuracy;
        }
    }

    return { id: userSnap.id, ...data };
}

/**
 * Link Lichess account to user profile
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {string} lichessUsername - Lichess username to link
 * @returns {Promise<void>}
 */
export async function linkLichessAccount(userId, lichessUsername) {
    if (!lichessUsername || !lichessUsername.trim()) {
        throw new Error('Lichess username is required');
    }

    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
        lichessUsername: lichessUsername.trim(),
        lichessConnectedAt: serverTimestamp()
    });
}

/**
 * Disconnect Lichess account from user profile
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function disconnectLichessAccount(userId) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        lichessUsername: '',
        lichessConnectedAt: null
    });
}

/**
 * Update user settings
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Object} settings - Settings object to update
 * @returns {Promise<void>}
 */
export async function updateUserSettings(userId, settings) {
    const userRef = doc(db, 'users', userId);

    const updates = {};
    Object.keys(settings).forEach(key => {
        updates[`settings.${key}`] = settings[key];
    });

    await updateDoc(userRef, updates);
}

/**
 * Update user stats
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Object} stats - Stats object to update
 * @returns {Promise<void>}
 */
export async function updateUserStats(userId, stats) {
    const userRef = doc(db, 'users', userId);

    const updates = {};
    Object.keys(stats).forEach(key => {
        updates[`stats.${key}`] = stats[key];
    });

    await updateDoc(userRef, updates);
}

/**
 * Update last active timestamp
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function updateLastActive(userId) {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
        'stats.lastActive': serverTimestamp()
    });
}

/**
 * Update the user's daily login streak on Chess-OP.
 * - Streak +1 if the user last visited YESTERDAY
 * - No change if the user already visited TODAY
 * - Reset to 1 if the user missed a day
 * Also updates lastActive timestamp.
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function updateDailyStreak(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const data = userSnap.data();
    const lastActive = data?.stats?.lastActive?.toDate?.();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let shouldUpdate = true;

    if (lastActive) {
        const lastDay = new Date(lastActive);
        lastDay.setHours(0, 0, 0, 0);

        const diffDays = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Already visited today — no need to update lastActive
            shouldUpdate = false;
        }
    }

    if (shouldUpdate) {
        await updateDoc(userRef, {
            'stats.lastActive': serverTimestamp()
        });
    }
}

/**
 * Increment the user's total puzzles solved counter in Firestore.
 * Called from TrainingArena every time a puzzle is solved correctly.
 *
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<void>}
 */
export async function incrementTotalSolved(userId) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        'stats.totalSolved': increment(1)
    });
}

/**
 * Check if user has linked Lichess account
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<boolean>}
 */
export async function hasLichessAccount(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        return false;
    }

    const lichessUsername = userSnap.data()?.lichessUsername;
    return !!(lichessUsername && lichessUsername.trim());
}

/**
 * Get user's Lichess username
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<string|null>}
 */
export async function getLichessUsername(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        return null;
    }

    return userSnap.data()?.lichessUsername || null;
}

/**
 * Verify if a Lichess username exists by calling the Lichess public API.
 * 
 * @param {string} username - Lichess username to verify
 * @returns {Promise<{valid: boolean, profile?: object}>}
 */
export async function verifyLichessUsername(username) {
    if (!username || !username.trim()) {
        return { valid: false };
    }

    try {
        const response = await fetch(`https://lichess.org/api/user/${encodeURIComponent(username.trim())}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (response.ok) {
            const profile = await response.json();
            return { valid: true, profile };
        }
        return { valid: false };
    } catch (error) {
        console.warn('Lichess verification failed:', error);
        return { valid: false };
    }
}

/**
 * Update user profile fields (displayName, country, flair, etc.)
 * 
 * @param {string} userId - Firebase Auth UID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<void>}
 */
export async function updateUserProfile(userId, profileData) {
    const userRef = doc(db, 'users', userId);
    const updates = {};

    if (profileData.displayName !== undefined) updates.displayName = profileData.displayName;
    if (profileData.country !== undefined) updates.country = profileData.country;
    if (profileData.flair !== undefined) updates.flair = profileData.flair;
    if (profileData.photoUrl !== undefined) updates.photoUrl = profileData.photoUrl;
    if (profileData.showWelcomeTour !== undefined) updates.showWelcomeTour = profileData.showWelcomeTour;

    await updateDoc(userRef, updates);
}

/**
 * Clear ALL account data: puzzles, processed_games, playlists, and reset profile.
 * Double-confirmation required on the UI side.
 * 
 * @param {string} userId - Firebase Auth UID
 * @returns {Promise<{deletedPuzzles: number, deletedGames: number}>}
 */
export async function clearAllAccountData(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const data = userSnap.exists() ? userSnap.data() : {};

    // Delete all puzzles for this user
    const puzzlesQ = query(collection(db, 'puzzles'), where('userId', '==', userId));
    const puzzleSnap = await getDocs(puzzlesQ);
    await Promise.all(puzzleSnap.docs.map(d => deleteDoc(d.ref)));

    // Delete all processed_games for this user
    const gamesQ = query(collection(db, 'processed_games'), where('userId', '==', userId));
    const gamesSnap = await getDocs(gamesQ);
    await Promise.all(gamesSnap.docs.map(d => deleteDoc(d.ref)));

    // Delete all activity_logs for this user
    const logsQ = query(collection(db, 'activity_logs'), where('userId', '==', userId));
    const logsSnap = await getDocs(logsQ);
    await Promise.all(logsSnap.docs.map(d => deleteDoc(d.ref)));

    // Reset user profile to defaults matching the database schema, removing all deprecated fields
    await updateDoc(userRef, {
        lichessUsername: data.lichessUsername || '',
        lichessConnectedAt: data.lichessConnectedAt || null,
        country: 'PW',
        flair: 'trophy',
        photoUrl: data.photoUrl || 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
        playlistNames: {}, // Reset to empty map to allow creating custom playlists correctly
        showWelcomeTour: false,
        pendingScan: null,
        
        // Remove unused/deprecated fields completely
        rotationCount: deleteField(),
        'settings.theme': deleteField(),
        'settings.autoAnalyze': deleteField(),
        'settings.piecesSet': deleteField(),
        'settings.accentColor': deleteField(),
        'settings.notificationsEnabled': deleteField(),
        'settings.soundEnabled': deleteField(),
        
        // Purge new unused fields
        lastScan: deleteField(),
        'stats.streak': deleteField(),
        'stats.totalGamesAnalyzed': deleteField(),
        'stats.totalReviews': deleteField(),
        'stats.totalCorrectReviews': deleteField(),
        'stats.reviewAccuracy': deleteField(),

        settings: {
            showCoordinates: true,
            pieceSet: 'cburnett',
            autoNext: false,
            minElo: 1450,
            engineDepth: 14,
            boardTheme: 'classic'
        },
        stats: {
            lastActive: serverTimestamp(),
            totalSolved: 0,
            xp: 0,
            level: 1
        }
    });

    return { deletedPuzzles: puzzleSnap.size, deletedGames: gamesSnap.size };
}
