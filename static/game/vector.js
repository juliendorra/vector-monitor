// static/vector.js

/**
 * Generates DVG command for absolute positioning.
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} scale - Scale factor (defaulting to 2 for 1:1 mapping with divisor 4).
 * @returns {string} DVG LABS command.
 */
function labs(x, y, scale = 2) { // Default scale to 2
    return `LABS ${Math.round(x)} ${Math.round(y)} ${scale}`;
}

/**
 * Generates DVG command for drawing a vector.
 * @param {number} dx - Change in X.
 * @param {number} dy - Change in Y.
 * @param {number} divisor - Divisor for coordinates (defaulting to 4 for 1:1 mapping with scale 2).
 * @param {number} intensity - Intensity of the beam (0-15).
 * @returns {string} DVG VCTR command.
 */
function vctr(dx, dy, divisor = 4, intensity = 8) { // Default divisor to 4
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
    // Player points towards positive Y (screen top). centerY is the center.
    // Tip: (centerX, centerY + size * 2/3)
    // Left base: (centerX - size / 2, centerY - size / 3)
    // Right base: (centerX + size / 2, centerY - size / 3)
    const tipYOffset = size * 2 / 3;
    const baseYOffset = -size * 1 / 3; // Relative to centerY
    const halfWidth = size / 2;

    const actualTipY = centerY + tipYOffset;
    const actualBaseY = centerY + baseYOffset;

    commands.push(color(colorIndex));
    // Start at left base
    commands.push(labs(centerX - halfWidth, actualBaseY, 2));
    // Draw base to right base
    commands.push(vctr(size, 0, 4, intensity));
    // Draw from right base to tip
    commands.push(vctr(-halfWidth, tipYOffset - baseYOffset, 4, intensity)); // dx = -halfWidth, dy = (centerY + tipYOffset) - (centerY + baseYOffset) = tipYOffset - baseYOffset
    // Draw from tip to left base
    commands.push(vctr(-halfWidth, baseYOffset - tipYOffset, 4, intensity)); // dx = -halfWidth, dy = (centerY + baseYOffset) - (centerY + tipYOffset) = baseYOffset - tipYOffset

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
    // x, y is the starting point (base) of the projectile line.
    // It shoots "up" (positive Y).
    const commands = [];
    commands.push(color(colorIndex));
    commands.push(labs(x, y, 2)); // Start at base of projectile
    commands.push(vctr(0, length, 4, intensity)); // Draw line upwards
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
    // Start at top-left: (centerX - halfSize, centerY + halfSize) for positive Y up
    // For consistency, let's use a common starting point like bottom-left
    // Start at bottom-left: (centerX - halfSize, centerY - halfSize)
    commands.push(labs(centerX - halfSize, centerY - halfSize, 2));
    commands.push(vctr(size, 0, 4, intensity));      // Bottom edge (to bottom-right)
    commands.push(vctr(0, size, 4, intensity));      // Right edge (to top-right)
    commands.push(vctr(-size, 0, 4, intensity));     // Top edge (to top-left)
    commands.push(vctr(0, -size, 4, intensity));     // Left edge (back to bottom-left)
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
    // Draw '\' (from top-left to bottom-right)
    commands.push(labs(centerX - halfSize, centerY + halfSize, 2)); // Start top-left
    commands.push(vctr(size, -size, 4, intensity)); // Draw to bottom-right

    // Draw '/' (from bottom-left to top-right)
    commands.push(labs(centerX - halfSize, centerY - halfSize, 2)); // Start bottom-left
    commands.push(vctr(size, size, 4, intensity));    // Draw to top-right
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
            commands.push(labs(currentX, y, 2));
            commands.push(vctr(0, height, 4, intensity));
        }
    } else { // Horizontal
        for (let currentY = y; currentY <= y + height; currentY += spacing) {
            commands.push(labs(x, currentY, 2));
            commands.push(vctr(width, 0, 4, intensity));
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
    // Assuming x,y is bottom-left corner of the text placeholder.
    commands.push(color(colorIndex));
    commands.push(labs(x, y, 2));
    commands.push(vctr(size, 0, 4, intensity));    // Bottom edge
    commands.push(vctr(0, size, 4, intensity));    // Right edge
    commands.push(vctr(-size, 0, 4, intensity));   // Top edge
    commands.push(vctr(0, -size, 4, intensity));   // Left edge
    return commands;
}
