// static/game.js

// Game constants (can be adjusted)
export const GAME_WIDTH = 800; // Assumed virtual width for game logic
export const GAME_HEIGHT = 600; // Assumed virtual height for game logic
// --- BEGIN DIAGNOSTIC LOGGING ---
console.log(`[game.js] Initial GAME_WIDTH: ${GAME_WIDTH}, GAME_HEIGHT: ${GAME_HEIGHT}`);
// --- END DIAGNOSTIC LOGGING ---
const MAX_PLAYER_SPEED = 7; // Player's maximum horizontal speed
const PLAYER_ACCELERATION = 0.5; // How quickly the player's speed changes
const PLAYER_FRICTION = 0.08; // Rate at which player slows down (e.g., 0.08 means 8% speed reduction per frame when not accelerating)

const BASE_ENEMY_SPEED = 2; // Base speed for enemies moving downwards
const ENEMY_SPEED_VARIATION = 1; // Enemies will move at BASE_ENEMY_SPEED +/- ENEMY_SPEED_VARIATION (randomly)

const PROJECTILE_SPEED = 7;
export const PLAYER_SIZE = 30; // Used for drawing and simple collision
export const PROJECTILE_LENGTH = 20;
export const ENEMY_SIZE = 30;
const MAX_PROJECTILES = 5;

// Explosion constants
const EXPLOSION_LIFETIME = 30; // frames, e.g., 0.5 seconds at 60fps
const FRAGMENT_BASE_SPEED = 2.5;
const FRAGMENT_ROTATION_SPEED = 0.1; // radians per frame
const FRAGMENT_DEFAULT_LENGTH = 15;


// Player state
let player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 50,
    dx: 0, // Player's current horizontal velocity
    width: PLAYER_SIZE, // For collision
    height: PLAYER_SIZE, // For collision
    score: 0,
    lives: 3,
    color: 4, // Example color index (e.g., red from dvgsim)
    intensity: 5
};

// Projectiles state
let projectiles = []; // Array of {x, y, active}

// Enemies state
let enemies = []; // Array of {x, y, type, width, height, active, color, intensity}

// Explosions state
let explosions = []; // Array of explosion objects { x, y, fragments: [], lifetime }

// Game state
let gameState = 'playing'; // 'playing', 'gameOver'

// Store the current level data for restart functionality
let currentLevelData = null;

// Initialization function
export function initGame(levelData) {
    // --- BEGIN DIAGNOSTIC LOGGING ---
    console.log('[game.js initGame] Called. GAME_WIDTH:', GAME_WIDTH, 'GAME_HEIGHT:', GAME_HEIGHT);
    console.log('[game.js initGame] Received levelData:', JSON.stringify(levelData, null, 2));
    // --- END DIAGNOSTIC LOGGING ---

    // Store level data for restart
    currentLevelData = levelData;

    // Reset player
    player.x = GAME_WIDTH / 2;
    player.y = GAME_HEIGHT - 50;
    player.score = 0;
    player.lives = levelData?.player?.initialLives || 3;

    // Clear arrays
    projectiles = [];
    enemies = [];
    explosions = []; // Clear explosions

    // Load enemies from level data (simple example)
    if (levelData && levelData.enemies) {
        levelData.enemies.forEach(enemyConfig => {
            // --- BEGIN DIAGNOSTIC LOGGING ---
            console.log(`[game.js initGame forEach] Processing enemyConfig: x=${enemyConfig.x}, y=${enemyConfig.y}, type=${enemyConfig.type}`);
            // --- END DIAGNOSTIC LOGGING ---
            spawnEnemy(enemyConfig.x, enemyConfig.y, enemyConfig.type || 'square', enemyConfig.color || 2, enemyConfig.intensity || 5);
        });
    } else {
        // Default enemy if no level data
        spawnEnemy(100, 50, 'square', 2, 10);
        spawnEnemy(GAME_WIDTH - 100, 50, 'x', 1, 12);
    }

    gameState = 'playing';
    console.log('Game initialized. Player:', player, 'Enemies:', enemies);
}

