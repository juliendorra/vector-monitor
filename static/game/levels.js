// static/levels.js

import { GAME_WIDTH } from './game.js'; // Optional: For positioning based on game width

export const levels = [
    {
        name: "Level 1: First Wave",
        player: {
            initialLives: 3
            // Initial position could also be here if we want levels to define it
        },
        enemies: [
            { x: GAME_WIDTH * 0.2, y: 50, type: 'square', color: 2, intensity: 10 },
            { x: GAME_WIDTH * 0.5, y: 80, type: 'x', color: 1, intensity: 12 },
            { x: GAME_WIDTH * 0.8, y: 50, type: 'square', color: 2, intensity: 10 },
            { x: GAME_WIDTH * 0.35, y: 120, type: 'x', color: 3, intensity: 11 },
            { x: GAME_WIDTH * 0.65, y: 120, type: 'x', color: 3, intensity: 11 },
        ],
        // Future ideas:
        // - backgroundDvgCommands: ["LABEL BG_STARS", "...", "JMPL BG_STARS"]
        // - enemySpawnRate: 0.02 // If not using fixed enemy lists
        // - winConditions: { score: 1000 } or { enemiesCleared: true }
    },
    // More levels could be added here
    // {
    //     name: "Level 2: Asteroid Field",
    //     enemies: [ /* ... different enemy configurations ... */ ],
    // }
];

export function getLevelData(levelNumber) {
    // Level numbers are typically 1-based for users, arrays are 0-based.
    const levelIndex = levelNumber - 1;
    if (levelIndex >= 0 && levelIndex < levels.length) {
        return levels[levelIndex];
    } else {
        console.warn(`Level ${levelNumber} not found. Returning null or default.`);
        return null; // Or return a default level, or levels[0]
    }
}

// For now, we'll just use the first level by default.
export function getCurrentLevelData() {
    return getLevelData(1); // Default to level 1
}