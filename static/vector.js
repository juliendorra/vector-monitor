// static/vector.js

/**
 * Generates DVG command for absolute positioning.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} scale - Scale factor (0-7, see dvgsim.js scalers array).
 * @returns {string} DVG LABS command.
 */
function labs(x, y, scale = 1) {
    return `LABS ${Math.round(x)} ${Math.round(y)} ${scale}`;
}

/**
 * Generates DVG command for drawing a vector.
 * @param {number} dx - Change in X.
 * @param {number} dy - Change in Y.
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
 * Assumes ship points upwards. Rotation is handled by transforming points before calling.
 * @param {number} centerX - Center X coordinate of the ship.
 * @param {number} centerY - Center Y coordinate of the ship.
 * @param {number} size - Size of the ship.
 * @param {number} colorIndex - Color index for the ship.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawPlayer(centerX, centerY, size, colorIndex, intensity) {
    const commands = [];
    // Triangle points:
    // Tip: (centerX, centerY - size * 2/3)
    // Left base: (centerX - size / 2, centerY + size / 3)
    // Right base: (centerX + size / 2, centerY + size / 3)

    const tipY = centerY - (size * 2 / 3);
    const baseY = centerY + (size / 3);
    const halfWidth = size / 2;

    commands.push(color(colorIndex));
    commands.push(labs(centerX - halfWidth, baseY)); // Move to left base
    commands.push(vctr(halfWidth * 2, 0, 1, intensity)); // Draw base (to right base)
    commands.push(vctr(-halfWidth, -(size), 1, intensity));    // Draw right side (to tip)
    commands.push(vctr(-halfWidth, size, 1, intensity));    // Draw left side (back to left base)

    return commands;
}

/**
 * Generates DVG commands for a simple projectile (a vertical line).
 * @param {number} x - X coordinate of the projectile's center.
 * @param {number} y - Y coordinate of the projectile's top.
 * @param {number} length - Length of the projectile line.
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawProjectile(x, y, length, colorIndex, intensity) {
    const commands = [];
    commands.push(color(colorIndex));
    commands.push(labs(x, y));
    commands.push(vctr(0, length, 1, intensity));
    return commands;
}

/**
 * Generates DVG commands for a simple square enemy.
 * @param {number} centerX - Center X coordinate of the enemy.
 * @param {number} centerY - Center Y coordinate of the enemy.
 * @param {number} size - Size of the enemy square.
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawEnemySquare(centerX, centerY, size, colorIndex, intensity) {
    const commands = [];
    const halfSize = size / 2;

    commands.push(color(colorIndex));
    // Start at top-left
    commands.push(labs(centerX - halfSize, centerY - halfSize));
    commands.push(vctr(size, 0, 1, intensity));      // Top edge
    commands.push(vctr(0, size, 1, intensity));      // Right edge
    commands.push(vctr(-size, 0, 1, intensity));     // Bottom edge
    commands.push(vctr(0, -size, 1, intensity));     // Left edge (back to start)
    return commands;
}

/**
 * Generates DVG commands for a simple X-shaped enemy.
 * @param {number} centerX - Center X coordinate of the enemy.
 * @param {number} centerY - Center Y coordinate of the enemy.
 * @param {number} size - Size of the enemy (length of one arm of the X from center).
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @returns {string[]} Array of DVG commands.
 */
export function drawEnemyX(centerX, centerY, size, colorIndex, intensity) {
    const commands = [];
    const halfSize = Math.round(size / 2); // Or use full size for arm length

    commands.push(color(colorIndex));
    // Draw ''
    commands.push(labs(centerX - halfSize, centerY - halfSize));
    commands.push(vctr(size, size, 1, intensity));
    // Draw '/'
    commands.push(labs(centerX - halfSize, centerY + halfSize));
    commands.push(vctr(size, -size, 1, intensity));
    return commands;
}

/**
 * Generates DVG commands for hatching effect within a square area.
 * @param {number} x - Top-left X of the hatching area.
 * @param {number} y - Top-left Y of the hatching area.
 * @param {number} width - Width of the area.
 * @param {number} height - Height of the area.
 * @param {number} spacing - Spacing between hatch lines.
 * @param {number} colorIndex - Color index.
 * @param {number} intensity - Line intensity.
 * @param {boolean} isVertical - True for vertical lines, false for horizontal.
 * @returns {string[]} Array of DVG commands.
 */
export function drawHatch(x, y, width, height, spacing, colorIndex, intensity, isVertical = true) {
    const commands = [];
    commands.push(color(colorIndex));

    if (isVertical) {
        for (let currentX = x; currentX <= x + width; currentX += spacing) {
            commands.push(labs(currentX, y));
            commands.push(vctr(0, height, 1, intensity));
        }
    } else { // Horizontal
        for (let currentY = y; currentY <= y + height; currentY += spacing) {
            commands.push(labs(x, currentY));
            commands.push(vctr(width, 0, 1, intensity));
        }
    }
    return commands;
}

// Placeholder for text drawing - this is complex
// For now, it does nothing or draws a simple marker.
export function drawText(text, x, y, size, colorIndex, intensity) {
    const commands = [];
    // Actual text rendering requires a font definition (set of vector paths for each char)
    // For now, let's draw a small square as a placeholder for where text would be.
    commands.push(color(colorIndex));
    commands.push(labs(x, y));
    commands.push(vctr(size, 0, 1, intensity));
    commands.push(vctr(0, size, 1, intensity));
    commands.push(vctr(-size, 0, 1, intensity));
    commands.push(vctr(0, -size, 1, intensity));
    return commands;
}
