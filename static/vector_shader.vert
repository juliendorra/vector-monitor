attribute vec2 aP0; // Start point of the line segment
attribute vec2 aP1; // End point of the line segment
attribute vec4 aColorIntensity; // R, G, B, Alpha (used for base intensity/glow control)
attribute float aThickness; // Thickness of the line segment
attribute vec2 aCornerOffset; // To identify the corner: x selects P0 (-1) or P1 (1), y selects side (-1 or 1)
attribute float aScheduledDrawTime; // Absolute time this vector is scheduled to start drawing
attribute float aDrawDuration;      // How long it takes to draw this vector

uniform mediump vec2 uResolution;
uniform float uQuadExpansionMargin; // Pixels to expand quad for SDF rendering

varying vec4 vColor;
varying vec2 vP0_screen; // Start point in screen pixels (top-down)
varying vec2 vP1_screen; // End point in screen pixels (top-down)
varying float vThickness_pixels; // Original thickness
varying float vScheduledDrawTime_FS; // Scheduled start time for fragment shader
varying float vDrawDuration_FS;      // Draw duration for fragment shader

void main(void) {
  vec2 p0 = aP0;
  vec2 p1 = aP1;

  vP0_screen = p0;
  vP1_screen = p1;
  vThickness_pixels = aThickness;
  vScheduledDrawTime_FS = aScheduledDrawTime;
  vDrawDuration_FS = aDrawDuration;
  vColor = aColorIntensity; // Pass color and base intensity to fragment shader

  vec2 dir = p1 - p0;
  float len = length(dir);

  vec2 clipSpacePos;

  if (len < 0.0001) { // Handle zero-length lines (degenerate to a point or tiny quad)
    // Create a small quad around P0, expanded for SDF
    float effectiveRadius = aThickness * 0.5 + uQuadExpansionMargin;
    vec2 offset = vec2(aCornerOffset.x * effectiveRadius, aCornerOffset.y * effectiveRadius);
    vec2 finalPos = p0 + offset;

    vec2 zeroToOne = finalPos / uResolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    clipSpacePos = zeroToTwo - 1.0;
  } else {
    dir = dir / len; // Normalize
    vec2 normal = vec2(-dir.y, dir.x); // Perpendicular normal

    // Determine the base point for this vertex (either P0 or P1)
    vec2 basePoint = (aCornerOffset.x < 0.0) ? p0 : p1;

    // Extend basePoint along the line direction for cap rendering space
    vec2 alongDirOffset = (aCornerOffset.x < 0.0 ? -dir : dir) * uQuadExpansionMargin;
    basePoint += alongDirOffset; // Apply the extension

    // Calculate the offset from the (extended) basePoint along the normal
    vec2 offset = normal * (aThickness * 0.5 + uQuadExpansionMargin) * aCornerOffset.y;
    

    vec2 finalPos = basePoint + offset;

    // Convert final calculated position from pixel space to clip space
    vec2 zeroToOne = finalPos / uResolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    clipSpacePos = zeroToTwo - 1.0;
  }

  // Flip Y coordinate because WebGL's origin is bottom-left
  gl_Position = vec4(clipSpacePos * vec2(1.0, -1.0), 0.0, 1.0);
}