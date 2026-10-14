import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FIXTURES } from '../table/fixtures';
import type { TableView } from '../table/types';
import { ActionBar } from './ActionBar';

describe('ActionBar', () => {
  it('inicio de mano: ofrece cantos y dispara la acción', async () => {
    const onAction = vi.fn();
    render(<ActionBar view={FIXTURES.inicioDeMano} onAction={onAction} />);
    for (const name of ['Envido', 'Real envido', 'Falta envido', 'Truco', 'Al mazo']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Quiero' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Truco' }));
    expect(onAction).toHaveBeenCalledWith('truco');
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
