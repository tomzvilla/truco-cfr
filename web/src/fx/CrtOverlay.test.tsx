import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CrtOverlay } from './CrtOverlay';

describe('CrtOverlay', () => {
  // que no capture clicks (pointer-events: none) vive en el CSS y jsdom corre con css: false
  it('solo se dibuja si está encendido y es decorativo (aria-hidden)', () => {
    const { container, rerender } = render(<CrtOverlay on={false} />);
    expect(container.firstChild).toBeNull();
    rerender(<CrtOverlay on />);
    expect(container.firstChild).toHaveClass('crt');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
