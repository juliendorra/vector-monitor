attribute vec2 aVertexPosition;
attribute vec4 aVertexColor; // R, G, B, Alpha (used for intensity/glow control)

uniform vec2 uResolution;

varying vec4 vColor;

void main(void) {
  // Convert position from pixel space to clip space
  vec2 zeroToOne = aVertexPosition / uResolution;
  vec2 zeroToTwo = zeroToOne * 2.0;
  vec2 clipSpace = zeroToTwo - 1.0;

  // Flip Y coordinate because WebGL's origin is bottom-left, while canvas 2D is top-left
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  vColor = aVertexColor;
}