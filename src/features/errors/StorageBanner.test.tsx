import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { setStore, clearStore } from '@/data';
import { MemoryStore } from '@/data/memory';
import { LAST_EXPORT_KEY, NUDGE_DISMISSED_KEY } from '@/data/backup';
import { StorageBanner } from './StorageBanner';

const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  localStorage.removeItem(LAST_EXPORT_KEY);
  localStorage.removeItem(NUDGE_DISMISSED_KEY);
});
afterEach(() => clearStore());

describe('StorageBanner', () => {
  it('warns that data is not saved when the store is in error mode', () => {
    setStore(new MemoryStore({ error: 'Браузер не разрешает хранить данные' }));
    render(<StorageBanner />);
    expect(screen.getByText('Данные не сохраняются в этом браузере. Скачай копию, чтобы ничего не потерять.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать копию' })).toBeInTheDocument();
  });

  it('nudges about a backup when data is old and hides until tomorrow on dismiss', async () => {
    const store = new MemoryStore();
    await store.put('profiles', {
      id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', createdAt: old, updatedAt: old,
    });
    setStore(store);
    render(<StorageBanner />);
    expect(await screen.findByText('Копии данных ещё не было')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    await waitFor(() => expect(screen.queryByText('Копии данных ещё не было')).not.toBeInTheDocument());
    expect(localStorage.getItem(NUDGE_DISMISSED_KEY)).toBeTruthy();
  });

  it('shows how old the last copy is', async () => {
    localStorage.setItem(LAST_EXPORT_KEY, new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString());
    const store = new MemoryStore();
    await store.put('profiles', {
      id: 'me', timezone: 'Asia/Almaty', morningTime: '09:00', currency: 'KZT', createdAt: old, updatedAt: old,
    });
    setStore(store);
    render(<StorageBanner />);
    expect(await screen.findByText('Копия данных: 21 день назад')).toBeInTheDocument();
  });

  it('stays hidden for fresh data', async () => {
    setStore(new MemoryStore());
    const { container } = render(<StorageBanner />);
    await new Promise(r => setTimeout(r, 10));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StorageBanner error mode', () => {
  it('can be hidden until reload', () => {
    setStore(new MemoryStore({ error: 'нет места' }));
    render(<StorageBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(screen.queryByText(/Данные не сохраняются/)).not.toBeInTheDocument();
  });
});
