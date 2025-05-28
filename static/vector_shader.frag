precision mediump float;

varying vec4 vColor; // R, G, B, Alpha (base intensity for glow)
varying vec2 vP0_screen;
varying vec2 vP1_screen;
varying float vThickness_pixels;
varying float vScheduledDrawTime_FS; // Vector's scheduled absolute start time
varying float vDrawDuration_FS;      // Vector's own drawing duration

uniform float uGlowMultiplier;
uniform vec2 uResolution;
uniform float uPassEvaluationTime;     // Time at which the pass's state is evaluated
uniform float uIntraVectorDecayRate;   // Decay rate for intra-vector fading
uniform float uAntialiasPixelWidth;    // Pixel width for SDF anti-aliasing
uniform float uEndpointDwellTime;      // Additional time endpoints appear to stay bright (e.g., 0.05 seconds)

// SDF for a line segment with rounded caps
// p: current point (fragment coordinate)
// a: line start point
// b: line end point
// r: line radius (half thickness)
float sdLineSegment(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

void main(void) {
  vec2 fragCoord_corrected = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);

  float line_radius = vThickness_pixels * 0.5;
  
  // SDF distance: positive outside, negative inside, zero on surface
  float sdf_dist = sdLineSegment(fragCoord_corrected, vP0_screen, vP1_screen, line_radius);

  // Alpha from SDF (anti-aliased line)
  // Transitions from 1 (inside) to 0 (outside) over uAntialiasPixelWidth
  float line_alpha = 1.0 - smoothstep(0.0, uAntialiasPixelWidth, sdf_dist);

  if (line_alpha <= 0.0) {
    discard; // No contribution from this fragment
  }

  // Revised Temporal decay logic
  float temporal_decay_factor = 0.0;
  
  // time_since_vector_birth: How long ago this vector was scheduled to start drawing,
  // relative to the current pass's evaluation time (uPassEvaluationTime).
  // A positive value means it started in the past (relative to uPassEvaluationTime).
  // A negative value means it's scheduled to start after uPassEvaluationTime (should not happen with new uPassEvaluationTime logic if vector is part of the current pass).
  float time_since_vector_birth = uPassEvaluationTime - vScheduledDrawTime_FS;

  if (time_since_vector_birth < 0.0) {
      // This implies an issue or that the vector is somehow scheduled beyond the pass evaluation time.
      // For safety, discard. With the new logic, this should ideally not be hit for vectors within the pass.
      discard;
  }

  // Calculate normalized position of the current fragment along the line segment [0,1]
  vec2 line_vec = vP1_screen - vP0_screen;
  float line_len_sq = dot(line_vec, line_vec);
  float frag_progress_along_line = 0.0; // Normalized distance from P0 to fragment's projection on the line

  if (line_len_sq > 0.00001) { // Vector has a physical length
      vec2 frag_to_p0 = fragCoord_corrected - vP0_screen;
      frag_progress_along_line = clamp(dot(frag_to_p0, line_vec) / line_len_sq, 0.0, 1.0);
  }
  // For zero-length vectors, frag_progress_along_line remains 0.0. It's treated as a point at P0.

  if (vDrawDuration_FS <= 0.00001) { // Instantaneous vector (e.g., a point or zero duration line)
      // Its "age" is how long ago it appeared (time_since_vector_birth).
      float age = time_since_vector_birth;
      // Apply dwell time to points as well, making them linger longer.
      age = max(0.0, age - uEndpointDwellTime);
      temporal_decay_factor = exp(-age * uIntraVectorDecayRate);
  } else { // Vector has a draw duration, simulate beam travel
      // Calculate the time offset from the start of this vector's drawing
      // to when the beam head would illuminate this specific fragment.
      float time_beam_reaches_frag_offset = frag_progress_along_line * vDrawDuration_FS;

      // time_since_vector_birth is how long the vector *overall* has been drawing up to uPassEvaluationTime.
      if (time_since_vector_birth < time_beam_reaches_frag_offset) {
          // The beam head, which has been moving for `time_since_vector_birth` seconds since this vector started,
          // has not yet reached this fragment (which is at `time_beam_reaches_frag_offset` along the beam path).
          discard;
      }

      // If we are here, the beam has passed or is at this fragment by uPassEvaluationTime.
      // The "age" of this specific fragment's illumination is how long ago it was lit.
      float frag_illumination_age = time_since_vector_birth - time_beam_reaches_frag_offset;

      // Endpoint dwell effect:
      // Calculate proximity to endpoints. Factor is 1.0 at endpoints, 0.0 in the middle.
      // Effect is concentrated in the first 10% and last 10% of the vector's length.
      float endpoint_prox_start = 1.0 - smoothstep(0.0, 0.1, frag_progress_along_line);
      float endpoint_prox_end = smoothstep(0.9, 1.0, frag_progress_along_line);
      float at_endpoint_factor = max(endpoint_prox_start, endpoint_prox_end);

      // Reduce effective age at endpoints to make them linger (decay slower)
      frag_illumination_age = max(0.0, frag_illumination_age - at_endpoint_factor * uEndpointDwellTime);
      
      temporal_decay_factor = exp(-frag_illumination_age * uIntraVectorDecayRate);
  }
  
  temporal_decay_factor = clamp(temporal_decay_factor, 0.0, 1.0);

  // If decay is active and factor is effectively zero, discard.
  // Use a small epsilon to prevent issues with float precision if factor is extremely small but not exactly 0.
  if (temporal_decay_factor <= 0.001 && uIntraVectorDecayRate > 0.0) {
      discard;
  }

  // Combine factors
  // vColor.a is the base intensity from DVG program (intBright arrays)
  float final_alpha = line_alpha * temporal_decay_factor * vColor.a * uGlowMultiplier;
  final_alpha = clamp(final_alpha, 0.0, 1.0);

  gl_FragColor = vec4(vColor.rgb, final_alpha);
}