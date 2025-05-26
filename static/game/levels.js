// static/levels.js

// Coordinates are for a 1024x768 game area with (0,0) at the center.
// Positive Y is up.
// Original level design was for 800x600 with (0,0) at top-left.
// Conversion:
// newX = oldX - (NEW_GAME_WIDTH / 2)
// newY = (NEW_GAME_HEIGHT / 2) - oldY

export const levels = [
    {
        name: "Level 1: First Wave",
        player: {
            initialLives: 3
            // Initial position could also be here if we want levels to define it
        },
        enemies: [
            // Old: x: 800*0.2=160, y: 50  => New: x: 160-512=-352, y: 384-50=334
            { x: -352, y: 334, type: 'square', color: 2, intensity: 10 },
            // Old: x: 800*0.5=400, y: 80  => New: x: 400-512=-112, y: 384-80=304
            { x: -112, y: 304, type: 'x', color: 1, intensity: 12 },
            // Old: x: 800*0.8=640, y: 50  => New: x: 640-512=128,  y: 384-50=334
            { x: 128,  y: 334, type: 'square', color: 2, intensity: 10 },
            // Old: x: 800*0.35=280,y: 120 => New: x: 280-512=-232, y: 384-120=264
            { x: -232, y: 264, type: 'x', color: 3, intensity: 11 },
            // Old: x: 800*0.65=520,y: 120 => New: x: 520-512=8,    y: 384-120=264
            { x: 8,    y: 264, type: 'x', color: 3, intensity: 11 },
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
