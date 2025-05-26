// static/vector.js

import { GAME_WIDTH, GAME_HEIGHT } from './game.js';

const DVG_SCALE_INDEX_1X = 2; // Assuming scalers[2] is 1.0x

/**
 * Converts game coordinates (top-left origin, Y down) to DVG coordinates (center origin, Y up).
 * @param {number} gameX - Game X coordinate.
 * @param {number} gameY - Game Y coordinate.
 * @returns {{x: number, y: number}} DVG coordinates.
 */
function toDVGCoords(gameX, gameY) {
    return {
        x: Math.round(gameX - GAME_WIDTH / 2),
        y: Math.round(gameY - GAME_HEIGHT / 2) // Y increases downwards from center
    };
}

/**
 * Generates DVG command for absolute positioning.
 * @param {number} x - X coordinate (DVG space).
 * @param {number} y - Y coordinate (DVG space).
 * @param {number} scaleIndex - Scale factor index (0-7, see dvgsim.js scalers array).
 * @returns {string} DVG LABS command.
 */
function labs(x, y, scaleIndex = DVG_SCALE_INDEX_1X) {
    return `LABS ${Math.round(x)} ${Math.round(y)} ${scaleIndex}`;
}

/**
 * Generates DVG command for drawing a vector.
 * @param {number} dx - Change in X (DVG space).
 * @param {number} dy - Change in Y (DVG space).
 * @param {number} divisor - Divisor for coordinates (1, 2, 4, ..., 512).
 * @param {number} intensity - Intensity of the beam (0-15).
 * @returns {string} DVG VCTR command.
 */
function vctr(dx, dy, divisor = 1, intensity = 8) {
    return `VCTR ${Math.round(dx)} ${Math.round(dy)} ${divisor} ${intensity}`;
}

/**
 * Generates DVG command for changing color.
 * @param {number} colorIndex - Index of the color (see dvgsim.js colors array).
 * @returns {string} DVG COLOR command.
 */
function color(colorIndex) {
    return `COLOR ${colorIndex}`;
}

