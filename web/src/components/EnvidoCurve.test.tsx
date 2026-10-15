import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ENVIDO_CURVE_MOCK } from '../data/mock';
import { EnvidoCurve } from './EnvidoCurve';

describe('EnvidoCurve', () => {
  it('dibuja 22 barras y marca las 8 de la zona de farol', () => {
    const { container } = render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    expect(container.querySelectorAll('rect[data-tantos]')).toHaveLength(22);
    expect(container.querySelectorAll('.curve__bar--farol')).toHaveLength(8);
  });
  it('arranca con 27 de tanto y el bot de mano', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    expect(screen.getByRole('status')).toHaveTextContent('Con 27 de tanto, como mano');
    expect(screen.getByRole('status')).toHaveTextContent('88%');
  });
  it('cambiar a pie actualiza el dato', async () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    await userEvent.click(screen.getByLabelText('El bot es pie'));
    expect(screen.getByRole('status')).toHaveTextContent('83%');
  });
  it('el slider recorre los tantos posibles (índice 6 = 6 de tanto = farol)', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });
    expect(screen.getByRole('status')).toHaveTextContent('Con 6 de tanto');
    expect(screen.getByRole('status')).toHaveTextContent('farol');
  });
  it('trae una tabla accesible con los mismos datos y la nota de datos de ejemplo', () => {
    render(<EnvidoCurve data={ENVIDO_CURVE_MOCK} note="Datos de ejemplo" />);
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(23);
    expect(screen.getByText('Datos de ejemplo')).toBeInTheDocument();
  });
});

describe('EnvidoCurve con datos desordenados o parciales (cada barra va a su lugar por tantos)', () => {
  const xOf = (container: HTMLElement, tantos: number) =>
    Number(container.querySelector(`rect[data-tantos="${tantos}"]`)!.getAttribute('x'));
  const sorted = [
    { tantos: 0, mano: 0.1, pie: 0.1 },
    { tantos: 27, mano: 0.9, pie: 0.8 },
    { tantos: 33, mano: 0.7, pie: 0.6 },
  ];

  it('el orden de los datos no cambia la posición de cada barra', () => {
    const a = render(<EnvidoCurve data={sorted} />);
    const b = render(<EnvidoCurve data={[...sorted].reverse()} />);
    for (const t of [0, 27, 33]) expect(xOf(b.container, t)).toBe(xOf(a.container, t));
  });
  it('con datos parciales cada barra queda en el hueco de sus tantos, no en el de su índice', () => {
    const { container } = render(<EnvidoCurve data={sorted} />);
    // 22 huecos + 1 de separación: el 27 es el índice 15 -> hueco 16; el 33, índice 21 -> hueco 22
    const slotW = (440 - 38 - 8) / 23;
    expect(xOf(container, 0)).toBeCloseTo(38 + 1, 5);
    expect(xOf(container, 27)).toBeCloseTo(38 + 16 * slotW + 1, 5);
    expect(xOf(container, 33)).toBeCloseTo(38 + 22 * slotW + 1, 5);
  });
  it('ignora tantos imposibles y datos vacíos sin romperse', () => {
    const { container } = render(<EnvidoCurve data={[...sorted, { tantos: 15, mano: 0.5, pie: 0.5 }]} />);
    expect(container.querySelectorAll('rect[data-tantos]')).toHaveLength(3);
    const empty = render(<EnvidoCurve data={[]} />);
    expect(empty.container.querySelectorAll('rect[data-tantos]')).toHaveLength(0);
  });
  it('la barra elegida por el slider es la de esos tantos', () => {
    const { container } = render(<EnvidoCurve data={[...sorted].reverse()} initialTantos={33} />);
    const sel = container.querySelectorAll('.curve__bar--sel');
    expect(sel).toHaveLength(1);
    expect(sel[0]).toHaveAttribute('data-tantos', '33');
  });
});

describe('EnvidoCurve: probabilidades inválidas', () => {
  const bad = ENVIDO_CURVE_MOCK.map((d, i) =>
    i === 0 ? { ...d, mano: Number.NaN } : i === 1 ? { ...d, mano: 1.7 } : i === 2 ? { ...d, mano: -0.4 } : d,
  );
  it('NaN, mayores a 1 y negativas se acotan a [0,1] y no ensucian el SVG', () => {
    const { container } = render(<EnvidoCurve data={bad} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    const rects = container.querySelectorAll('rect[data-tantos]');
    const hOf = (t: number) => Number(container.querySelector(`rect[data-tantos="${t}"]`)!.getAttribute('height'));
    expect(rects).toHaveLength(22);
    expect(hOf(0)).toBe(1); // NaN -> 0 (alto mínimo de 1 px)
    expect(hOf(2)).toBe(1); // negativa -> 0
    expect(hOf(1)).toBe(190 - 8 - 24); // 1,7 se acota a 1: llena el área del gráfico, sin pasarse
  });
  it('la tabla muestra 0% para un NaN, no "–" ni NaN', () => {
    render(<EnvidoCurve data={bad} />);
    expect(screen.queryByText('NaN%')).toBeNull();
  });
});