// Restart game function
export function restartGame() {
    console.log('Restarting game...');
    if (currentLevelData) {
        initGame(currentLevelData);
    } else {
        // Fallback to default initialization
        initGame(null);
    }
}

// Update game state - called every frame
export function updateGame(input) {
    if (gameState !== 'playing') return;

    // Player movement with acceleration and friction
    let isAccelerating = false;
    if (input.isLeftArrowDown()) {
        player.dx -= PLAYER_ACCELERATION;
        isAccelerating = true;
    }
    if (input.isRightArrowDown()) {
        player.dx += PLAYER_ACCELERATION;
        isAccelerating = true;
    }

    // Apply friction if not actively accelerating (i.e., no movement keys pressed or keys conflict)
    if (!isAccelerating) {
        player.dx *= (1 - PLAYER_FRICTION);
        // If speed is very low, stop the player to prevent endless small movements and ensure dx becomes exactly 0
        if (Math.abs(player.dx) < 0.1) {
            player.dx = 0;
        }
    }

    // Clamp player speed to MAX_PLAYER_SPEED
    player.dx = Math.max(-MAX_PLAYER_SPEED, Math.min(MAX_PLAYER_SPEED, player.dx));

    // Update player position based on velocity
    player.x += player.dx;

    // Boundary checks for player - stop and reset velocity if hitting walls
    // Player's x is its center. Player's visual width is player.width.
    const halfPlayerWidth = player.width / 2;
    if (player.x - halfPlayerWidth < 0) { // Hit left wall
        player.x = halfPlayerWidth;
        player.dx = 0; // Stop at boundary
    }
    if (player.x + halfPlayerWidth > GAME_WIDTH) { // Hit right wall
        player.x = GAME_WIDTH - halfPlayerWidth;
        player.dx = 0; // Stop at boundary
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
            e.y += e.speed; // Use individual enemy speed for downward movement
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

    // Update explosions
    updateExplosions();

    // Spawn new enemies if needed (very basic for now)
    if (enemies.length < 3 && Math.random() < 0.01) { // Randomly spawn if few enemies
        const randomX = Math.random() * (GAME_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2;
        const randomType = Math.random() < 0.5 ? 'square' : 'x';
        const randomColor = Math.floor(Math.random() * 6) + 1; // Avoid color 0 (white often used for player)
        spawnEnemy(randomX, -ENEMY_SIZE / 2, randomType, randomColor, 10 + Math.floor(Math.random() * 6));
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
            intensity: 5
        });
    }
}

function spawnEnemy(x, y, type, color, intensity) {
    // Assign a varied speed to each enemy
    const speedVariation = (Math.random() * 2 - 1) * ENEMY_SPEED_VARIATION; // Random value between -ENEMY_SPEED_VARIATION and +ENEMY_SPEED_VARIATION
    const individualSpeed = Math.max(0.5, BASE_ENEMY_SPEED + speedVariation); // Ensure a minimum positive speed

    enemies.push({
        x: x,
        y: y,
        type: type, // 'square', 'x'
        width: ENEMY_SIZE,
        height: ENEMY_SIZE,
        active: true,
        color: color,
        intensity: intensity,
        speed: individualSpeed // Store individual speed for this enemy
    });
}

function createFragment(x, y, dx, dy, initialLength, dRotation, color, initialIntensity, lifetime, isBoxSide = false, initialRotation = 0) {
    return {
        x, y, dx, dy,
        currentLength: initialLength,
        initialLength,
        rotation: initialRotation,
        dRotation: isBoxSide ? 0 : dRotation,
        color,
        currentIntensity: initialIntensity,
        initialIntensity,
        lifetime,
        isBoxSide
    };
}

