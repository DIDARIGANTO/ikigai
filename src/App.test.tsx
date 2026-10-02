import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from './App';

describe('app routes', () => {
  it('renders NotFound inside the shell for an unknown address', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/definitely/not/here'] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Такой страницы нет' })).toBeInTheDocument();
    // Каркас на месте: из 404 можно уйти по меню.
    expect(screen.getAllByRole('link', { name: /Сегодня/ }).length).toBeGreaterThan(0);
  });
});
