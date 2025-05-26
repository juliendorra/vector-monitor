// static/game.js

// Game constants (can be adjusted)
export const GAME_WIDTH = 800; // Assumed virtual width for game logic
export const GAME_HEIGHT = 600; // Assumed virtual height for game logic
const PLAYER_SPEED = 5;
const PROJECTILE_SPEED = 7;
const ENEMY_SPEED = 2;
const PLAYER_SIZE = 30; // Used for drawing and simple collision
const PROJECTILE_LENGTH = 20;
const ENEMY_SIZE = 30;
const MAX_PROJECTILES = 5;

// Player state
let player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 50,
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
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 50;
    player.score = 0;
    player.lives = 3; // Or from levelData

    // Clear arrays
    projectiles = [];
    enemies = [];

    // Load enemies from level data (simple example)
    if (levelData && levelData.enemies) {
        levelData.enemies.forEach(enemyConfig => {
            spawnEnemy(enemyConfig.x, enemyConfig.y, enemyConfig.type || 'square', enemyConfig.color || 2, enemyConfig.intensity || 10);
        });
    } else {
        // Default enemy if no level data
        spawnEnemy(100, 50, 'square', 2, 10);
        spawnEnemy(GAME_WIDTH - 100, 50, 'x', 1, 12);
    }

    gameState = 'playing';
    console.log('Game initialized. Player:', player, 'Enemies:', enemies);
}

// Update game state - called every frame
export function updateGame(input) {
    if (gameState !== 'playing') return;

    // Player movement
    if (input.isLeftArrowDown() && player.x > player.width / 2) {
        player.x -= PLAYER_SPEED;
    }
    if (input.isRightArrowDown() && player.x < GAME_WIDTH - player.width / 2) {
        player.x += PLAYER_SPEED;
    }

    // Player shooting
    if (input.isSpaceBarDown() && projectiles.length < MAX_PROJECTILES) {
        // Basic cooldown by limiting max projectiles on screen
        // A more robust cooldown would use timestamps
        let canShoot = true;
        // Check if there's already a projectile recently fired from player's current x
        // to prevent a stream of projectiles merging into one line.
        // This is a simple check; a more complex game might need better handling.
        for (const p of projectiles) {
            if (p.y > player.y - PROJECTILE_LENGTH * 3 && Math.abs(p.x - player.x) < 10) {
                canShoot = false;
                break;
            }
        }

        if (canShoot) {
            spawnProjectile(player.x, player.y - PLAYER_SIZE / 2);
        }
    }

    // Update projectiles
    projectiles.forEach(p => {
        if (p.active) {
            p.y -= PROJECTILE_SPEED;
            if (p.y < 0) {
                p.active = false;
            }
        }
    });
    projectiles = projectiles.filter(p => p.active); // Remove inactive projectiles

    // Update enemies
    enemies.forEach(e => {
        if (e.active) {
            e.y += ENEMY_SPEED; // Simple downward movement
            if (e.y > GAME_HEIGHT + e.height / 2) {
                // Enemy reached bottom
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
    if (enemies.length < 3 && Math.random() < 0.01) { // Randomly spawn if few enemies
        const randomX = Math.random() * (GAME_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2;
        const randomType = Math.random() < 0.5 ? 'square' : 'x';
        const randomColor = Math.floor(Math.random() * 6) + 1; // Avoid color 0 (white often used for player)
        spawnEnemy(randomX, -ENEMY_SIZE / 2, randomType, randomColor, 10 + Math.floor(Math.random()*6) );
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
    enemies.push({
        x: x,
        y: y,
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
            player.x + player.width / 2 > e.x - e.width / 2 && // Assuming player.x is center
            player.y < e.y + e.height / 2 &&
            player.y + player.height / 2 > e.y - e.height / 2) {
            
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