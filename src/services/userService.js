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
    serverTimestamp
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
