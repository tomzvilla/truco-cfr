import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { FRAG, createSwirl } from './swirl';
import { SwirlBackground } from './SwirlBackground';

function fakeGl() {
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLE_STRIP: 8,
    createShader: () => ({}), shaderSource() {}, compileShader() {}, getShaderParameter: () => true, deleteShader() {},
    createProgram: () => ({}), attachShader() {}, linkProgram() {}, getProgramParameter: () => true, useProgram() {},
    createBuffer: () => ({}), bindBuffer() {}, bufferData() {}, getAttribLocation: () => 0,
    enableVertexAttribArray() {}, vertexAttribPointer() {}, getUniformLocation: () => ({}),
    uniform1f() {}, uniform2f() {}, uniform3f() {}, viewport() {}, drawArrays: vi.fn(),
  };
  return gl as unknown as WebGLRenderingContext & { drawArrays: ReturnType<typeof vi.fn> };
}

describe('shader', () => {
  it('es liviano y no usa texturas', () => {
    expect(FRAG.length).toBeLessThan(2000);
    expect(FRAG).toContain('gl_FragColor');
    expect(FRAG).not.toMatch(/texture2D|sampler2D/);
  });
});

describe('createSwirl', () => {
  it('devuelve null si no hay WebGL', () => {
    expect(createSwirl(document.createElement('canvas'), vi.fn())).toBeNull();
  });
  it('devuelve null si el shader no compila', () => {
    const canvas = document.createElement('canvas');
    canvas.getContext = (() => ({
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, createShader: () => null, createProgram: () => ({}),
    })) as never;
    expect(createSwirl(canvas, vi.fn())).toBeNull();
  });
  it('dibuja y avisa cuando se pierde el contexto', () => {
    const canvas = document.createElement('canvas');
    const gl = fakeGl();
    canvas.getContext = (() => gl) as never;
    const onLost = vi.fn();
    const handle = createSwirl(canvas, onLost)!;
    expect(handle).not.toBeNull();
    handle.draw(1);
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(onLost).toHaveBeenCalledTimes(1);
    handle.destroy();
  });
});

describe('SwirlBackground', () => {
  it('sin WebGL cae al fallback CSS (sin canvas)', () => {
    const { container } = render(<SwirlBackground />);
    const root = container.querySelector('.swirl')!;
    expect(root).toHaveAttribute('data-fallback', 'true');
    expect(root.querySelector('canvas')).toBeNull();
  });
});
