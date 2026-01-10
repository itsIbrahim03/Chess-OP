import { findOpening } from '@chess-openings/eco.json';

/**
 * Service to identify chess openings based on position (FEN).
 */
export class OpeningDetector {
    /**
     * Detects the opening name and ECO code for a given FEN.
     * @param {string} fen - The position FEN string.
     * @returns {Object|null} - { name, eco, fen } or null if not found.
     */
    static detect(fen) {
        try {
            // Clean FEN to match only the position part for better lookup consistency
            // Some databases only use the piece placement part
            const result = findOpening(fen);

            if (!result) return null;

            return {
                name: result.name,
                eco: result.eco,
                fen: result.fen
            };
        } catch (error) {
            console.error("Opening detection failed:", error);
            return null;
        }
    }

    /**
     * Checks if a move still belongs to common opening theory.
     * @param {string} fen - The current position FEN.
     * @returns {boolean} - True if still in book.
     */
    static isInBook(fen) {
        return !!findOpening(fen);
    }
}
