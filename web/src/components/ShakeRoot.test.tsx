import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { ShakeRoot } from './ShakeRoot';

afterEach(() => vi.useRealTimers());

describe('ShakeRoot', () => {
  it('tiembla 450 ms cuando sube el trigger', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ShakeRoot trigger={0}>x</ShakeRoot>);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute('data-shaking', 'false');
    rerender(<ShakeRoot trigger={1}>x</ShakeRoot>);
    expect(root).toHaveAttribute('data-shaking', 'true');
    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(root).toHaveAttribute('data-shaking', 'false');
  });
  it('con animaciones reducidas nunca tiembla', () => {
    mockMatchMedia(true);
    const { container, rerender } = render(<ShakeRoot trigger={0}>x</ShakeRoot>);
    rerender(<ShakeRoot trigger={1}>x</ShakeRoot>);
    expect(container.firstElementChild).toHaveAttribute('data-shaking', 'false');
  });
});
