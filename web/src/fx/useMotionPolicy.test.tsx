import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { mockMatchMedia } from '../test/helpers';
import { updateSettings } from '../settings';
import { useMotionPolicy } from './useMotionPolicy';

function Probe() {
  const p = useMotionPolicy();
  return <p data-testid="p">{JSON.stringify(p)}</p>;
}
const policy = () => JSON.parse(screen.getByTestId('p').textContent!);

describe('useMotionPolicy', () => {
  it('sin preferencia del sistema todo se mueve', () => {
    render(<Probe />);
    expect(policy().idle).toBe(true);
  });
  it('con prefers-reduced-motion en auto se apaga todo', () => {
    mockMatchMedia(true);
    render(<Probe />);
    expect(policy()).toMatchObject({ idle: false, shake: false, swirlAnimated: false });
  });
  it('el usuario puede forzar completo o reducido y se actualiza en vivo', () => {
    mockMatchMedia(true);
    render(<Probe />);
    act(() => updateSettings({ motion: 'full' }));
    expect(policy().idle).toBe(true);
    act(() => updateSettings({ motion: 'reduced' }));
    expect(policy().idle).toBe(false);
  });
});
