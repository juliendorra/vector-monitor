// static/game/main.js

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

let sendDVGToMonitor; // Will be initialized by startGame

function gameLoop(currentTime) {
    animationFrameId = requestAnimationFrame(gameLoop);

    const elapsed = currentTime - lastFrameTime;

    // Enforce FPS
    if (elapsed < frameInterval) {
        return;
    }
    lastFrameTime = currentTime - (elapsed % frameInterval);

    // 1. Read Input
    const playerInput = {
        isLeftArrowDown: input.isLeftArrowDown,
        isRightArrowDown: input.isRightArrowDown,
        isSpaceBarDown: input.isSpaceBarDown
    };

    // 2. Update Game State
    game.updateGame(playerInput);

    // 3. Generate DVG Commands
    dvgCommands = ['LABEL START']; // Start of the DVG program for looping

    const playerState = game.getPlayerState();
    const projectilesState = game.getProjectilesState();
    const enemiesState = game.getEnemiesState();
    const currentGameState = game.getGameState();
    const score = game.getScore();
    const lives = game.getLives();

    // --- BEGIN DEBUG LOGGING ---
    const playerStateForLog = game.getPlayerState();
    const enemiesStateForLog = game.getEnemiesState();

    console.log(`[GameLoop Debug] Player State: x=${playerStateForLog.x}, y=${playerStateForLog.y}, color=${playerStateForLog.color}, intensity=${playerStateForLog.intensity}, width=${playerStateForLog.width} (PLAYER_SIZE: ${game.PLAYER_SIZE})`);

    if (enemiesStateForLog.length > 0) {
        enemiesStateForLog.forEach((enemy, index) => {
            console.log(`[GameLoop Debug] Enemy ${index}: x=${enemy.x}, y=${enemy.y}, type=${enemy.type}, color=${enemy.color}, intensity=${enemy.intensity}, active=${enemy.active}, width=${enemy.width} (ENEMY_SIZE: ${game.ENEMY_SIZE})`);
        });
    } else {
        console.log("[GameLoop Debug] No active enemies.");
    }
    // --- END DEBUG LOGGING ---

    if (currentGameState === 'playing') {
        dvgCommands.push(...vector.drawPlayer(playerState.x, playerState.y, game.PLAYER_SIZE, playerState.color, playerState.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));

        projectilesState.forEach(p => {
            dvgCommands.push(...vector.drawProjectile(p.x, p.y, game.PROJECTILE_LENGTH, p.color, p.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
        });

        enemiesState.forEach(e => {
            if (e.type === 'square') {
                dvgCommands.push(...vector.drawEnemySquare(e.x, e.y, game.ENEMY_SIZE, e.color, e.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
            } else if (e.type === 'x') {
                dvgCommands.push(...vector.drawEnemyX(e.x, e.y, game.ENEMY_SIZE, e.color, e.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
            }
        });

        const scoreMarkerX = 10;
        const scoreMarkerY = 20;
        const scoreMarkerLength = 5;
        for (let i = 0; i < score / 10; i++) {
            dvgCommands.push(...vector.drawProjectile(scoreMarkerX + i * (scoreMarkerLength + 2), scoreMarkerY, scoreMarkerLength, 1, 15, game.GAME_WIDTH, game.GAME_HEIGHT));
        }

        const lifeMarkerX = game.GAME_WIDTH - 50;
        const lifeMarkerY = 20;
        const lifeSize = 15;
        for (let i = 0; i < lives; i++) {
            dvgCommands.push(...vector.drawPlayer(lifeMarkerX - i * (lifeSize + 5), lifeMarkerY, lifeSize, playerState.color, playerState.intensity, game.GAME_WIDTH, game.GAME_HEIGHT));
        }

    } else if (currentGameState === 'gameOver') {
        dvgCommands.push(...vector.drawEnemyX(game.GAME_WIDTH / 2, game.GAME_HEIGHT / 2, 200, 4, 15, game.GAME_WIDTH, game.GAME_HEIGHT)); // Large Red X for GAME OVER
        const scoreMarkerX = game.GAME_WIDTH / 2 - 50;
        const scoreMarkerY = game.GAME_HEIGHT / 2 + 120;
        const scoreMarkerLength = 10;
        for (let i = 0; i < score / 10; i++) {
            dvgCommands.push(...vector.drawProjectile(scoreMarkerX + i * (scoreMarkerLength + 2), scoreMarkerY, scoreMarkerLength, 1, 15, game.GAME_WIDTH, game.GAME_HEIGHT));
        }
    }

    dvgCommands.push('JMPL START');

    // 4. Send DVG to Monitor
    if (sendDVGToMonitor) {
        sendDVGToMonitor(dvgCommands.join('\n'), dvgCommands.length * 60);
    } else {
        console.warn('sendDVGCommandsFromGameHTML is not available on window. DVG commands not sent.');
    }
}

export function startGame(sendFunction) {
    console.log("static/game/main.js: Starting game...");
    sendDVGToMonitor = sendFunction; // Assign the passed function

    const level1Data = levels.getCurrentLevelData();
    game.initGame(level1Data);

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    lastFrameTime = performance.now();
    gameLoop(lastFrameTime);
}

console.log('static/game/main.js loaded.');