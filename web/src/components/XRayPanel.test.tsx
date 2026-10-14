import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FIXTURES } from '../table/fixtures';
import { XRayPanel } from './XRayPanel';

describe('XRayPanel', () => {
  it('lista las probabilidades ordenadas', () => {
    render(<XRayPanel entries={FIXTURES.finDeManoRayosX.xray} />);
    const items = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toContain('Jugar carta 2');
    expect(items[0]).toContain('58%');
    expect(items[1]).toContain('Truco');
    expect(items).toHaveLength(3);
  });
  it('sin datos explica por qué está vacío', () => {
    render(<XRayPanel entries={undefined} />);
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
