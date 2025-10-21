// @ts-nocheck
function parseJwtPayload(jwt) {
  try {
    if (!jwt) return null;
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = atob(b64);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

function makeCorsHeaders(req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
  let acao = '*';
  if (allowed.length > 0) {
    if (allowed.includes(origin)) acao = origin;
    else acao = 'null';
  }
  return {
    'Access-Control-Allow-Origin': acao,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Credentials': 'false',
  };
}

console.info('admin-user-management function started');

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      const headers = makeCorsHeaders(req);
      return new Response(null, { status: 204, headers });
    }

    const corsHeaders = makeCorsHeaders(req);

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'only POST allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const authHeader = req.headers.get('authorization') || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/);
    if (!m) {
      return new Response(JSON.stringify({ error: 'missing Authorization Bearer token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const userJwt = m[1];
    const payload = parseJwtPayload(userJwt);
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: 'invalid JWT' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const callerUid = payload.sub;
    const body = await req.json().catch(() => ({}));

    if (!body.action) {
      return new Response(JSON.stringify({ error: 'action required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Verify caller is admin
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ p_user: callerUid }),
    });

    if (!checkRes.ok) {
      const txt = await checkRes.text();
      return new Response(JSON.stringify({ error: 'failed to verify admin status', detail: txt }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const isAdminText = (await checkRes.text()).trim();
    const isAdmin = isAdminText === 't' || isAdminText === 'true' || isAdminText === '1';

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'caller is not admin' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // LIST action: fetch from users table (exclude the admin caller)
    if (body.action === 'list') {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,created_at,roles&id=neq.${callerUid}`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const users = await r.json();
      return new Response(JSON.stringify({ users }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // DELETE: remove from BOTH auth and users table
    if (body.action === 'delete') {
      const target = body.target_user;
      if (!target) {
        return new Response(JSON.stringify({ error: 'target_user required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (target === callerUid) {
        return new Response(JSON.stringify({ error: 'cannot delete yourself' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Delete from auth
      const delAuthRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      if (!delAuthRes.ok) {
        const txt = await delAuthRes.text();
        throw new Error(`delete auth user failed: ${delAuthRes.status} ${txt}`);
      }

      // Delete from users table
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${target}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });

      return new Response(JSON.stringify({ status: 'ok', action: 'deleted', target }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ADD_ROLE / REMOVE_ROLE: update users table only
    if (body.action === 'add_role' || body.action === 'remove_role') {
      const target = body.target_user;
      if (!target) {
        return new Response(JSON.stringify({ error: 'target_user required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      if (!body.role) {
        return new Response(JSON.stringify({ error: 'role required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // For roles array: add or remove role from the array
      const newRoles = body.action === 'add_role' ? [body.role] : [];
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${target}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ roles: newRoles }),
      });

      if (!patchRes.ok) {
        const txt = await patchRes.text();
        throw new Error(`update roles failed: ${patchRes.status} ${txt}`);
      }

      const patched = await patchRes.json();
      return new Response(JSON.stringify({ status: 'ok', action: body.action, target, result: patched }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // REPLACE_ROLES (if using array column)
    if (body.action === 'replace_roles') {
      const target = body.target_user;
      if (!target) {
        return new Response(JSON.stringify({ error: 'target_user required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      if (!Array.isArray(body.roles)) {
        return new Response(JSON.stringify({ error: 'roles array required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${target}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ roles: body.roles }),
      });

      if (!patchRes.ok) {
        const txt = await patchRes.text();
        throw new Error(`replace roles failed: ${patchRes.status} ${txt}`);
      }

      const patched = await patchRes.json();
      return new Response(JSON.stringify({ status: 'ok', action: 'replaced_roles', target, result: patched }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('admin function error', err);
    const corsHeaders = makeCorsHeaders(req);
    return new Response(JSON.stringify({ error: 'internal_server_error', detail: String(err.message || err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});