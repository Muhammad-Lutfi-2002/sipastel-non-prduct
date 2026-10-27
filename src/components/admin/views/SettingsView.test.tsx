import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt } from '../../../test/render';
import { makeUser } from '../../../test/factories';

let owner = true;
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: makeUser(owner ? 'OWNER' : 'FINANCE'),
    session: { user: makeUser('OWNER') },
    hasPermission: (p: string) => (p === 'settings:write' ? owner : true),
  }),
}));

const fetchStudioProfile = vi.fn();
const saveStoredStudioProfile = vi.fn();
vi.mock('../../../utils/storage', () => ({
  fetchStudioProfile: (...a: unknown[]) => fetchStudioProfile(...a),
  saveStoredStudioProfile: (...a: unknown[]) => saveStoredStudioProfile(...a),
  uploadStudioLogo: vi.fn(),
  removeStudioLogo: vi.fn(),
}));
const changeOwnPassword = vi.fn();
vi.mock('../../../services/authService', () => ({
  changeOwnPassword: (...a: unknown[]) => changeOwnPassword(...a),
  MIN_PASSWORD_LENGTH: 10,
}));

import { SettingsView } from './SettingsView';

const profile = {
  name: 'SIPASTEL', address: 'Jl. Merdeka 1', phone: '0896-7734-3212',
  bankName: 'BCA', bankAccountNumber: '1234567890', bankAccountHolder: 'Owner', logoUrl: null,
};

beforeEach(() => {
  owner = true;
  fetchStudioProfile.mockReset().mockResolvedValue({ data: profile, error: null });
  saveStoredStudioProfile.mockReset().mockResolvedValue({ success: true });
  changeOwnPassword.mockReset();
});

const loaded = async () => {
  renderAt(<SettingsView />, '/admin/settings');
  await waitFor(() => expect(screen.getByLabelText(/nama brand/i)).toHaveValue('SIPASTEL'));
};

describe('SettingsView - studio profile', () => {
  it('locks the form when the profile could not be loaded (saving would overwrite real data with blanks)', async () => {
    fetchStudioProfile.mockResolvedValue({ data: null, error: 'Tidak dapat terhubung ke server.' });
    renderAt(<SettingsView />, '/admin/settings');
    expect(await screen.findByRole('alert')).toHaveTextContent(/gagal memuat data/i);
    expect(screen.getByLabelText(/nama brand/i)).toBeDisabled();
    expect(saveStoredStudioProfile).not.toHaveBeenCalled();
  });

  it('is read-only for non-owners, with an explanation', async () => {
    owner = false;
    await loaded();
    expect(screen.getByLabelText(/nama brand/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /simpan profil/i })).not.toBeInTheDocument();
    expect(screen.getByText(/hanya dapat diubah oleh akun owner/i)).toBeInTheDocument();
  });

  it('saves the text fields WITHOUT touching the logo', async () => {
    await loaded();
    fireEvent.change(screen.getByLabelText(/nama brand/i), { target: { value: 'SIPASTEL Studio' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan profil/i }));
    await waitFor(() => expect(saveStoredStudioProfile).toHaveBeenCalled());
    const arg = saveStoredStudioProfile.mock.calls[0][0];
    expect(arg.name).toBe('SIPASTEL Studio');
    expect(arg).not.toHaveProperty('logoUrl');
  });

  it('requires a complete bank block when any bank field is filled', async () => {
    await loaded();
    fireEvent.change(screen.getByLabelText(/nomor rekening/i), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText(/atas nama/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan profil/i }));
    expect(await screen.findByText(/5–20 digit/)).toBeInTheDocument();
    expect(screen.getByText(/nama pemilik rekening wajib/i)).toBeInTheDocument();
    expect(saveStoredStudioProfile).not.toHaveBeenCalled();
  });

  it('reports the database refusal instead of claiming success', async () => {
    saveStoredStudioProfile.mockResolvedValue({ success: false, error: 'Hanya akun Owner yang dapat mengubah profil studio.' });
    await loaded();
    fireEvent.click(screen.getByRole('button', { name: /simpan profil/i }));
    expect(await screen.findByText(/hanya akun owner yang dapat mengubah profil studio/i)).toBeInTheDocument();
    expect(screen.queryByText(/berhasil diperbarui/i)).not.toBeInTheDocument();
  });
});

describe('SettingsView - password change', () => {
  const fillPw = (cur: string, next: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText(/password saat ini/i), { target: { value: cur } });
    fireEvent.change(screen.getByLabelText(/^password baru/i), { target: { value: next } });
    fireEvent.change(screen.getByLabelText(/konfirmasi password baru/i), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: /^ubah password$/i }));
  };

  it('is available to every role', async () => {
    owner = false;
    await loaded();
    expect(screen.getByRole('button', { name: /^ubah password$/i })).toBeInTheDocument();
  });

  it('rejects a mismatching confirmation without calling the server', async () => {
    await loaded();
    fillPw('old-password-1', 'brand-new-password', 'different-password');
    expect(await screen.findByText(/konfirmasi password baru tidak sama/i)).toBeInTheDocument();
    expect(changeOwnPassword).not.toHaveBeenCalled();
  });

  it('shows the service error and keeps the form values on failure', async () => {
    changeOwnPassword.mockResolvedValue({ success: false, error: 'Password saat ini salah.' });
    await loaded();
    fillPw('wrong-old', 'brand-new-password', 'brand-new-password');
    expect(await screen.findByText('Password saat ini salah.')).toBeInTheDocument();
  });

  it('clears all password fields after success', async () => {
    changeOwnPassword.mockResolvedValue({ success: true });
    await loaded();
    fillPw('old-password-1', 'brand-new-password', 'brand-new-password');
    await waitFor(() => expect(changeOwnPassword).toHaveBeenCalledWith('owner@sipastel.test', 'old-password-1', 'brand-new-password'));
    await waitFor(() => expect(screen.getByLabelText(/password saat ini/i)).toHaveValue(''));
  });
});
