/**
 * Board color themes for Chess-OP
 */

export const BOARD_THEMES = [
  { id: 'classic', name: 'Classic Brown', lightSquare: '#f0d9b5', darkSquare: '#b58863', accent: '#829769', highlight: '#ced26b' },
  { id: 'blue', name: 'Blue Ocean', lightSquare: '#dee3e6', darkSquare: '#8ca2ad', accent: '#5a8fa0', highlight: '#82b2c0' },
  { id: 'green', name: 'Forest Green', lightSquare: '#ffffdd', darkSquare: '#86a666', accent: '#6d9b4a', highlight: '#b3d944' },
  { id: 'dark', name: 'Midnight', lightSquare: '#a0a0a0', darkSquare: '#505050', accent: '#666', highlight: '#888' },
  { id: 'purple', name: 'Royal Purple', lightSquare: '#e8d0ff', darkSquare: '#7b61a3', accent: '#9b59b6', highlight: '#c39bd3' },
  { id: 'coral', name: 'Sunset Coral', lightSquare: '#ffd5c0', darkSquare: '#d08050', accent: '#e67e5a', highlight: '#f4a982' },
  { id: 'ice', name: 'Arctic Ice', lightSquare: '#e8f4f8', darkSquare: '#5a8fa0', accent: '#4a90a4', highlight: '#7dc4d4' },
  { id: 'wood', name: 'Walnut Wood', lightSquare: '#e8c99b', darkSquare: '#a07040', accent: '#8b6b3d', highlight: '#c9a05c' },
];

export const BOARD_THEME_MAP = Object.fromEntries(BOARD_THEMES.map(t => [t.id, t]));

export function getBoardTheme(themeId) {
  return BOARD_THEME_MAP[themeId] || BOARD_THEMES[0];
}
