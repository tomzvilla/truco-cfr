import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MOCK_HIGHLIGHTS } from '../data/mock';
import { REAL_HIGHLIGHTS } from '../data/real';
import { Manos } from './Manos';

describe('Manos destacadas', () => {
  it('lista las repeticiones y muestra la primera', () => {
    render(<Manos highlights={MOCK_HIGHLIGHTS} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Manos destacadas' })).toBeInTheDocument();
    for (const h of MOCK_HIGHLIGHTS) expect(screen.getByRole('button', { name: h.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[0]!.title })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(MOCK_HIGHLIGHTS[0]!.steps[0]!.caption)).toBeInTheDocument();
  });
  it('elegir otra repetición cambia el visor', async () => {
    render(<Manos highlights={MOCK_HIGHLIGHTS} />);
    await userEvent.click(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[1]!.title }));
    expect(screen.getByRole('button', { name: MOCK_HIGHLIGHTS[1]!.title })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(MOCK_HIGHLIGHTS[1]!.steps[0]!.caption)).toBeInTheDocument();
  });
  it('sin props muestra las repeticiones reales, sin banner de ejemplo', () => {
    render(<Manos />);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/ejemplo/i)).toBeNull();
    for (const h of REAL_HIGHLIGHTS) expect(screen.getByRole('button', { name: h.title })).toBeInTheDocument();
  });
});
