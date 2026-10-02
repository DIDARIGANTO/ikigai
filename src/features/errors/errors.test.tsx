import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';
import { RouteError } from './RouteError';
import { NotFound } from './NotFound';
import { collectEmergencyExport } from './emergencyExport';
import { LocalStore } from '@/data/local';

function Boom(): never {
  throw new Error('битая запись');
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('shows the friendly error page instead of a blank screen and logs the error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'Что-то пошло не так' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Перезагрузить/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Скачать копию данных/ })).toBeInTheDocument();
    expect(screen.getByText('битая запись')).toBeInTheDocument();
    expect(log).toHaveBeenCalled();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>всё хорошо</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('всё хорошо')).toBeInTheDocument();
  });
});

describe('route errorElement', () => {
  it('catches a page error and keeps the layout around it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <div>
              <nav>меню</nav>
              <OutletProxy />
            </div>
          ),
          children: [{ errorElement: <RouteError />, children: [{ index: true, element: <Boom /> }] }],
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Что-то пошло не так' })).toBeInTheDocument();
    expect(screen.getByText('меню')).toBeInTheDocument();
  });
});

describe('NotFound', () => {
  it('explains the unknown address and links home', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>главная</p> },
        { path: '*', element: <NotFound /> },
      ],
      { initialEntries: ['/nope/42'] },
    );
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument();
    expect(screen.getByText('/nope/42')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Ikigai · Страница не найдена');
  });
});

describe('collectEmergencyExport', () => {
  it('reads the raw IndexedDB, including rows the app would reject', async () => {
    const store = new LocalStore();
    await store.put('goals', { id: 'g-bad', title: 'x', horizon: 'bogus' } as never);
    const { json, rows } = await collectEmergencyExport();
    const parsed = JSON.parse(json) as { app: string; emergency: boolean; data: { goals: { id: string }[] } };
    expect(parsed.app).toBe('ikigai');
    expect(parsed.emergency).toBe(true);
    expect(parsed.data.goals.map(g => g.id)).toContain('g-bad');
    expect(rows).toBeGreaterThan(0);
  });
});

function OutletProxy() {
  return <Outlet />;
}
