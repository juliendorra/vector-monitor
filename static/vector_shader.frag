precision mediump float;

varying vec4 vColor; // R, G, B, Alpha (intensity for glow)
uniform float uGlowMultiplier;

void main(void) {
  float intensityFactor = vColor.a; // This comes from intBright arrays
  vec3 baseColor = vColor.rgb;

  float finalIntensity = intensityFactor * uGlowMultiplier;
  finalIntensity = clamp(finalIntensity, 0.0, 1.0); // Ensure alpha is in [0,1]

  vec3 finalColor = baseColor * finalIntensity;

  // Alpha also based on brightness for additive blending
  gl_FragColor = vec4(finalColor, finalIntensity);
}