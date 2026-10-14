export const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

export const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float r = length(uv);
  float ang = atan(uv.y, uv.x) + 2.4 * r - uTime * 0.22;
  vec2 p = r * 3.0 * vec2(cos(ang), sin(ang));
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    p += 0.55 * vec2(sin(p.y * 1.3 + uTime * 0.35 + fi * 1.7), cos(p.x * 1.1 - uTime * 0.30 + fi * 2.3));
  }
  float v = 0.5 + 0.5 * sin(p.x + p.y);
  float w = 0.5 + 0.5 * sin(p.x * 0.8 - p.y * 1.2);
  vec3 col = mix(uA, uB, smoothstep(0.25, 0.75, v));
  col = mix(col, uC, smoothstep(0.55, 0.95, w) * 0.85);
  col = floor(col * 7.0 + 0.5) / 7.0;
  col *= 1.0 - 0.45 * smoothstep(0.3, 1.1, r);
  gl_FragColor = vec4(col, 1.0);
}`;

/** Se dibuja a 1/4 de resolución y el CSS lo estira con image-rendering: pixelated. */
export const RENDER_SCALE = 0.25;

export interface SwirlHandle {
  start(): void;
  stop(): void;
  draw(time: number): void;
  destroy(): void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Devuelve null si WebGL no está disponible o el shader no compila (el llamador usa el fallback CSS). */
export function createSwirl(canvas: HTMLCanvasElement, onLost: () => void): SwirlHandle | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'uRes');
  const uTime = gl.getUniformLocation(prog, 'uTime');
  gl.uniform3f(gl.getUniformLocation(prog, 'uA'), 0.35, 0.07, 0.19); // bordó
  gl.uniform3f(gl.getUniformLocation(prog, 'uB'), 0.11, 0.1, 0.31); // índigo
  gl.uniform3f(gl.getUniformLocation(prog, 'uC'), 0.06, 0.44, 0.42); // verde azulado

  const t0 = performance.now();
  let raf = 0;
  let running = false;

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * RENDER_SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  const draw = (t: number) => {
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  const frame = () => {
    if (!running) return;
    draw((performance.now() - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  const onVisibility = () => {
    cancelAnimationFrame(raf);
    if (!document.hidden && running) raf = requestAnimationFrame(frame);
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
    handle.stop();
    onLost();
  };

  const handle: SwirlHandle = {
    start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    draw,
    destroy() {
      handle.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost);
    },
  };
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost);
  return handle;
}
