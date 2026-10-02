import { useRouteError } from 'react-router-dom';
import { ErrorScreen } from './ErrorScreen';

/** `errorElement` раздела: рисуется внутри каркаса, меню остаётся рабочим. */
export function RouteError() {
  return <ErrorScreen error={useRouteError()} />;
}

/** `errorElement` корня: упал сам каркас — показываем экран сбоя на всю страницу. */
export function RootRouteError() {
  return <ErrorScreen error={useRouteError()} fullPage />;
}
