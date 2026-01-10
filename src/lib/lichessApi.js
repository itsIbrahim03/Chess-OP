/**
 * Service to interact with the Lichess API.
 */
class LichessApiService {
  constructor() {
    this.baseUrl = "https://lichess.org/api";
  }

  /**
   * Fetches the most recent games for a specific Lichess user.
   * @param {string} username - The Lichess username.
   * @param {number} max - Number of games to fetch (default 10).
   * @param {string} perfType - Comma separated list of game types (e.g., 'blitz,rapid,classical').
   * @returns {Promise<Array>} - Array of PGN data for the games.
   */
  async fetchUserGames(username, max = 10, perfType = 'blitz,rapid,classical') {
    try {
      // Endpoint to export games of a user
      // https://lichess.org/api/games/user/{username}
      const response = await fetch(
        `${this.baseUrl}/games/user/${username}?max=${max}&pgnInJson=true&opening=true&perfType=${perfType}`,
        {
          headers: {
            'Accept': 'application/x-ndjson', // Ndjson is easier to parse game by game
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Lichess user not found.");
        }
        throw new Error(`Lichess API error: ${response.statusText}`);
      }

      const text = await response.text();

      // Lichess returns ndjson (newline delimited json)
      // We process each line as a JSON object
      const games = text
        .trim()
        .split('\n')
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.error("Failed to parse game line:", line);
            return null;
          }
        })
        .filter(game => game !== null);

      return games;
    } catch (error) {
      console.error("fetchUserGames failed:", error);
      throw error;
    }
  }
}

export const lichessApi = new LichessApiService();
