import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Save,
  CheckCircle2,
  Lock,
  Building,
  ImageIcon,
  Upload,
  Trash2,
  KeyRound,
  Bug,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchStudioProfile,
  saveStoredStudioProfile,
  uploadStudioLogo,
  removeStudioLogo,
} from '../../../utils/storage';
import { changeOwnPassword, MIN_PASSWORD_LENGTH } from '../../../services/authService';
import { validateUpload } from '../../../utils/upload';
import { formatRoleLabel, formatDateTime } from '../../../utils/formatters';
import { fetchRecentClientErrors, ClientErrorEntry } from '../../../utils/clientErrorLog';
import { useAdminToast } from '../AdminToast';
import { LoadErrorBanner } from '../LoadErrorBanner';
import { PageHeader } from '../ui';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const RBAC_ROLES = [
  {
    role: 'OWNER',
    description: 'Pendiri Studio & Direktur Eksekutif',
    permissions: 'Akses penuh: keuangan, pembatalan pembayaran, katalog, pesanan, produksi, dan pengaturan studio.',
    badge: 'bg-accent text-on-accent',
  },
  {
    role: 'FINANCE',
    description: 'Tim Finance & Penagihan',
    permissions: 'Melihat pesanan, mengatur harga, mencatat pembayaran, invoice, dan data pelanggan. Tidak mengubah produksi.',
    badge: 'bg-accent-wash text-accent border border-accent/30',
  },
  {
    role: 'PRODUCTION_HEAD',
    description: 'Kepala Produksi — Pemimpin Workshop',
    permissions: 'Papan produksi, tahap potong/jahit/QC, packing, pengiriman, dan katalog. Tidak melihat data keuangan.',
    badge: 'bg-info/10 text-info',
  },
];

const inputClass =
  'w-full h-9 px-3 bg-surface border border-line-strong rounded-lg text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
const labelClass = 'block text-xs font-medium text-heading mb-1.5';

