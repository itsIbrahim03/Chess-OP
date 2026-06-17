/**
 * Chess-OP Error Translation Layer
 * Implements core mandates for Zero Backend Leakage and Contextual/Human-Centric UX.
 * Logs the raw developer error to console.error, and returns a clean user-facing string.
 */
export function translateError(error) {
  // Silent console dump for developer/sysadmin tracking
  console.error("[DEV INFO] Raw exception caught:", error);

  if (!error) {
    return "An unexpected error occurred. Please refresh the page or try your action again.";
  }

  // Extract error code/message/identifier
  let code = "";
  if (typeof error === 'string') {
    code = error;
  } else if (error.code && typeof error.code === 'string') {
    code = error.code;
  } else if (error.message && typeof error.message === 'string') {
    code = error.message;
  }

  // A. Authentication Module
  if (
    code.includes('auth/wrong-password') || 
    code.includes('auth/user-not-found') || 
    code.includes('auth/invalid-credential') ||
    code.includes('auth/invalid-email')
  ) {
    return "Incorrect email or password. Please check your credentials and try again.";
  }
  if (code.includes('auth/too-many-requests')) {
    return "Too many failed log-in attempts. Please wait a few minutes before trying again.";
  }
  if (code.includes('auth/email-already-in-use')) {
    return "This email address is already registered to an active account.";
  }
  if (code.includes('auth/weak-password')) {
    return "Password is too weak. Please use a stronger password (at least 6 characters).";
  }
  if (code.includes('auth/operation-not-allowed')) {
    return "Sign-in method not enabled. Please contact support.";
  }

  // B. Firestore Database & Safety Thresholds
  if (
    code.includes('permission-denied') || 
    code.includes('REPERTOIRE_LIMIT_EXCEEDED') ||
    code.includes('repertoire-capacity-reached')
  ) {
    return "Repertoire Capacity Reached. Your deck is currently capped at its maximum limit of 70 unique positions. Please review, master, or delete existing blunders before importing new ones.";
  }
  if (code.includes('FAVORITES_LIMIT_EXCEEDED')) {
    return "Favorites Limit Reached. You can save a maximum of 10 favorite positions. Please unfavorite some positions before adding new ones.";
  }
  if (
    code.includes('offline') || 
    code.includes('failed-precondition') || 
    code.includes('unavailable') || 
    code.includes('sync-failed') ||
    code.includes('transaction-failed')
  ) {
    return "Changes could not be synced to the cloud right now. Your local progress is safe; we will retry shortly.";
  }

  // C. Lichess API / Manual PGN Ingestion Pipeline
  if (
    code.includes('pgn-parse-failed') || 
    code.includes('malformed-pgn') || 
    code.includes('Unable to parse') ||
    code.includes('PARSE_ERROR')
  ) {
    return "Unable to parse this PGN sequence. Please verify the move format string and try again.";
  }
  if (
    code.includes('lichess-fetch-failed') || 
    code.includes('lichess-sync-failed') || 
    code.includes('game-records-not-found') ||
    code.includes('NO_GAMES_FOUND')
  ) {
    return "Account synchronization failed. Could not find valid game records matching your profile parameters.";
  }

  // D. System Fallbacks (The Catch-All Guardrail)
  return "An unexpected error occurred. Please refresh the page or try your action again.";
}
