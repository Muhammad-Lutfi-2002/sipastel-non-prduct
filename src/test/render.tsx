import React from 'react';
import { render } from '@testing-library/react';
import { RouterProvider } from '../context/RouterContext';
import { AdminToastProvider } from '../components/admin/AdminToast';

/** Renders inside the router (starting at `url`) and the admin toast provider. */
export function renderAt(ui: React.ReactElement, url = '/admin/dashboard') {
  window.history.replaceState({}, '', url);
  return render(
    <RouterProvider>
      <AdminToastProvider>{ui}</AdminToastProvider>
    </RouterProvider>
  );
}
