import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { ShellActionsProvider } from '@/app/ShellActions';
import { ShortcutHandler } from './ShortcutHandler';

function setup(url: string) {
  const openQuick = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <ShellActionsProvider value={{ openQuick }}>
            <ShortcutHandler />
          </ShellActionsProvider>
        ),
      },
    ],
    { initialEntries: [url] },
  );
  render(<RouterProvider router={router} />);
  return { openQuick, router };
}

describe('ShortcutHandler', () => {
  it('opens quick capture once for /?new=task and cleans the URL', async () => {
    const { openQuick, router } = setup('/?new=task&x=1');
    await waitFor(() => expect(router.state.location.search).toBe('?x=1'));
    expect(openQuick).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the parameter', async () => {
    const { openQuick } = setup('/');
    await new Promise(r => setTimeout(r, 10));
    expect(openQuick).not.toHaveBeenCalled();
  });
});
