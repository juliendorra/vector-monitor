precision mediump float;

varying vec4 vColor; // R, G, B, Alpha (intensity for glow)
uniform float uGlowMultiplier;

void main(void) {
  float intensityFactor = vColor.a; // This comes from intBright arrays
  vec3 baseColor = vColor.rgb;

  // Calculate the alpha contribution for blending.
  // This alpha will control how much of the baseColor is added to the scene.
  float alphaContribution = intensityFactor * uGlowMultiplier;
  alphaContribution = clamp(alphaContribution, 0.0, 1.0); // Ensure alpha is in [0,1]

  // Output the baseColor directly. Its strength in the additive blend
  // will be controlled by alphaContribution.
  // With gl.blendFunc(gl.SRC_ALPHA, gl.ONE), this means:
  // FinalPixel.rgb = baseColor.rgb * alphaContribution + DestinationPixel.rgb * 1.0;
  gl_FragColor = vec4(baseColor, alphaContribution);
}