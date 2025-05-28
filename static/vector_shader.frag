precision mediump float;

varying vec4 vColor; // R, G, B, Alpha (intensity for glow)

void main(void) {
  float intensityFactor = vColor.a; // This comes from intBright arrays
  vec3 baseColor = vColor.rgb;

  vec3 finalColor = baseColor * intensityFactor;

  // Alpha also based on brightness for additive blending
  gl_FragColor = vec4(finalColor, intensityFactor);
}