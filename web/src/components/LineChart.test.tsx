import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LineChart } from './LineChart';

const props = {
  title: 'Curva de aprendizaje',
  series: [
    { id: 'a', label: 'Contra el azar', color: '#38d6c8', points: [{ x: 0, y: 0.5 }, { x: 100, y: 0.9 }] },
    { id: 'b', label: 'Contra el heurístico', color: '#f2b134', points: [{ x: 0, y: 0.3 }, { x: 100, y: 0.55 }] },
  ],
  yMin: 0,
  yMax: 1,
  yTicks: [0, 0.5, 1],
  yFormat: (v: number) => `${Math.round(v * 100)}%`,
  xLabel: 'Iteraciones',
  summary: 'Contra el azar llega a 90%.',
};

describe('LineChart', () => {
  it('dibuja una línea por serie, la leyenda y el resumen accesible', () => {
    const { container } = render(<LineChart {...props} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Curva de aprendizaje' })).toBeInTheDocument();
    expect(screen.getByText('Contra el heurístico')).toBeInTheDocument();
    expect(screen.getByText('Contra el azar llega a 90%.')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
  it('con una línea de referencia la rotula', () => {
    render(<LineChart {...props} refLine={{ y: 0.5, label: 'Empate' }} />);
    expect(screen.getByText('Empate')).toBeInTheDocument();
  });
  it('en escala log no se rompe con valores en el dominio', () => {
    const { container } = render(
      <LineChart {...props} yLog yMin={0.01} yMax={1} yTicks={[0.01, 0.1, 1]}
        series={[{ id: 'e', label: 'Explotabilidad', color: '#e0453a', points: [{ x: 0, y: 0.9 }, { x: 50, y: 0.05 }] }]} />,
    );
    const pts = container.querySelector('polyline')!.getAttribute('points')!;
    expect(pts).not.toMatch(/NaN|Infinity/);
  });
  it('comparte la grilla con los otros gráficos (YGrid): una línea por marca del eje', () => {
    const { container } = render(<LineChart {...props} />);
    expect(container.querySelectorAll('line')).toHaveLength(props.yTicks.length);
  });
  it('sin puntos no se rompe', () => {
    const { container } = render(<LineChart {...props} series={[]} />);
    expect(container.querySelectorAll('polyline')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});
