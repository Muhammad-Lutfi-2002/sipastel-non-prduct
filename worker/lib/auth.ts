// Verifies that a request carries a valid, currently-logged-in SIPASTEL
// staff session, by delegating token verification to Supabase Auth itself
// (the Worker never needs its own copy of the JWT signing secret).
//
// Used to gate destructive/admin-only operations (delete image, and
// uploads to any folder other than "designs"). The public custom-order
// design upload intentionally does NOT require this, to match the
// existing unauthenticated customer-facing flow.

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export interface VerifiedStaff {
  id: string;
  role: string;
}

export async function verifyStaffRequest(request: Request, env: Env): Promise<VerifiedStaff | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const accessToken = match[1];

  try {
    // 1) Ask Supabase Auth whose token this is (validates signature/expiry).
    const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!userRes.ok) return null;
    const user = (await userRes.json()) as { id?: string };
    if (!user?.id) return null;

    // 2) Confirm the user is a provisioned staff account (mirrors the
    // staff_profiles check the frontend already does after login).
    const profileRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/staff_profiles?id=eq.${user.id}&select=id,role`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    if (!profileRes.ok) return null;
    const rows = (await profileRes.json()) as { id: string; role: string }[];
    if (!rows.length) return null;

    return { id: rows[0].id, role: rows[0].role };
  } catch {
    return null;
  }
}
