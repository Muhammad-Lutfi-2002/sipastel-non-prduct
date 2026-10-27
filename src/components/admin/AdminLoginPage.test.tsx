import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../test/render';

const login = vi.fn();
let authStatus = 'unauthenticated';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ authStatus, login, user: null, hasPermission: () => false, logout: vi.fn(), clearExpiredState: vi.fn() }),
}));

import { AdminLoginPage } from './AdminLoginPage';

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^password/i, { selector: 'input' }), { target: { value: password } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: /^masuk/i }));

beforeEach(() => {
  login.mockReset();
  authStatus = 'unauthenticated';
});

describe('AdminLoginPage', () => {
  it('sends the email trimmed (type=email strips spaces) but the password EXACTLY as typed', async () => {
    login.mockResolvedValue({ success: true });
    renderAt(<AdminLoginPage />, '/admin/login');
    fill('  owner@sipastel.com ', '  pass with spaces  ');
    submit();
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('owner@sipastel.com', '  pass with spaces  ');
  });

  it('has an email field (not a free-text "username") and no fake "remember me" switch', () => {
    renderAt(<AdminLoginPage />, '/admin/login');
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute('type', 'email');
    expect(screen.queryByText(/ingat saya/i)).not.toBeInTheDocument();
  });

  it('shows the server error and clears the password after a failed attempt', async () => {
    login.mockResolvedValue({ success: false, error: 'Email atau password salah.' });
    renderAt(<AdminLoginPage />, '/admin/login');
    fill('a@b.co', 'wrong');
    submit();
    expect(await screen.findByText('Email atau password salah.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i, { selector: 'input' })).toHaveValue('');
  });

  it('locks the form for a while after 5 failed attempts', async () => {
    login.mockResolvedValue({ success: false, error: 'Email atau password salah.' });
    renderAt(<AdminLoginPage />, '/admin/login');
    for (let i = 0; i < 5; i++) {
      fill('a@b.co', `wrong${i}`);
      submit();
      await waitFor(() => expect(login).toHaveBeenCalledTimes(i + 1));
      await screen.findByRole('button', { name: /masuk|coba lagi dalam/i });
    }
    expect(await screen.findByText(/terlalu banyak percobaan gagal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi dalam/i })).toBeDisabled();
    // A 6th click must not reach the server.
    fireEvent.click(screen.getByRole('button', { name: /coba lagi dalam/i }));
    expect(login).toHaveBeenCalledTimes(5);
  });

  it('explains an expired session', () => {
    authStatus = 'expired';
    renderAt(<AdminLoginPage />, '/admin/login');
    expect(screen.getByText('Sesi Berakhir')).toBeInTheDocument();
  });
});