function spawnExplosion(enemy) {
    const newExplosion = {
        x: enemy.x,
        y: enemy.y,
        fragments: []
        // lifetime: EXPLOSION_LIFETIME // Not strictly needed if fragments manage their own
    };

    if (enemy.type === 'square') {
        const halfW = enemy.width / 2;
        const halfH = enemy.height / 2;
        const outwardSpeed = FRAGMENT_BASE_SPEED * 0.6;
        const rotationSpeed = FRAGMENT_ROTATION_SPEED * (Math.random() > 0.5 ? 1 : -1);

        // Top edge
        newExplosion.fragments.push(createFragment(enemy.x, enemy.y - halfH, 0, -outwardSpeed, enemy.width, rotationSpeed, enemy.color, enemy.intensity, EXPLOSION_LIFETIME, false, 0));
        // Bottom edge
        newExplosion.fragments.push(createFragment(enemy.x, enemy.y + halfH, 0, outwardSpeed, enemy.width, rotationSpeed, enemy.color, enemy.intensity, EXPLOSION_LIFETIME, false, 0));
        // Left edge
        newExplosion.fragments.push(createFragment(enemy.x - halfW, enemy.y, -outwardSpeed, 0, enemy.height, rotationSpeed, enemy.color, enemy.intensity, EXPLOSION_LIFETIME, false, Math.PI / 2));
        // Right edge
        newExplosion.fragments.push(createFragment(enemy.x + halfW, enemy.y, outwardSpeed, 0, enemy.height, rotationSpeed, enemy.color, enemy.intensity, EXPLOSION_LIFETIME, false, Math.PI / 2));
    } else if (enemy.type === 'x') {
        const lineLength = enemy.width * Math.sqrt(2); // enemy.width is the size of the bounding box for X

        // Fragment 1 (diagonal \)
        const angle1 = Math.PI / 4; // 45 degrees
        newExplosion.fragments.push(createFragment(
            enemy.x, enemy.y,
            FRAGMENT_BASE_SPEED * Math.cos(angle1 + Math.PI / 2) * 0.7, // Move perpendicular to line, slightly slower
            FRAGMENT_BASE_SPEED * Math.sin(angle1 + Math.PI / 2) * 0.7,
            lineLength,
            FRAGMENT_ROTATION_SPEED * (Math.random() > 0.5 ? 1 : -1),
            enemy.color, enemy.intensity, EXPLOSION_LIFETIME,
            false, angle1
        ));

        // Fragment 2 (diagonal /)
        const angle2 = -Math.PI / 4; // -45 degrees
        newExplosion.fragments.push(createFragment(
            enemy.x, enemy.y,
            FRAGMENT_BASE_SPEED * Math.cos(angle2 + Math.PI / 2) * 0.7, // Move perpendicular to line
            FRAGMENT_BASE_SPEED * Math.sin(angle2 + Math.PI / 2) * 0.7,
            lineLength,
            FRAGMENT_ROTATION_SPEED * (Math.random() > 0.5 ? 1 : -1),
            enemy.color, enemy.intensity, EXPLOSION_LIFETIME,
            false, angle2
        ));
    } else { // Default: radial burst of small lines
        const numFragments = 6;
        for (let i = 0; i < numFragments; i++) {
            const angle = (i / numFragments) * Math.PI * 2;
            newExplosion.fragments.push(createFragment(
                enemy.x, enemy.y,
                FRAGMENT_BASE_SPEED * Math.cos(angle), FRAGMENT_BASE_SPEED * Math.sin(angle),
                FRAGMENT_DEFAULT_LENGTH, FRAGMENT_ROTATION_SPEED * (Math.random() - 0.5) * 4, // Faster rotation for small bits
                enemy.color, enemy.intensity, EXPLOSION_LIFETIME,
                false, angle
            ));
        }
    }
    explosions.push(newExplosion);
}

