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
    increment
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

        // Lichess Integration (initially empty)
        lichessUsername: '',
        lichessConnectedAt: null,

        // Rotation Logic
        rotationCount: 0,

        // Dashboard Stats
        stats: {
            totalSolved: 0,
            streak: 0,
            lastActive: serverTimestamp(),
            totalGamesAnalyzed: 0
        },

        // User Preferences
        settings: {
            theme: 'dark',
            minElo: 1000,
            autoAnalyze: false,
            notificationsEnabled: true
        },

        // Metadata
        createdAt: serverTimestamp(),
        lastScan: null
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

    return { id: userSnap.id, ...userSnap.data() };
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
    const currentStreak = data?.stats?.streak || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newStreak = currentStreak;
    let shouldUpdate = true;

    if (lastActive) {
        const lastDay = new Date(lastActive);
        lastDay.setHours(0, 0, 0, 0);

        const diffDays = Math.round((today - lastDay) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Already visited today — no change to streak
            shouldUpdate = false;
        } else if (diffDays === 1) {
            // Visited yesterday — extend streak
            newStreak = currentStreak + 1;
        } else {
            // Missed one or more days — reset streak
            newStreak = 1;
        }
    } else {
        // First ever visit
        newStreak = 1;
    }

    if (shouldUpdate) {
        await updateDoc(userRef, {
            'stats.streak': newStreak,
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
