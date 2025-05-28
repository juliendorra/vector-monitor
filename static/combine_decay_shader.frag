precision mediump float;

uniform sampler2D uPreviousStateTex; // Texture of the screen state from the previous frame
uniform sampler2D uCurrentLinesTex;  // Texture with only the newly drawn lines for this frame

uniform float uGlobalDecay;          // Global decay rate (0.0 to 1.0)
uniform vec3 uDifferentialDecayRates; // Per-channel decay rate multipliers (R, G, B)

varying vec2 vTexCoord;              // Texture coordinate from vertex shader

void main() {
    vec3 prevFrameColor = texture2D(uPreviousStateTex, vTexCoord).rgb;
    vec3 currentLinesColor = texture2D(uCurrentLinesTex, vTexCoord).rgb; // Lines are drawn with intensity in RGB, alpha for blending strength

    // Apply differential decay to the previous frame's color
    // Decay factor: (1.0 - uGlobalDecay * channel_specific_rate)
    // A higher rate means faster decay for that channel.
    vec3 decayFactors = vec3(1.0) - uGlobalDecay * uDifferentialDecayRates;
    vec3 decayedPrevColor = prevFrameColor * clamp(decayFactors, 0.0, 1.0);

    // Add the current frame's lines to the decayed previous frame
    // Lines are drawn additively, so their RGB values represent their brightness contribution.
    vec3 finalColor = decayedPrevColor + currentLinesColor;

    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0); // Output full alpha
}