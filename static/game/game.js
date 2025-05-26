// static/game.js

// Game constants (can be adjusted)
export const GAME_WIDTH = 1024; // New width
export const GAME_HEIGHT = 768; // New height (4:3 aspect ratio)
const PLAYER_SPEED = 5; // Speed might need adjustment for new dimensions
const PROJECTILE_SPEED = 7; // Speed might need adjustment
const ENEMY_SPEED = 2;
const PLAYER_SIZE = 30; // Used for drawing and simple collision
const PROJECTILE_LENGTH = 20;
const ENEMY_SIZE = 30;
const MAX_PROJECTILES = 5;

// Player state
let player = {
    x: 0, // Centered horizontally
    y: -(GAME_HEIGHT / 2) + 80, // Near the bottom edge
    width: PLAYER_SIZE, // For collision
    height: PLAYER_SIZE, // For collision
    score: 0,
    lives: 3,
    color: 4, // Example color index (e.g., red from dvgsim)
    intensity: 15
};

// Projectiles state
let projectiles = []; // Array of {x, y, active}

// Enemies state
let enemies = []; // Array of {x, y, type, width, height, active, color, intensity}

// Game state
let gameState = 'playing'; // 'playing', 'gameOver'

// Initialization function
export function initGame(levelData) {
    // Reset player
    player.x = 0; // Centered horizontally
    player.y = -(GAME_HEIGHT / 2) + 80; // Near the bottom edge
    player.score = 0;
    player.lives = (levelData && levelData.player && typeof levelData.player.initialLives !== 'undefined') ? levelData.player.initialLives : 3;

    // Clear arrays
    projectiles = [];
    enemies = [];

    // Load enemies from level data (simple example)
    if (levelData && levelData.enemies) {
        levelData.enemies.forEach(enemyConfig => {
            // Adjust enemy spawn x, y from level data if they are based on old coords
            // For now, assume level data will be updated for new coordinate system
            // Example: if level x was 100 (on 800 width), new x could be 100 - 400 = -300
            // Example: if level y was 50 (on 600 height, top-down), new y could be (600/2) - 50 = 250
            spawnEnemy(
                enemyConfig.x, // Assuming level data x is already relative to center
                enemyConfig.y, // Assuming level data y is already relative to center (e.g. from top)
                enemyConfig.type || 'square',
                enemyConfig.color || 2,
                enemyConfig.intensity || 10
            );
        });
    } else {
        // Default enemies, positions adjusted for new coordinate system
        spawnEnemy(-GAME_WIDTH / 4, (GAME_HEIGHT / 2) - ENEMY_SIZE * 2, 'square', 2, 10); // Top-leftish
        spawnEnemy(GAME_WIDTH / 4, (GAME_HEIGHT / 2) - ENEMY_SIZE * 2, 'x', 1, 12);    // Top-rightish
    }

    gameState = 'playing';
    console.log('Game initialized. Player:', player, 'Enemies:', enemies);
}

