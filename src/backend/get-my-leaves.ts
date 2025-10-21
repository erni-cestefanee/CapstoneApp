// @ts-nocheck
// Edge function: get-my-leaves
// This Deno-based edge function validates the incoming Authorization: Bearer <jwt>
// extracts the supabase auth user id (sub) and queries the `leave_applications`
// or `leave_balances` table using the SERVICE_ROLE key. Use the query param
// `?resource=balances|applications` to select which resource to fetch.
// Intended to be deployed to Supabase Edge Functions (Deno runtime).

function parseJwtPayload(jwt: string | null) {
  try {
    if (!jwt) return null;
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(b64);
    return JSON.parse(decoded);
  } catch (_e) {
    return null;
  }
}

function makeCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  let acao = '*';
  if (allowed.length > 0) {
    if (allowed.includes(origin)) acao = origin;
    else acao = 'null';
  }
  return new Headers({
    'Access-Control-Allow-Origin': acao,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Credentials': 'false',
  });
}

console.info('get-my-leaves function started');

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: makeCorsHeaders(req) });
    }

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'only GET allowed' }), { status: 405, headers: makeCorsHeaders(req) });
    }

    const authHeader = req.headers.get('authorization') || '';
    const m = authHeader.match(/^Bearer\s+(.+)$/);
    if (!m) {
      return new Response(JSON.stringify({ error: 'missing Authorization Bearer token' }), { status: 401, headers: makeCorsHeaders(req) });
    }

    const userJwt = m[1];
    const payload = parseJwtPayload(userJwt);
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: 'invalid JWT' }), { status: 401, headers: makeCorsHeaders(req) });
    }

    const callerUid = payload.sub as string;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500, headers: makeCorsHeaders(req) });
    }

    // Decide which resource to fetch: leave_applications (default) or leave_balances
    const urlObj = new URL(req.url);
    const resource = (urlObj.searchParams.get('resource') || 'applications').toLowerCase();

    let url = '';
    if (resource === 'balances' || resource === 'leave_balances') {
      // fetch the leave balances for the calling user
      url = `${SUPABASE_URL}/rest/v1/leave_balances?select=year,user_id,holiday_balance,birthday_balance,sick_balance,vacation_balance,parental_balance,holiday_allotted,birthday_allotted,sick_allotted,vacation_allotted,parental_allotted&user_id=eq.${encodeURIComponent(callerUid)}`;
    } else {
      // default: fetch leave applications for the calling user
      // select fields based on your schema
      url = `${SUPABASE_URL}/rest/v1/leave_applications?select=id,user_id,leave_type,start_date,end_date,reason,status,approver_id,created_at,updated_at&user_id=eq.${encodeURIComponent(callerUid)}`;
    }

    const r = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!r.ok) {
      const txt = await r.text();
      return new Response(JSON.stringify({ error: 'supabase query failed', detail: txt }), { status: 500, headers: makeCorsHeaders(req) });
    }

  const data = await r.json();
  const headers = makeCorsHeaders(req);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({ data }), { status: 200, headers });
  } catch (err) {
    console.error('get-my-leaves error', err);
    return new Response(JSON.stringify({ error: 'internal_server_error', detail: String(err) }), { status: 500, headers: makeCorsHeaders(req) });
  }
});
