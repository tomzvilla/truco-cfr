import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('inicio de mano: ofrece cantos y dispara la acción', async () => {
    const onAction = vi.fn();
    render(<ActionBar view={FIXTURES.inicioDeMano} onAction={onAction} />);
    for (const name of ['Cantar envido', 'Truco', 'Al mazo']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Quiero' })).toBeNull();
    // una sola fila de botones iguales: los envidos van agrupados
    expect(screen.getByRole('group', { name: 'Acciones' }).querySelectorAll(':scope > .actionbar__row > *')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Truco' }));
    expect(onAction).toHaveBeenCalledWith('truco');
  });
  it('el menú Envido se abre con aria-expanded, ofrece los tres cantos, se cierra con Esc y devuelve el foco', async () => {
    const onAction = vi.fn();
    render(<ActionBar view={FIXTURES.inicioDeMano} onAction={onAction} />);
    const trigger = screen.getByRole('button', { name: 'Cantar envido' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Envido' })).toBeNull();
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('group', { name: 'Envido' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['Envido', 'Real envido', 'Falta envido']);
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.click(within(screen.getByRole('group', { name: 'Envido' })).getByRole('button', { name: 'Real envido' }));
    expect(onAction).toHaveBeenCalledWith('realEnvido');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  it('responder un canto: Quiero (verde) y No quiero (rojo) van en su propia fila, grandes', () => {
    render(<ActionBar view={FIXTURES.trucoPendiente} onAction={() => {}} />);
    const answer = document.querySelector('.actionbar__row--answer')!;
    expect(within(answer as HTMLElement).getAllByRole('button').map((b) => b.textContent)).toEqual(['Quiero', 'No quiero']);
    expect(screen.getByRole('button', { name: 'Quiero' })).toHaveClass('btn--menta');
    expect(screen.getByRole('button', { name: 'No quiero' })).toHaveClass('btn--brasa');
  });
  it('truco pendiente: Quiero, No quiero y Quiero retruco', () => {
    render(<ActionBar view={FIXTURES.trucoPendiente} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Quiero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No quiero' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quiero retruco' })).toBeInTheDocument();
  });
  it('turno del bot (sin acciones): avisa y no ofrece botones', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, actions: [] };
    render(<ActionBar view={v} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('El bot está pensando…');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('group', { name: 'Acciones' })).toBeNull();
  });
  it('solo cartas disponibles: pide tocar una carta', () => {
    const v: TableView = { ...FIXTURES.inicioDeMano, actions: ['jugar0', 'jugar1'] };
    render(<ActionBar view={v} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu turno: tocá una carta para jugarla.');
  });
  it('fin de mano', () => {
    render(<ActionBar view={FIXTURES.finDeManoRayosX} onAction={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('Terminó la mano.');
  });
});
