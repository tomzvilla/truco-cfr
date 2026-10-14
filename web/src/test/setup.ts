import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetSettings } from '../settings';
import { mockMatchMedia } from './helpers';

// jsdom no implementa WebGL: getContext devuelve null limpio, sin ruido en consola.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  mockMatchMedia(false);
  window.localStorage.clear();
  resetSettings();
});
