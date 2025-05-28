attribute vec2 aPosition; // Fullscreen quad vertex positions (-1 to 1)
varying vec2 vTexCoord;   // Texture coordinates (0 to 1)

void main() {
    // Use aPosition directly as clip space coordinates for a fullscreen quad
    // covering -1 to 1 in X and Y.
    gl_Position = vec4(aPosition, 0.0, 1.0);

    // Convert vertex position to texture coordinate
    // Quad vertices are (-1,-1), (1,-1), (-1,1), (1,1) for aPosition
    // Tex coords should be (0,0), (1,0), (0,1), (1,1)
    vTexCoord = aPosition * 0.5 + 0.5;
}