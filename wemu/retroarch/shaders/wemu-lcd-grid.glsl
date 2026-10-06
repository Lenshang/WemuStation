// WemuStation built-in shaders (public domain).
// Handheld-style LCD grid: dark pixel gaps like an original Game Boy screen.

#version 100
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_input_size;

void main() {
    vec3 color = texture2D(u_texture, v_texCoord).rgb;
    float gx = fract(v_texCoord.x * u_input_size.x);
    float gy = fract(v_texCoord.y * u_input_size.y);
    float gapx = smoothstep(0.0, 0.08, gx) * (1.0 - smoothstep(0.92, 1.0, gx));
    float gapy = smoothstep(0.0, 0.08, gy) * (1.0 - smoothstep(0.92, 1.0, gy));
    float grid = 0.55 + 0.45 * min(gapx, gapy);
    gl_FragColor = vec4(color * grid, 1.0);
}
