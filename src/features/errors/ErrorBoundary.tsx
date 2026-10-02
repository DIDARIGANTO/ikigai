import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorScreen } from './ErrorScreen';

/**
 * Последняя линия обороны: ловит всё, что упало вне роутера (провайдеры, сам роутер).
 * Ошибки страниц ловит `errorElement` маршрутов — там каркас остаётся на месте.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown; failed: boolean }> {
  state = { error: null as unknown, failed: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Ikigai: сбой приложения', error, info.componentStack);
  }

  render() {
    if (this.state.failed) return <ErrorScreen error={this.state.error} fullPage />;
    return this.props.children;
  }
}