// Update game state - called every frame
export function updateGame(input) {
    if (gameState !== 'playing') return;

    // Player movement
    if (input.isLeftArrowDown() && player.x > -(GAME_WIDTH / 2) + player.width / 2) {
        player.x -= PLAYER_SPEED;
    }
    if (input.isRightArrowDown() && player.x < (GAME_WIDTH / 2) - player.width / 2) {
        player.x += PLAYER_SPEED;
    }

    // Player shooting
    if (input.isSpaceBarDown() && projectiles.length < MAX_PROJECTILES) {
        let canShoot = true;
        for (const p of projectiles) {
            // Adjust Y check for new coord system: projectile moves towards +Y
            // player.y is near bottom (-GAME_HEIGHT/2 + offset)
            // A projectile at player.y + PROJECTILE_LENGTH*3 would be higher than player
            if (p.y < player.y + PROJECTILE_LENGTH * 3 && Math.abs(p.x - player.x) < 10) {
                canShoot = false;
                break;
            }
        }

        if (canShoot) {
            // Projectile starts at player's "tip" (center + half size up)
            spawnProjectile(player.x, player.y + PLAYER_SIZE / 2);
        }
    }

    // Update projectiles
    projectiles.forEach(p => {
        if (p.active) {
            p.y += PROJECTILE_SPEED; // Projectiles move towards positive Y (up on screen)
            if (p.y > (GAME_HEIGHT / 2)) { // Off top screen
                p.active = false;
            }
        }
    });
    projectiles = projectiles.filter(p => p.active); // Remove inactive projectiles

    // Update enemies
    enemies.forEach(e => {
        if (e.active) {
            e.y -= ENEMY_SPEED; // Enemies move towards negative Y (down on screen)
            if (e.y < -(GAME_HEIGHT / 2) - e.height / 2) { // Off bottom screen
                e.active = false;
                player.lives--;
                if (player.lives <= 0) {
                    gameState = 'gameOver';
                }
            }
        }
    });
    enemies = enemies.filter(e => e.active); // Remove inactive enemies

    // Collision detection
    checkCollisions();

    // Spawn new enemies if needed (very basic for now)
    if (enemies.length < 3 && Math.random() < 0.01) {
        // Spawn at top edge, across width
        const randomX = (Math.random() - 0.5) * (GAME_WIDTH - ENEMY_SIZE);
        const randomY = (GAME_HEIGHT / 2) - ENEMY_SIZE / 2; // At the top edge
        const randomType = Math.random() < 0.5 ? 'square' : 'x';
        const randomColor = Math.floor(Math.random() * 5) + 1; // Colors 1-5
        spawnEnemy(randomX, randomY, randomType, randomColor, 10 + Math.floor(Math.random() * 6));
    }

    if (gameState === 'gameOver') {
        console.log('Game Over. Final Score:', player.score);
    }
}

function spawnProjectile(x, y) {
    if (projectiles.filter(p => p.active).length < MAX_PROJECTILES) {
        projectiles.push({
            x: x,
            y: y,
            width: 2, // For collision
            height: PROJECTILE_LENGTH, // For collision
            active: true,
            color: 6, // Example color (e.g., blue)
            intensity: 12
        });
    }
}

function spawnEnemy(x, y, type, color, intensity) {
    // Ensure y is at the top for new spawns if not specified otherwise
    const spawnY = y !== undefined ? y : (GAME_HEIGHT / 2) - ENEMY_SIZE / 2;
    enemies.push({
        x: x,
        y: spawnY,
        type: type, // 'square', 'x'
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        active: true,
        color: color,
        intensity: intensity
    });
}

function checkCollisions() {
    // Projectile-Enemy collisions
    projectiles.forEach(p => {
        if (!p.active) return;
        enemies.forEach(e => {
            if (!e.active) return;

            // Simple AABB collision detection
            if (p.x < e.x + e.width / 2 &&
                p.x + p.width > e.x - e.width / 2 &&
                p.y < e.y + e.height / 2 &&
                p.y + p.height > e.y - e.height / 2) {
                
                p.active = false;
                e.active = false; // Enemy is hit
                player.score += 10; // Increase score
                // console.log('Enemy hit! Score:', player.score);
                // TODO: Add explosion effect later
            }
        });
    });

    // Player-Enemy collisions
    enemies.forEach(e => {
        if (!e.active) return;

        if (player.x < e.x + e.width / 2 &&
            // Player's x,y is center. Enemy's x,y is center.
            // Check half-widths and half-heights.
            // abs(player.x - e.x) < (player.width/2 + e.width/2)
            // abs(player.y - e.y) < (player.height/2 + e.height/2)
            if (Math.abs(player.x - e.x) * 2 < (player.width + e.width) &&
                Math.abs(player.y - e.y) * 2 < (player.height + e.height)) {
            
            e.active = false; // Enemy is removed
            player.lives--;
            // console.log('Player hit! Lives left:', player.lives);
            if (player.lives <= 0) {
                gameState = 'gameOver';
            }
            // TODO: Add player hit effect (e.g., brief invincibility, screen flash)
        }
    });
}

// Getter functions for game state, player, enemies, projectiles
export function getPlayerState() {
    return { ...player };
}

export function getProjectilesState() {
    return projectiles.filter(p => p.active);
}

export function getEnemiesState() {
    return enemies.filter(e => e.active);
}

export function getGameState() {
    return gameState;
}

export function getScore() {
    return player.score;
}

export function getLives() {
    return player.lives;
}
