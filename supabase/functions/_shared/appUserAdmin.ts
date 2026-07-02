import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function cleanEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function cleanRole(value: unknown) {
  const role = String(value || 'team').trim().toLowerCase();
  return ['admin', 'team', 'client'].includes(role) ? role : 'team';
}

function normalizeUserShape(profile: any, email: string, companyIds: string[] = []) {
  const notificationPrefs = profile?.notification_prefs || {};
  return {
    id: profile.id,
    role: profile.role,
    name: profile.display_name,
    email: email || profile.username,
    username: profile.username,
    password: '',
    active: profile.active !== false,
    avatar: profile.avatar_url || '',
    title: profile.title || '',
    companyIds,
    visibleStatuses: profile.visible_statuses || [],
    notificationPrefs: notificationPrefs.events || [],
    notificationStatusPrefs: notificationPrefs.statuses || {},
    organizationId: profile.organization_id,
    createdAt: profile.created_at,
  };
}

async function findAuthUserByEmail(admin: any, email: string) {
  const target = cleanEmail(email);
  if (!target) return null;

  // Supabase Admin API ainda não tem lookup por e-mail estável em todas as versões.
  // Paginação pequena resolve bem para o painel atual e evita depender de fallback quebrado.
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data?.users?.find((user: any) => cleanEmail(user.email) === target);
    if (found) return found;
    if (!data?.users || data.users.length < 1000) break;
  }

  return null;
}

async function getCallerProfile(admin: any, req: Request) {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    throw Object.assign(new Error('Sessão ausente. Faça login novamente antes de criar usuários.'), { status: 401 });
  }

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    throw Object.assign(new Error('Sessão inválida ou expirada. Faça login novamente.'), { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw Object.assign(new Error('Perfil do usuário logado não encontrado.'), { status: 403 });
  }

  if (profile.active === false || profile.role !== 'admin') {
    throw Object.assign(new Error('Apenas administradores ativos podem gerenciar usuários.'), { status: 403 });
  }

  if (!profile.organization_id) {
    throw Object.assign(new Error('Seu perfil admin está sem organization_id. Corrija o perfil antes de criar usuários.'), { status: 400 });
  }

  return profile;
}

function getPayloadUser(body: any) {
  return body?.user && typeof body.user === 'object' ? body.user : body || {};
}

function getOrganizationId(body: any, user: any, callerProfile: any) {
  const raw =
    body?.organizationId ||
    body?.organization_id ||
    user?.organizationId ||
    user?.organization_id ||
    callerProfile?.organization_id;

  const orgId = String(raw || '').trim();
  if (!UUID_RE.test(orgId)) {
    throw Object.assign(new Error('organization_id inválido ou ausente.'), { status: 400 });
  }
  return orgId;
}

async function syncClientCompanyAccess(admin: any, organizationId: string, profileId: string, companyIds: unknown) {
  const ids = Array.isArray(companyIds)
    ? companyIds.map(String).filter((id) => UUID_RE.test(id))
    : [];

  await admin.from('client_company_access').delete().eq('profile_id', profileId);

  if (!ids.length) return;

  const rows = ids.map((company_id) => ({
    organization_id: organizationId,
    profile_id: profileId,
    company_id,
  }));

  const { error } = await admin.from('client_company_access').insert(rows);
  if (error) throw error;
}

async function loadClientCompanyIds(admin: any, profileId: string) {
  const { data, error } = await admin
    .from('client_company_access')
    .select('company_id')
    .eq('profile_id', profileId);

  if (error) return [];
  return (data || []).map((row: any) => row.company_id).filter(Boolean);
}

async function createOrRepairUser(admin: any, body: any, callerProfile: any) {
  const user = getPayloadUser(body);
  const email = cleanEmail(user.email || user.username);
  const password = String(user.password || '').trim();
  const role = cleanRole(user.role);
  const organizationId = getOrganizationId(body, user, callerProfile);

  if (!email) throw Object.assign(new Error('Informe o e-mail/login do usuário.'), { status: 400 });
  if (!password) throw Object.assign(new Error('Informe a senha inicial do usuário.'), { status: 400 });

  let authUser = await findAuthUserByEmail(admin, email);

  if (authUser?.id) {
    // Caso clássico do Heli: apagou tabela pública, mas o Auth ainda segurou o e-mail.
    // A criação vira reparo, e a senha é atualizada para a senha preenchida no painel.
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: user.name || email,
        role,
      },
    });
    if (error) throw error;
    authUser = data.user || authUser;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: user.name || email,
        role,
      },
    });
    if (error) throw error;
    authUser = data.user;
  }

  // Remove perfil órfão com o mesmo login antes do upsert.
  // Isso cobre o caso em que o Auth segurou o e-mail, mas a tabela pública ficou desencontrada.
  const { data: staleProfiles } = await admin
    .from('profiles')
    .select('id')
    .eq('username', email)
    .neq('id', authUser.id);

  const staleIds = (staleProfiles || []).map((row: any) => row.id).filter(Boolean);
  if (staleIds.length) {
    await admin.from('client_company_access').delete().in('profile_id', staleIds);
    await admin.from('profiles').delete().in('id', staleIds);
  }

  const profileRow = {
    id: authUser.id,
    organization_id: organizationId,
    username: email,
    display_name: String(user.name || email).trim(),
    role,
    title: String(user.title || '').trim(),
    active: user.active !== false,
    avatar_url: String(user.avatar || user.avatar_url || '').trim(),
    visible_statuses: Array.isArray(user.visibleStatuses) ? user.visibleStatuses : [],
    notification_prefs: {
      events: Array.isArray(user.notificationPrefs) ? user.notificationPrefs : [],
      statuses: user.notificationStatusPrefs || {},
    },
    updated_at: new Date().toISOString(),
  };

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .upsert(profileRow, { onConflict: 'id' })
    .select('*')
    .single();

  if (profileError) throw profileError;

  await syncClientCompanyAccess(admin, organizationId, authUser.id, user.companyIds);

  return {
    ok: true,
    mode: authUser.created_at === authUser.updated_at ? 'created' : 'repaired',
    user: normalizeUserShape(profile, email, Array.isArray(user.companyIds) ? user.companyIds : []),
  };
}

