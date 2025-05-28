// static/game/main.js
import * as game from './game.js';
import * as input from './input.js';
import * as vector from './vector.js';
import * as levels from './levels.js';

let animationFrameId = null;
let sendDVGToMonitor = null; // Function to send DVG commands
let lastSentDVGString = null; // Stores the last DVG string sent to the monitor

// --- BEGIN DEBUG LOGGING VARIABLES ---
const DEBUG_GAME_LOOP = false; // Master switch for game loop debug logs
const LOG_INTERVAL = 300; // Log every 300 frames (approx 5 seconds at 60fps)
let frameCount = 0;
// --- END DEBUG LOGGING VARIABLES ---

function gameLoop() {
    // 1. Update game state based on input and time
    game.updateGame(input);

    // 2. Get current game state for drawing
    const playerState = game.getPlayerState();
    const projectilesState = game.getProjectilesState();
    const enemiesState = game.getEnemiesState();
    const explosionsState = game.getExplosionsState(); // Get active explosion fragments
    const currentGameState = game.getGameState();
    const score = game.getScore();
    const lives = game.getLives();

    // --- BEGIN DEBUG LOGGING ---
    if (DEBUG_GAME_LOOP && frameCount % LOG_INTERVAL === 0) {
        console.log(`[GameLoop Debug Frame #${frameCount}]`);
        console.log(`[GameLoop Debug] Game State: ${currentGameState}`);
        console.log(`[GameLoop Debug] Player: x=${playerState.x}, y=${playerState.y}, lives=${lives}, score=${score}`);
        
        const projectilesStateForLog = projectilesState;
        if (projectilesStateForLog.length > 0) {
            projectilesStateForLog.forEach((proj, index) => {
                console.log(`[GameLoop Debug] Projectile ${index}: x=${proj.x}, y=${proj.y}, active=${proj.active}`);
            });
        } else {
            console.log("[GameLoop Debug] No active projectiles.");
        }

        const enemiesStateForLog = enemiesState;
        if (enemiesStateForLog.length > 0) {
            enemiesStateForLog.forEach((enemy, index) => {
                console.log(`[GameLoop Debug] Enemy ${index}: x=${enemy.x}, y=${enemy.y}, type=${enemy.type}, color=${enemy.color}, intensity=${enemy.intensity}, active=${enemy.active}, width=${enemy.width} (ENEMY_SIZE: ${game.ENEMY_SIZE})`);
            });
        } else {
            console.log("[GameLoop Debug] No active enemies.");
        }
    }
    frameCount++;
    // --- END DEBUG LOGGING ---

    // 3. Prepare DVG commands
    const dvgCommands = ['LABEL START'];

    if (currentGameState === 'playing') {
        dvgCommands.push(...vector.drawPlayer(playerState.x, playerState.y, playerState.width, playerState.color, playerState.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));

        projectilesState.forEach(p => {
            dvgCommands.push(...vector.drawProjectile(p.x, p.y, game.PROJECTILE_LENGTH, p.color, p.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
        });

        enemiesState.forEach(e => {
            if (e.type === 'square') {
                dvgCommands.push(...vector.drawEnemySquare(e.x, e.y, e.width, e.color, e.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
            } else if (e.type === 'x') {
                dvgCommands.push(...vector.drawEnemyX(e.x, e.y, e.width, e.color, e.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
            }
        });

        // Draw score
        const scoreMarkerX = 10; // Top-left for score
        const scoreMarkerY = 20;
        const scoreMarkerLength = 5; // Length of each score tick
        for (let i = 0; i < score / 10; i++) { // Assuming 10 points per tick
            dvgCommands.push(...vector.drawProjectile(scoreMarkerX + i * (scoreMarkerLength + 2), scoreMarkerY, scoreMarkerLength, 1, 15, game.GAME_WIDTH, game.GAME_HEIGHT));
        }

        // Draw lives
        const lifeMarkerX = game.GAME_WIDTH - 50; // Top-right for lives
        const lifeMarkerY = 50;
        const lifeSize = 15; // Size of the life icon (player ship)
        const lifeSpacing = 25;
        for (let i = 0; i < lives; i++) {
            dvgCommands.push(...vector.drawPlayer(lifeMarkerX - i * lifeSpacing, lifeMarkerY, lifeSize, playerState.color, playerState.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
        }

        // Draw explosions
        explosionsState.forEach(fragment => {
            dvgCommands.push(...vector.drawExplosionFragment(fragment, game.GAME_WIDTH, game.GAME_HEIGHT));
        });

    } else if (currentGameState === 'gameOver') {
        // Draw "GAME OVER" text in white (color 0) with intensity 2
        dvgCommands.push(...vector.drawGameOverText(game.GAME_WIDTH, game.GAME_HEIGHT, 0, 2));
        
        // Draw final score below the game over text using tick marks, centered
        const numScoreTicks = score / 10;
        const scoreMarkerLength = 10; // Length of each score tick
        const scoreTickSpacing = 2; // Spacing between ticks
        const totalScoreMarkerWidth = numScoreTicks * scoreMarkerLength + Math.max(0, numScoreTicks - 1) * scoreTickSpacing;
        
        const scoreMarkerStartX = game.GAME_WIDTH / 2 - totalScoreMarkerWidth / 2;
        const scoreMarkerY = game.GAME_HEIGHT / 2 + 80; // Position below "GAME OVER"

        for (let i = 0; i < numScoreTicks; i++) {
            dvgCommands.push(...vector.drawProjectile(scoreMarkerStartX + i * (scoreMarkerLength + scoreTickSpacing), scoreMarkerY, scoreMarkerLength, 1, 15, game.GAME_WIDTH, game.GAME_HEIGHT));
        }
    }

    dvgCommands.push('JMPL START');

    // 4. Send DVG to Monitor only if it has changed
    const currentDVGString = dvgCommands.join('\n');
    if (sendDVGToMonitor) {
        if (currentDVGString !== lastSentDVGString) {
            sendDVGToMonitor(currentDVGString, dvgCommands.length * 60); // Adjust VPS as needed
            lastSentDVGString = currentDVGString;
        }
    } else {
        console.warn('sendDVGToMonitor is not available. DVG commands not sent.');
    }

    // 5. Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

export function startGame(sendFunction) {
    console.log("static/game/main.js: Starting game...");
    sendDVGToMonitor = sendFunction; // Assign the passed function
    lastSentDVGString = null; // Reset last sent DVG string to ensure the first frame is sent

    const levelData = levels.getCurrentLevelData();
    if (!levelData) {
        console.error("Failed to load level data. Cannot start game.");
        // Potentially stop or indicate error on screen
        return;
    }
    game.initGame(levelData);

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    frameCount = 0; // Reset frame count for logging
    gameLoop(); // Start the loop
}

// Optional: A function to stop the game loop if needed
export function stopGame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Game loop stopped.");
    }
}

console.log('static/game/main.js loaded.');