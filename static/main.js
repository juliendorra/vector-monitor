// static/main.js

import * as input from './input.js';
import * as game from './game.js';
import * as vector from './vector.js';
import * as levels from './levels.js';

// FPS control
const FPS = 30; // Target FPS
const frameInterval = 1000 / FPS;
let lastFrameTime = 0;
let animationFrameId;

// DVG command buffer
let dvgCommands = [];

// Access to sendDVGCommands from the global scope (game.html)
// This assumes sendDVGCommands is made available globally or passed in.
// For now, we'll rely on it being on `window` if game.html defines it there,
// or we might need to adjust how it's accessed.
// Let's assume game.html's inline script will expose it or main.js is part of that scope.
// For direct use, we'll call `window.sendDVGCommandsFromGameHTML` which we'll define in game.html
const sendDVGToMonitor = window.sendDVGCommandsFromGameHTML;


function gameLoop(currentTime) {
    animationFrameId = requestAnimationFrame(gameLoop);

    const elapsed = currentTime - lastFrameTime;

    // Enforce FPS
    if (elapsed < frameInterval) {
        return;
    }
    lastFrameTime = currentTime - (elapsed % frameInterval);

    // 1. Read Input (input module already handles this via event listeners)
    const playerInput = {
        isLeftArrowDown: input.isLeftArrowDown,
        isRightArrowDown: input.isRightArrowDown,
        isSpaceBarDown: input.isSpaceBarDown
    };

    // 2. Update Game State
    game.updateGame(playerInput);

    // 3. Generate DVG Commands
    dvgCommands = ['LABEL START']; // Start of the DVG program for looping

    // Get game elements' states
    const playerState = game.getPlayerState();
    const projectilesState = game.getProjectilesState();
    const enemiesState = game.getEnemiesState();
    const currentGameState = game.getGameState();
    const score = game.getScore();
    const lives = game.getLives();

    if (currentGameState === 'playing') {
        // Draw player
        dvgCommands.push(...vector.drawPlayer(playerState.x, playerState.y, game.PLAYER_SIZE, playerState.color, playerState.intensity));

        // Draw projectiles
        projectilesState.forEach(p => {
            dvgCommands.push(...vector.drawProjectile(p.x, p.y, game.PROJECTILE_LENGTH, p.color, p.intensity));
        });

        // Draw enemies
        enemiesState.forEach(e => {
            if (e.type === 'square') {
                dvgCommands.push(...vector.drawEnemySquare(e.x, e.y, game.ENEMY_SIZE, e.color, e.intensity));
            } else if (e.type === 'x') {
                dvgCommands.push(...vector.drawEnemyX(e.x, e.y, game.ENEMY_SIZE, e.color, e.intensity));
            }
            // Potentially add hatch fill for some enemies
            // if (e.type === 'square') {
            //     dvgCommands.push(...vector.drawHatch(e.x - game.ENEMY_SIZE/2, e.y - game.ENEMY_SIZE/2, game.ENEMY_SIZE, game.ENEMY_SIZE, 5, e.color, e.intensity / 2, true));
            // }
        });

        // Draw Score (simple placeholder for now, actual text is complex)
        // Example: draw a small line for each 10 points
        const scoreMarkerX = 10;
        const scoreMarkerY = 20;
        const scoreMarkerLength = 5;
        for (let i = 0; i < score / 10; i++) {
            dvgCommands.push(...vector.drawProjectile(scoreMarkerX + i * (scoreMarkerLength + 2), scoreMarkerY, scoreMarkerLength, 1, 15));
        }
        // dvgCommands.push(...vector.drawText(`Score: ${score}`, 10, 20, 10, 1, 15));


        // Draw Lives (simple placeholder)
        // Example: draw a small player shape for each life
        const lifeMarkerX = game.GAME_WIDTH - 50;
        const lifeMarkerY = 20;
        const lifeSize = 15;
        for (let i = 0; i < lives; i++) {
            dvgCommands.push(...vector.drawPlayer(lifeMarkerX - i * (lifeSize + 5), lifeMarkerY, lifeSize, playerState.color, playerState.intensity));
        }
        // dvgCommands.push(...vector.drawText(`Lives: ${lives}`, game.GAME_WIDTH - 80, 20, 10, 1, 15));


    } else if (currentGameState === 'gameOver') {
        // Display "GAME OVER" (placeholder)
        // For actual text, we'd need a vector font.
        // Drawing a large X as a placeholder for "GAME OVER"
        dvgCommands.push(...vector.drawEnemyX(game.GAME_WIDTH / 2, game.GAME_HEIGHT / 2, 200, 4, 15)); // Large Red X
        // And score
        const scoreMarkerX = game.GAME_WIDTH/2 - 50;
        const scoreMarkerY = game.GAME_HEIGHT/2 + 120;
        const scoreMarkerLength = 10;
         for (let i = 0; i < score / 10; i++) {
            dvgCommands.push(...vector.drawProjectile(scoreMarkerX + i * (scoreMarkerLength + 2), scoreMarkerY, scoreMarkerLength, 1, 15));
        }
    }

    dvgCommands.push('JMPL START'); // Loop the DVG program

    // 4. Send DVG to Monitor
    if (sendDVGToMonitor) {
        sendDVGToMonitor(dvgCommands.join('\n'), 2000 + dvgCommands.length * 5); // Adjust VPS based on complexity
    } else {
        console.warn('sendDVGCommandsFromGameHTML is not available on window.');
    }
}

function startGame() {
    console.log("Main.js: Starting game...");
    const level1Data = levels.getCurrentLevelData(); // Or choose a specific level
    game.initGame(level1Data); // Initialize game with level data

    // Stop any existing loop before starting a new one
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    lastFrameTime = performance.now(); // Reset frame timer
    gameLoop(lastFrameTime);
}

// Expose startGame to be callable from HTML, e.g., by a button or after PeerJS connects.
// For now, we'll call it directly when the module loads and PeerJS is expected to be ready.
// However, it's better to call it once PeerJS connection to monitor is confirmed.

// The actual start should be triggered from game.html's inline script
// once the PeerJS connection to the monitor is established.
// For now, we export it.
export { startGame };

console.log('static/main.js loaded.');
```