export const SettingsView: React.FC = () => {
  const { user, session, hasPermission } = useAuth();
  const { showToast } = useAdminToast();
  const canEdit = hasPermission('settings:write');

  const [studioName, setStudioName] = useState('');
  const [studioAddress, setStudioAddress] = useState('');
  const [studioPhone, setStudioPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  // When the profile could not be loaded the form stays locked: saving would
  // otherwise overwrite the real settings with empty values.
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // System error log (OWNER / PRODUCTION_HEAD only - matches the RLS policy
  // on client_error_log, so other roles never see a card that would just
  // come back empty).
  const canViewErrorLog = user?.role === 'OWNER' || user?.role === 'PRODUCTION_HEAD';
  const [errorLog, setErrorLog] = useState<ClientErrorEntry[]>([]);
  const [isLoadingErrorLog, setIsLoadingErrorLog] = useState(false);
  const [errorLogError, setErrorLogError] = useState<string | null>(null);

  const loadErrorLog = async () => {
    if (!canViewErrorLog) return;
    setIsLoadingErrorLog(true);
    const res = await fetchRecentClientErrors();
    setErrorLog(res.data);
    setErrorLogError(res.error);
    setIsLoadingErrorLog(false);
  };

  useEffect(() => {
    void loadErrorLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewErrorLog]);

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const loadProfile = async () => {
    const { data, error } = await fetchStudioProfile();
    if (data) {
      setStudioName(data.name);
      setStudioAddress(data.address);
      setStudioPhone(data.phone);
      setBankName(data.bankName);
      setBankAccountNumber(data.bankAccountNumber);
      setBankAccountHolder(data.bankAccountHolder);
      setLogoUrl(data.logoUrl);
      setProfileError(null);
    } else {
      setProfileError(error ?? 'Profil studio tidak dapat dimuat.');
    }
    setIsLoadingProfile(false);
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  // Free the temporary preview URL when leaving the page.
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const formLocked = !canEdit || !!profileError || isLoadingProfile;

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const checked = await validateUpload(file, {
      allowed: ['png', 'jpeg', 'webp', 'svg'],
      maxBytes: LOGO_MAX_BYTES,
    });
    if (!checked.ok) {
      showToast(checked.error, 'error');
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setPendingLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const cancelLogoPreview = () => {
    setLogoPreview(null);
    setPendingLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleUploadLogo = async () => {
    if (!pendingLogoFile || isSavingLogo) return;
    setIsSavingLogo(true);
    const result = await uploadStudioLogo(pendingLogoFile, logoUrl);
    setIsSavingLogo(false);

    if (!result.success) {
      showToast(result.error || 'Gagal mengupload logo.', 'error');
      return;
    }

    setLogoUrl(result.url ?? null);
    cancelLogoPreview();
    showToast('Logo studio berhasil diperbarui. Langsung tampil di header seluruh aplikasi.', 'success');
  };

  const handleRemoveLogo = async () => {
    if (isSavingLogo) return;
    setIsSavingLogo(true);
    const result = await removeStudioLogo(logoUrl);
    setIsSavingLogo(false);

    if (!result.success) {
      showToast(result.error || 'Gagal menghapus logo.', 'error');
      return;
    }
    setLogoUrl(null);
    showToast('Logo dihapus. Header kembali menggunakan wordmark default SIPASTEL.', 'success');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formLocked || isSavingProfile) return;

    const errors: Record<string, string> = {};
    const name = studioName.trim();
    const address = studioAddress.trim();
    const phone = studioPhone.trim();
    const bank = bankName.trim();
    const account = bankAccountNumber.trim();
    const holder = bankAccountHolder.trim();

    if (!name) errors.name = 'Nama studio wajib diisi.';
    if (!address) errors.address = 'Alamat wajib diisi.';
    if (!phone) errors.phone = 'Nomor WhatsApp wajib diisi.';
    else if (phone.replace(/\D/g, '').length < 9) errors.phone = 'Nomor WhatsApp minimal 9 digit.';

    // Bank details are shown to customers for transfers, so a half-filled
    // set would produce an unusable payment instruction.
    if (bank || account || holder) {
      if (!bank) errors.bankName = 'Nama bank wajib diisi.';
      if (!account) errors.bankAccountNumber = 'Nomor rekening wajib diisi.';
      else if (!/^\d{5,20}$/.test(account.replace(/[\s-]/g, ''))) errors.bankAccountNumber = 'Nomor rekening harus 5–20 digit angka.';
      if (!holder) errors.bankAccountHolder = 'Nama pemilik rekening wajib diisi.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast('Periksa kembali isian yang ditandai.', 'error');
      return;
    }

    setIsSavingProfile(true);
    const result = await saveStoredStudioProfile({
      name,
      address,
      phone,
      bankName: bank,
      bankAccountNumber: account,
      bankAccountHolder: holder,
    });
    setIsSavingProfile(false);

    showToast(result.success ? 'Pengaturan profil studio berhasil diperbarui.' : result.error || 'Gagal menyimpan pengaturan.', result.success ? 'success' : 'error');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (!user || isChangingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Semua kolom password wajib diisi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak sama.');
      return;
    }

    setIsChangingPassword(true);
    const result = await changeOwnPassword(user.email, currentPassword, newPassword);
    setIsChangingPassword(false);

    if (!result.success) {
      setPasswordError(result.error ?? 'Gagal mengubah password.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Password berhasil diubah.', 'success');
  };

  const fieldError = (key: string) =>
    formErrors[key] ? (
      <p role="alert" className="text-xs text-danger mt-1">
        {formErrors[key]}
      </p>
    ) : null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <PageHeader title="Pengaturan & Keamanan Studio" description="Profil area kerja studio dan kontrol akses berbasis peran." />

      {profileError && <LoadErrorBanner message={profileError} onRetry={() => void loadProfile()} />}

      {!canEdit && (
        <p role="note" className="text-xs text-muted bg-surface-hover border border-line rounded-lg p-2.5">
          Profil dan logo studio hanya dapat diubah oleh akun Owner. Anda dapat mengubah password akun Anda sendiri di bawah.
        </p>
      )}

      {/* Logo Studio (Branding) Card */}
      <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <ImageIcon className="w-4 h-4 text-accent" aria-hidden="true" />
          <h3 className="font-heading text-sm font-semibold text-ink">Logo Studio</h3>
        </div>
        <p className="text-sm text-muted -mt-1">
          Logo aktif otomatis tampil di header seluruh halaman (customer &amp; admin) tanpa perlu ubah kode.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-28 h-28 shrink-0 rounded-xl border border-line bg-paper flex items-center justify-center overflow-hidden p-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Preview logo baru" className="max-w-full max-h-full object-contain" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo studio aktif" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-center">
                <ImageIcon className="w-5 h-5 text-muted mx-auto mb-1" aria-hidden="true" />
                <span className="text-xs text-muted">Belum ada logo</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2.5 w-full">
            <div>
              <span className="text-xs font-medium text-heading block mb-1.5">
                {logoPreview ? 'Preview Logo Baru' : logoUrl ? 'Logo Sedang Aktif' : 'Fallback: Wordmark "SIPASTEL"'}
              </span>
              <p className="text-xs text-muted">
                PNG, JPG, WEBP, atau SVG. Maksimal 2MB. Rasio disarankan mendekati persegi/landscape agar tidak terdistorsi.
              </p>
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogoFileSelect}
                  disabled={isSavingLogo || !!profileError}
                  className="hidden"
                  id="logo-upload-input"
                />

                {!logoPreview ? (
                  <label
                    htmlFor="logo-upload-input"
                    className={`h-8 px-3 bg-surface border border-line-strong text-ink hover:bg-surface-hover rounded-lg text-xs font-medium flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors ${
                      profileError ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-hover cursor-pointer'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{logoUrl ? 'Ganti Logo' : 'Upload Logo'}</span>
                  </label>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleUploadLogo}
                      disabled={isSavingLogo}
                      className="h-8 px-3 bg-accent hover:bg-accent-soft disabled:opacity-60 text-on-accent rounded-lg text-xs font-medium flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isSavingLogo ? 'Menyimpan...' : 'Simpan Logo Ini'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelLogoPreview}
                      disabled={isSavingLogo}
                      className="h-8 px-3 border border-line-strong text-ink hover:bg-surface-hover text-xs font-medium rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      Batal
                    </button>
                  </>
                )}

                {logoUrl && !logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isSavingLogo}
                    className="h-8 px-3 text-danger hover:bg-danger/10 rounded-lg text-xs font-medium flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors cursor-pointer disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hapus Logo</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Studio Profile & Current Session */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Studio Info Card */}
        <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-3">
            <Building className="w-4 h-4 text-accent" aria-hidden="true" />
            <h3 className="font-heading text-sm font-semibold text-ink">Informasi Studio</h3>
          </div>

          <form onSubmit={handleSave} className="space-y-3 text-sm" noValidate>
            <fieldset disabled={formLocked || isSavingProfile} className="space-y-3 min-w-0">
              <div>
                <label htmlFor="studio-name" className={labelClass}>Nama Brand / Studio</label>
                <input id="studio-name" type="text" maxLength={100} value={studioName} onChange={(e) => setStudioName(e.target.value)} className={inputClass} />
                {fieldError('name')}
              </div>

              <div>
                <label htmlFor="studio-address" className={labelClass}>Alamat Workshop</label>
                <input id="studio-address" type="text" maxLength={300} value={studioAddress} onChange={(e) => setStudioAddress(e.target.value)} className={inputClass} />
                {fieldError('address')}
              </div>

              <div>
                <label htmlFor="studio-phone" className={labelClass}>WhatsApp Resmi Studio</label>
                <input id="studio-phone" type="tel" inputMode="tel" maxLength={25} value={studioPhone} onChange={(e) => setStudioPhone(e.target.value)} className={`${inputClass} font-mono`} />
                {fieldError('phone')}
              </div>

              <div className="pt-1 border-t border-line">
                <p className="text-xs font-medium text-heading mt-3 mb-2">Rekening Transfer (ditampilkan ke customer)</p>
              </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="studio-bank" className={labelClass}>Nama Bank</label>
                  <input id="studio-bank" type="text" maxLength={50} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Contoh: BCA" className={inputClass} />
                  {fieldError('bankName')}
                </div>
                <div>
                  <label htmlFor="studio-account" className={labelClass}>Nomor Rekening</label>
                  <input id="studio-account" type="text" inputMode="numeric" maxLength={30} value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="Contoh: 1234567890" className={`${inputClass} font-mono`} />
                  {fieldError('bankAccountNumber')}
                </div>
              </div>

              <div>
                <label htmlFor="studio-holder" className={labelClass}>Atas Nama Pemilik Rekening</label>
                <input id="studio-holder" type="text" maxLength={100} value={bankAccountHolder} onChange={(e) => setBankAccountHolder(e.target.value)} placeholder="Contoh: Nama Owner Studio" className={inputClass} />
                {fieldError('bankAccountHolder')}
              </div>

              {canEdit && (
                <div className="pt-2">
                  <button
                    type="submit"
                    className="h-9 px-4 bg-accent hover:bg-accent-soft disabled:opacity-60 disabled:cursor-not-allowed text-on-accent rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Profil'}</span>
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        </div>

        {/* Session + password */}
        <div className="space-y-6">
          <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Lock className="w-4 h-4 text-sage" aria-hidden="true" />
              <h3 className="font-heading text-sm font-semibold text-ink">Detail Sesi Aktif</h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2 p-3 bg-surface-hover/40 border border-line rounded-lg">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{user?.name || 'Administrator'}</p>
                  <span className="text-xs text-muted font-mono truncate block">{user?.email}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-accent-wash text-accent shrink-0">
                  {formatRoleLabel(user?.role)}
                </span>
              </div>

              <p className="flex items-center justify-between text-body">
                <span>Status Sesi:</span>
                <span className="font-mono text-sage font-semibold">{session ? 'Aktif' : '-'}</span>
              </p>
            </div>
          </div>

          <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <KeyRound className="w-4 h-4 text-accent" aria-hidden="true" />
              <h3 className="font-heading text-sm font-semibold text-ink">Ubah Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-sm" noValidate>
              <input type="text" autoComplete="username" value={user?.email ?? ''} readOnly hidden aria-hidden="true" />
              <div>
                <label htmlFor="pw-current" className={labelClass}>Password Saat Ini</label>
                <input id="pw-current" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="pw-new" className={labelClass}>Password Baru</label>
                <input id="pw-new" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
                <p className="text-xs text-muted mt-1">Minimal {MIN_PASSWORD_LENGTH} karakter.</p>
              </div>
              <div>
                <label htmlFor="pw-confirm" className={labelClass}>Konfirmasi Password Baru</label>
                <input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
              </div>
              {passwordError && (
                <p role="alert" className="text-xs text-danger">
                  {passwordError}
                </p>
              )}
              <button
                type="submit"
                disabled={isChangingPassword}
                className="h-9 px-4 bg-accent hover:bg-accent-soft disabled:opacity-60 text-on-accent rounded-lg text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {isChangingPassword ? 'Memproses...' : 'Ubah Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Role-Based Permissions Matrix */}
      <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Shield className="w-4 h-4 text-info" aria-hidden="true" />
          <h3 className="font-heading text-sm font-semibold text-ink">Kontrol Akses Berbasis Peran (RBAC) Studio</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {RBAC_ROLES.map((r) => (
            <div key={r.role} className="p-3.5 bg-surface-hover/40 border border-line rounded-lg space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${r.badge}`}>{r.role}</span>
                <span className="text-xs font-medium text-ink">{r.description}</span>
              </div>
              <p className="text-xs text-body leading-relaxed pt-1">{r.permissions}</p>
            </div>
          ))}
        </div>
      </div>

      {canViewErrorLog && (
        <div className="p-5 bg-surface border border-line rounded-xl space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-danger" aria-hidden="true" />
              <h3 className="font-heading text-sm font-semibold text-ink">Log Error Sistem</h3>
            </div>
            <button
              type="button"
              onClick={() => void loadErrorLog()}
              disabled={isLoadingErrorLog}
              className="px-2.5 py-1 text-xs font-medium text-body hover:text-ink bg-paper hover:bg-surface-hover border border-line rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingErrorLog ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Perbarui</span>
            </button>
          </div>
          <p className="text-xs text-muted -mt-2">
            Error yang terjadi di sisi pelanggan atau admin tercatat otomatis di sini selama 30 hari terakhir - baik
            Anda buka DevTools atau tidak.
          </p>

          {errorLogError && (
            <p role="alert" className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg p-2.5">
              Gagal memuat log: {errorLogError}
            </p>
          )}

          {!errorLogError && errorLog.length === 0 && !isLoadingErrorLog && (
            <p className="text-xs text-muted py-2">Belum ada error yang tercatat. Kabar baik.</p>
          )}

          {errorLog.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {errorLog.map((entry) => (
                <div key={entry.id} className="p-3 bg-surface-hover/40 border border-line rounded-lg space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-danger">{entry.boundary}</span>
                    <span className="text-muted font-mono">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="text-ink text-xs leading-relaxed break-words">{entry.message}</p>
                  {entry.pagePath && <p className="text-[11px] text-muted font-mono">{entry.pagePath}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
