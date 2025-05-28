attribute vec2 aPosition;

void main() {
    // Use aPosition directly as clip space coordinates for a fullscreen quad
    // covering -1 to 1 in X and Y.
    gl_Position = vec4(aPosition, 0.0, 1.0);
}