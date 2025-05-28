precision mediump float;

uniform float uDecayAmount; // Alpha for the black overlay (0.0 to 1.0)

void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, uDecayAmount);
}