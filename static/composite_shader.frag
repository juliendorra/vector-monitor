precision mediump float;

uniform sampler2D uCompositeTexture; // The final texture to draw
varying vec2 vTexCoord;

void main() {
    gl_FragColor = texture2D(uCompositeTexture, vTexCoord);
}