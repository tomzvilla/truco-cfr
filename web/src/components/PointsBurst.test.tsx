import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { PointsBurst } from './PointsBurst';

afterEach(() => vi.useRealTimers());

describe('PointsBurst', () => {
  it('con delta 0 no dibuja nada', () => {
    const { container } = render(<PointsBurst delta={0} burstKey={0} />);
    expect(container.firstChild).toBeNull();
  });
  it('con delta 3 muestra +3 y 18 partículas', () => {
    const { container } = render(<PointsBurst delta={3} burstKey={1} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(container.querySelectorAll('.burst__p')).toHaveLength(18);
  });
  it('con animaciones reducidas queda el +3 pero sin partículas', () => {
    mockMatchMedia(true);
    const { container } = render(<PointsBurst delta={3} burstKey={1} />);
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(container.querySelectorAll('.burst__p')).toHaveLength(0);
  });
  it('el +N se quita solo a los 900 ms (también con animaciones reducidas, donde el CSS no lo anima)', () => {
    vi.useFakeTimers();
    mockMatchMedia(true);
    const { container } = render(<PointsBurst delta={2} burstKey={1} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(screen.getByText('+2')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('+2')).toBeNull();
    expect(container.firstChild).toBeNull();
  });
  it('una nueva suma (otro burstKey) vuelve a mostrar el +N', () => {
    vi.useFakeTimers();
    const { rerender } = render(<PointsBurst delta={2} burstKey={1} />);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.queryByText('+2')).toBeNull();
    rerender(<PointsBurst delta={1} burstKey={2} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
});
