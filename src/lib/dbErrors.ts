// Turns raw Supabase/PostgREST errors into messages a studio admin can act
// on, and centralises the "did this write actually change anything?" check.
//
// Why the second part matters: with Row Level Security enabled, an UPDATE or
// DELETE that the policy forbids does NOT return an error - PostgREST just
// reports "0 rows affected". Code that only looks at `error` therefore shows
// a success message while nothing was saved. Every write in storage.ts goes
// through `toMutationResult` so that case is surfaced as a permission error.

export interface MutationResult {
  success: boolean;
  error?: string;
}

interface PostgrestLikeError {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

const PERMISSION_MESSAGE = 'Anda tidak memiliki izin untuk melakukan tindakan ini.';

export function friendlyDbError(error: PostgrestLikeError | null | undefined): string {
  if (!error) return 'Terjadi kesalahan tak terduga.';
  const message = error.message ?? '';
  const lower = message.toLowerCase();

  switch (error.code) {
    case '42501': // insufficient_privilege / RLS violation
      return PERMISSION_MESSAGE;
    case '23505': // unique_violation
      return 'Data yang sama sudah ada. Muat ulang halaman lalu coba lagi.';
    case '23503': // foreign_key_violation
      return 'Data ini masih terhubung dengan data lain sehingga tidak bisa diubah/dihapus.';
    case '23514': // check_violation
    case '23502': // not_null_violation
    case '22P02': // invalid_text_representation
      return 'Data tidak memenuhi aturan validasi. Periksa kembali isian Anda.';
    case 'PGRST301': // JWT expired
    case 'PGRST303':
      return 'Sesi Anda telah berakhir. Silakan login kembali.';
    default:
      break;
  }

  if (lower.includes('row-level security') || lower.includes('permission denied')) return PERMISSION_MESSAGE;
  if (lower.includes('jwt expired')) return 'Sesi Anda telah berakhir. Silakan login kembali.';
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }
  // Business-rule errors raised on purpose by database triggers (RAISE
  // EXCEPTION) are written for humans - pass them through.
  if (error.code === 'P0001' && message) return message;

  return 'Terjadi kesalahan pada server. Coba lagi beberapa saat.';
}

/**
 * Converts the response of an UPDATE/DELETE issued with `.select()` into a
 * MutationResult, treating "no rows affected" as a permission/not-found
 * failure instead of a silent success.
 */
export function toMutationResult(
  response: { data: unknown[] | null; error: PostgrestLikeError | null },
  options: { notFoundMessage?: string } = {}
): MutationResult {
  if (response.error) {
    return { success: false, error: friendlyDbError(response.error) };
  }
  if (!response.data || response.data.length === 0) {
    return {
      success: false,
      error:
        options.notFoundMessage ??
        'Perubahan tidak tersimpan: data tidak ditemukan atau akun Anda tidak memiliki izin untuk mengubahnya.',
    };
  }
  return { success: true };
}