/**
 * Generates DVG commands to draw the player's ship (a simple triangle).
 * Assumes ship points upwards in game coordinates.
 * @param {number} gameCenterX - Center X coordinate of the ship (game space).
 * @param {number} gameCenterY - Center Y coordinate of the ship (game space).
 * @param {number} size - Size of the ship (game units).
 * @param {number} colorIndex - Color index for the ship.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawPlayer(gameCenterX, gameCenterY, size, colorIndex, intensity) {
    const commands = [];

    // Game coordinates for the triangle points
    const gameTip = { x: gameCenterX, y: gameCenterY - (size * 2 / 3) };
    const gameLeftBase = { x: gameCenterX - size / 2, y: gameCenterY + size / 3 };
    const gameRightBase = { x: gameCenterX + size / 2, y: gameCenterY + size / 3 };

    // Convert to DVG coordinates
    const dvgTip = toDVGCoords(gameTip.x, gameTip.y);
    const dvgLeftBase = toDVGCoords(gameLeftBase.x, gameLeftBase.y);
    const dvgRightBase = toDVGCoords(gameRightBase.x, gameRightBase.y);

    commands.push(color(colorIndex));
    commands.push(labs(dvgLeftBase.x, dvgLeftBase.y, DVG_SCALE_INDEX_1X));
    commands.push(vctr(dvgRightBase.x - dvgLeftBase.x, dvgRightBase.y - dvgLeftBase.y, 1, intensity)); // Draw base
    commands.push(vctr(dvgTip.x - dvgRightBase.x, dvgTip.y - dvgRightBase.y, 1, intensity));       // Draw right side to tip
    commands.push(vctr(dvgLeftBase.x - dvgTip.x, dvgLeftBase.y - dvgTip.y, 1, intensity));       // Draw left side back to left base

    return commands;
}

/**
 * Generates DVG commands for a simple projectile (a vertical line).
 * @param {number} gameX - X coordinate of the projectile's center (game space).
 * @param {number} gameY - Y coordinate of the projectile's top (game space).
 * @param {number} length - Length of the projectile line (game units, positive means downwards in game space).
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawProjectile(gameX, gameY, length, colorIndex, intensity) {
    const commands = [];
    const dvgPos = toDVGCoords(gameX, gameY);

    commands.push(color(colorIndex));
    commands.push(labs(dvgPos.x, dvgPos.y, DVG_SCALE_INDEX_1X));
    // Game projectile line is from (gameX, gameY) to (gameX, gameY + length)
    // With new toDVGCoords, dy_dvg = ((gameY + length) - GAME_HEIGHT/2) - (gameY - GAME_HEIGHT/2) = length
    commands.push(vctr(0, length, 1, intensity));
    return commands;
}

/**
 * Generates DVG commands for a simple square enemy.
 * @param {number} gameCenterX - Center X coordinate of the enemy (game space).
 * @param {number} gameCenterY - Center Y coordinate of the enemy (game space).
 * @param {number} size - Size of the enemy square (game units).
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawEnemySquare(gameCenterX, gameCenterY, size, colorIndex, intensity) {
    const commands = [];
    const halfSize = size / 2;

    // Game coordinates for the square corners
    const gameTL = { x: gameCenterX - halfSize, y: gameCenterY - halfSize }; // Top-Left
    const gameTR = { x: gameCenterX + halfSize, y: gameCenterY - halfSize }; // Top-Right
    const gameBR = { x: gameCenterX + halfSize, y: gameCenterY + halfSize }; // Bottom-Right
    const gameBL = { x: gameCenterX - halfSize, y: gameCenterY + halfSize }; // Bottom-Left

    // Convert to DVG coordinates
    const dvgTL = toDVGCoords(gameTL.x, gameTL.y);
    const dvgTR = toDVGCoords(gameTR.x, gameTR.y);
    const dvgBR = toDVGCoords(gameBR.x, gameBR.y);
    const dvgBL = toDVGCoords(gameBL.x, gameBL.y);

    commands.push(color(colorIndex));
    commands.push(labs(dvgTL.x, dvgTL.y, DVG_SCALE_INDEX_1X));
    commands.push(vctr(dvgTR.x - dvgTL.x, dvgTR.y - dvgTL.y, 1, intensity));      // Top edge (TL to TR)
    commands.push(vctr(dvgBR.x - dvgTR.x, dvgBR.y - dvgTR.y, 1, intensity));      // Right edge (TR to BR)
    commands.push(vctr(dvgBL.x - dvgBR.x, dvgBL.y - dvgBR.y, 1, intensity));     // Bottom edge (BR to BL)
    commands.push(vctr(dvgTL.x - dvgBL.x, dvgTL.y - dvgBL.y, 1, intensity));     // Left edge (BL to TL)
    return commands;
}

/**
 * Generates DVG commands for a simple X-shaped enemy.
 * @param {number} gameCenterX - Center X coordinate of the enemy (game space).
 * @param {number} gameCenterY - Center Y coordinate of the enemy (game space).
 * @param {number} size - Size of the enemy (length of one arm of the X from center, game units).
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawEnemyX(gameCenterX, gameCenterY, size, colorIndex, intensity) {
    const commands = [];
    const halfSize = size / 2; // halfSize is used as offset from center to corners of bounding box

    // Game coordinates for the endpoints of the two lines of the X
    // Line 1: Top-left to Bottom-right
    const gameL1Start = { x: gameCenterX - halfSize, y: gameCenterY - halfSize };
    const gameL1End = { x: gameCenterX + halfSize, y: gameCenterY + halfSize };
    // Line 2: Bottom-left to Top-right
    const gameL2Start = { x: gameCenterX - halfSize, y: gameCenterY + halfSize };
    const gameL2End = { x: gameCenterX + halfSize, y: gameCenterY - halfSize };

    // Convert to DVG coordinates
    const dvgL1Start = toDVGCoords(gameL1Start.x, gameL1Start.y);
    const dvgL1End = toDVGCoords(gameL1End.x, gameL1End.y);
    const dvgL2Start = toDVGCoords(gameL2Start.x, gameL2Start.y);
    const dvgL2End = toDVGCoords(gameL2End.x, gameL2End.y);

    commands.push(color(colorIndex));
    // Draw line 1 (\)
    commands.push(labs(dvgL1Start.x, dvgL1Start.y, DVG_SCALE_INDEX_1X));
    commands.push(vctr(dvgL1End.x - dvgL1Start.x, dvgL1End.y - dvgL1Start.y, 1, intensity));
    // Draw line 2 (/)
    commands.push(labs(dvgL2Start.x, dvgL2Start.y, DVG_SCALE_INDEX_1X));
    commands.push(vctr(dvgL2End.x - dvgL2Start.x, dvgL2End.y - dvgL2Start.y, 1, intensity));
    return commands;
}

/**
 * Generates DVG commands for hatching effect within a square area.
 * (Coordinates and dimensions are assumed to be in game space)
 * @param {number} gameX - Top-left X of the hatching area (game space).
 * @param {number} gameY - Top-left Y of the hatching area (game space).
 * @param {number} width - Width of the area (game units).
 * @param {number} height - Height of the area (game units).
 * @param {number} spacing - Spacing between hatch lines (game units).
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @param {boolean} isVertical - True for vertical lines, false for horizontal.
 * @returns {string[]} Array of DVG commands.
 */
export function drawHatch(gameX, gameY, width, height, spacing, colorIndex, intensity, isVertical = true) {
    const commands = [];
    commands.push(color(colorIndex));

    if (isVertical) {
        for (let currentX = gameX; currentX <= gameX + width; currentX += spacing) {
            const dvgLineStart = toDVGCoords(currentX, gameY);
            commands.push(labs(dvgLineStart.x, dvgLineStart.y, DVG_SCALE_INDEX_1X));
            // Vertical line of 'height' downwards in game space is 'height' downwards in DVG space (dy = height)
            commands.push(vctr(0, height, 1, intensity));
        }
    } else { // Horizontal
        for (let currentY = gameY; currentY <= gameY + height; currentY += spacing) {
            const dvgLineStart = toDVGCoords(gameX, currentY);
            commands.push(labs(dvgLineStart.x, dvgLineStart.y, DVG_SCALE_INDEX_1X));
            // Horizontal line of 'width' rightwards in game space is 'width' rightwards in DVG space
            commands.push(vctr(width, 0, 1, intensity));
        }
    }
    return commands;
}

// Placeholder for text drawing - this is complex
// For now, it draws a small square marker in game space.
export function drawText(text, gameX, gameY, size, colorIndex, intensity) {
    const commands = [];
    // Actual text rendering requires a font definition (set of vector paths for each char)
    // For now, let's draw a small square as a placeholder for where text would be.
    // Using drawEnemySquare for this, centered at gameX, gameY.
    commands.push(...drawEnemySquare(gameX, gameY, size, colorIndex, intensity));
    return commands;
}