async function updateUser(admin: any, body: any, callerProfile: any) {
  const user = getPayloadUser(body);
  const id = String(user.id || '').trim();
  if (!UUID_RE.test(id)) throw Object.assign(new Error('ID de usuário inválido.'), { status: 400 });

  const organizationId = getOrganizationId(body, user, callerProfile);
  const email = cleanEmail(user.email || user.username);
  const role = cleanRole(user.role);

  const patch: any = {
    organization_id: organizationId,
    display_name: String(user.name || user.display_name || email || 'Usuário').trim(),
    role,
    title: String(user.title || '').trim(),
    active: user.active !== false,
    avatar_url: String(user.avatar || user.avatar_url || '').trim(),
    visible_statuses: Array.isArray(user.visibleStatuses) ? user.visibleStatuses : [],
    notification_prefs: {
      events: Array.isArray(user.notificationPrefs) ? user.notificationPrefs : [],
      statuses: user.notificationStatusPrefs || {},
    },
    updated_at: new Date().toISOString(),
  };

  if (email) patch.username = email;

  const { data: profile, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
      user_metadata: { display_name: patch.display_name, role },
    });
    if (authError) throw authError;
  }

  await syncClientCompanyAccess(admin, organizationId, id, user.companyIds);
  const companyIds = Array.isArray(user.companyIds) ? user.companyIds : await loadClientCompanyIds(admin, id);

  return { ok: true, user: normalizeUserShape(profile, email, companyIds) };
}

async function deleteUser(admin: any, body: any) {
  const user = getPayloadUser(body);
  const id = String(user.id || '').trim();
  const email = cleanEmail(user.email || user.username);
  let authId = UUID_RE.test(id) ? id : '';

  if (!authId && email) {
    const found = await findAuthUserByEmail(admin, email);
    authId = found?.id || '';
  }

  if (!authId) throw Object.assign(new Error('Informe o ID ou e-mail do usuário para excluir.'), { status: 400 });

  await admin.from('client_company_access').delete().eq('profile_id', authId);
  await admin.from('profiles').delete().eq('id', authId);

  const { error } = await admin.auth.admin.deleteUser(authId);
  if (error && !String(error.message || '').toLowerCase().includes('not found')) throw error;

  return { ok: true };
}

async function resetPassword(admin: any, body: any) {
  const user = getPayloadUser(body);
  const password = String(user.password || body?.password || '').trim();
  const id = String(user.id || '').trim();
  const email = cleanEmail(user.email || user.username);

  if (!password) throw Object.assign(new Error('Informe a nova senha.'), { status: 400 });

  let authId = UUID_RE.test(id) ? id : '';
  if (!authId && email) {
    const found = await findAuthUserByEmail(admin, email);
    authId = found?.id || '';
  }

  if (!authId) throw Object.assign(new Error('Usuário não encontrado no Supabase Auth.'), { status: 404 });

  const { error } = await admin.auth.admin.updateUserById(authId, { password });
  if (error) throw error;

  return { ok: true };
}

export async function handleAppUserRequest(req: Request, forcedAction?: string) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw Object.assign(new Error('Edge Function sem SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.'), { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'argos-manage-app-user-round87' } },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(forcedAction || body?.action || 'create').trim().toLowerCase();
    const callerProfile = await getCallerProfile(admin, req);

    console.log(`manage-app-user round87 action=${action} caller=${callerProfile.id} org=${callerProfile.organization_id}`);

    if (action === 'create' || action === 'repair') return json(await createOrRepairUser(admin, body, callerProfile));
    if (action === 'update') return json(await updateUser(admin, body, callerProfile));
    if (action === 'delete') return json(await deleteUser(admin, body));
    if (action === 'reset_password') return json(await resetPassword(admin, body));

    return json({ error: `Ação inválida: ${action}` }, 400);
  } catch (err) {
    const status = Number((err as any)?.status) || Number((err as any)?.statusCode) || 500;
    const message = (err as any)?.message || String(err);
    console.error('manage-app-user round87 error:', message, err);
    return json({ error: message }, status >= 400 && status < 600 ? status : 500);
  }
}