function updateExplosions() {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const explosion = explosions[i];

        for (let j = explosion.fragments.length - 1; j >= 0; j--) {
            const frag = explosion.fragments[j];
            frag.x += frag.dx;
            frag.y += frag.dy;
            frag.rotation += frag.dRotation;
            frag.lifetime--;

            if (!frag.isBoxSide) { // Box sides maintain length, others shrink
                frag.currentLength = frag.initialLength * Math.max(0, (frag.lifetime / EXPLOSION_LIFETIME));
            }
            frag.currentIntensity = Math.max(1, Math.round(frag.initialIntensity * (frag.lifetime / EXPLOSION_LIFETIME)));


            if (frag.lifetime <= 0 || frag.currentLength <= 0) {
                explosion.fragments.splice(j, 1);
            }
        }

        if (explosion.fragments.length === 0) {
            explosions.splice(i, 1);
        }
    }
}

function checkCollisions() {
    // Projectile-Enemy collisions
    let projectileCollisionDebugLogged = false; // Flag to log only for the first P-E pair

    projectiles.forEach(p => {
        if (!p.active) return;
        enemies.forEach(e => {
            if (!e.active) return;

            // AABB collision detection for center-based positioning
            // Enemy coordinates represent centers, but projectile y is the top position
            const projectileLeft = p.x - p.width / 2;
            const projectileRight = p.x + p.width / 2;
            const projectileTop = p.y;
            const projectileBottom = p.y + p.height;

            const enemyLeft = e.x - e.width / 2;
            const enemyRight = e.x + e.width / 2;
            const enemyTop = e.y - e.height / 2;
            const enemyBottom = e.y + e.height / 2;

            if (!projectileCollisionDebugLogged) {
                console.log(`[CollisionDebug] Projectile (x:${p.x}, y:${p.y}, w:${p.width}, h:${p.height}) -> L:${projectileLeft.toFixed(2)}, R:${projectileRight.toFixed(2)}, T:${projectileTop.toFixed(2)}, B:${projectileBottom.toFixed(2)}`);
                console.log(`[CollisionDebug] Enemy (x:${e.x}, y:${e.y}, w:${e.width}, h:${e.height}) -> L:${enemyLeft.toFixed(2)}, R:${enemyRight.toFixed(2)}, T:${enemyTop.toFixed(2)}, B:${enemyBottom.toFixed(2)}`);
                console.log(`[CollisionDebug] Conditions: (pR > eL): ${projectileRight > enemyLeft}, (pL < eR): ${projectileLeft < enemyRight}, (pB > eT): ${projectileBottom > enemyTop}, (pT < eB): ${projectileTop < enemyBottom}`);
                projectileCollisionDebugLogged = true; // Set flag after logging once per frame
            }

            if (projectileRight > enemyLeft &&
                projectileLeft < enemyRight &&
                projectileBottom > enemyTop &&
                projectileTop < enemyBottom) {

                p.active = false;
                // e.active = false; // Enemy is hit - Replaced by spawnExplosion
                spawnExplosion(e); // Spawn explosion
                e.active = false; // Then mark enemy as inactive
                player.score += 10; // Increase score
                // console.log('Enemy hit! Score:', player.score);
            }
        });
    });

    // Player-Enemy collisions
    enemies.forEach(e => {
        if (!e.active) return;

        // AABB collision detection for center-based positioning
        const playerLeft = player.x - player.width / 2;
        const playerRight = player.x + player.width / 2;
        const playerTop = player.y - player.height / 2;
        const playerBottom = player.y + player.height / 2;

        const enemyLeft = e.x - e.width / 2;
        const enemyRight = e.x + e.width / 2;
        const enemyTop = e.y - e.height / 2;
        const enemyBottom = e.y + e.height / 2;

        if (playerRight > enemyLeft &&
            playerLeft < enemyRight &&
            playerBottom > enemyTop &&
            playerTop < enemyBottom) {

            // e.active = false; // Enemy is hit - Replaced by spawnExplosion
            spawnExplosion(e); // Spawn explosion
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

export function getExplosionsState() {
    let activeFragments = [];
    explosions.forEach(exp => {
        exp.fragments.forEach(frag => {
            // Make sure to pass a copy of the fragment for rendering
            activeFragments.push({ ...frag });
        });
    });
    return activeFragments;
}