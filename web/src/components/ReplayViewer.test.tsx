import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOCK_HIGHLIGHTS } from '../data/mock';
import { ReplayViewer } from './ReplayViewer';

describe('ReplayViewer', () => {
  const h = MOCK_HIGHLIGHTS[0]!;
  it('arranca en el paso 1 con el botón Anterior deshabilitado', () => {
    render(<ReplayViewer highlight={h} />);
    expect(screen.getByText(h.steps[0]!.caption)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByText(`Paso 1 de ${h.steps.length}`)).toBeInTheDocument();
  });
  it('avanza y retrocede, y Siguiente se apaga en el último paso', async () => {
    render(<ReplayViewer highlight={h} />);
    const next = screen.getByRole('button', { name: 'Siguiente' });
    for (let i = 1; i < h.steps.length; i++) await userEvent.click(next);
    expect(screen.getByText(h.steps[h.steps.length - 1]!.caption)).toBeInTheDocument();
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByText(`Paso ${h.steps.length - 1} de ${h.steps.length}`)).toBeInTheDocument();
  });
  it('la mesa es de solo lectura (sin botones de jugar)', () => {
    render(<ReplayViewer highlight={h} />);
    expect(screen.queryByRole('button', { name: /^Jugar / })).toBeNull();
  });
  it('al cambiar de repetición vuelve al paso 1', async () => {
    const { rerender } = render(<ReplayViewer highlight={h} />);
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    rerender(<ReplayViewer highlight={MOCK_HIGHLIGHTS[1]!} />);
    expect(screen.getByText(`Paso 1 de ${MOCK_HIGHLIGHTS[1]!.steps.length}`)).toBeInTheDocument();
  });
});
