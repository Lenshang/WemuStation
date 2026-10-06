// WemuStation built-in shaders (public domain).
// Simple single-pass GLSL effects usable from the RetroArch menu
// (Shaders -> Load) or auto-applied via a .glslp preset.

#version 100
precision mediump float;

varying vec2 v_texCoord;
uniform sampler2D u_texture;
uniform vec2 u_input_size;   // native game resolution

// CRT-style scanlines with slight aperture darkening
void main() {
    vec3 color = texture2D(u_texture, v_texCoord).rgb;
    float lines = u_input_size.y;
    // one scanline pair per native line
    float pos = v_texCoord.y * lines;
    float line_dark = 0.72 + 0.28 * abs(sin(pos * 3.14159));
    // subtle vertical aperture mask
    float px = v_texCoord.x * lines * 4.0 / 3.0;
    float mask = 0.92 + 0.08 * abs(sin(px * 3.14159));
    gl_FragColor = vec4(color * line_dark * mask, 1.0);
}
