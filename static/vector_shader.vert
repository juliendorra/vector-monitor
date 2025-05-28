attribute vec2 aP0; // Start point of the line segment
attribute vec2 aP1; // End point of the line segment
attribute vec4 aColorIntensity; // R, G, B, Alpha (used for base intensity/glow control)
attribute float aThickness; // Thickness of the line segment
attribute vec2 aCornerOffset; // To identify the corner: x selects P0 (-1) or P1 (1), y selects side (-1 or 1)

uniform vec2 uResolution;
// uGlowMultiplier is now primarily used by the fragment shader, but could be used here if needed.

varying vec4 vColor;

void main(void) {
  vec2 p0 = aP0;
  vec2 p1 = aP1;

  vec2 dir = p1 - p0;
  float len = length(dir);

  vec2 clipSpacePos;

  if (len < 0.0001) { // Handle zero-length lines (degenerate to a point or tiny quad)
    // Simplified: just output P0. A more robust solution might create a small quad around P0.
    vec2 zeroToOne = p0 / uResolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    clipSpacePos = zeroToTwo - 1.0;
  } else {
    dir = dir / len; // Normalize
    vec2 normal = vec2(-dir.y, dir.x); // Perpendicular normal

    // Determine the base point for this vertex (either P0 or P1)
    vec2 basePoint = (aCornerOffset.x < 0.0) ? p0 : p1;

    // Calculate the offset from the basePoint along the normal
    vec2 offset = normal * aThickness * 0.5 * aCornerOffset.y;
    
    vec2 finalPos = basePoint + offset;

    // Convert final calculated position from pixel space to clip space
    vec2 zeroToOne = finalPos / uResolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    clipSpacePos = zeroToTwo - 1.0;
  }

  // Flip Y coordinate because WebGL's origin is bottom-left
  gl_Position = vec4(clipSpacePos * vec2(1.0, -1.0), 0.0, 1.0);
  vColor = aColorIntensity; // Pass color and base intensity to fragment shader
}