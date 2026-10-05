// Supabase FALSO para testes de tela (Playwright intercepta as chamadas).
// Não substitui os testes de segurança no banco real (ver docs/SEGURANCA.md).
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function jwt(claims) { return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.assinatura-falsa`; }

export function criarBanco() {
  const agora = new Date().toISOString();
  return {
    clients: [], profiles: [], assessments: [], self_assessments: [], operational_diagnoses: [], proposals: [], consents: [], audit_log: [],
    app_settings: [], client_documents: [], action_plans: [], action_plan_views: [], materials: [], material_access: [],
    usuarios: {}, seq: 0, agora,
  };
}

function filtrar(linhas, params) {
  let r = [...linhas];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(eq|neq|gte|lte|like|ilike|in)\.(.*)$/s.exec(v);
    if (!m) continue;
    const [, op, val] = m;
    r = r.filter((x) => {
      const c = x[k] === null || x[k] === undefined ? '' : String(x[k]);
      if (op === 'eq') return c === val;
      if (op === 'neq') return c !== val;
      if (op === 'gte') return c >= val;
      if (op === 'lte') return c <= val;
      if (op === 'like' || op === 'ilike') { const re = new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*') + '$', op === 'ilike' ? 'i' : ''); return re.test(c); }
      if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').includes(c);
      return true;
    });
  }
  const ord = params.get('order');
  if (ord) { const [col, dir] = ord.split('.'); r.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === 'desc' ? -1 : 1)); }
  return r;
}

export async function ligar(page, banco, usuarioAtual) {
  const log = [];
  await page.route(/skatnnwkxcbzmoohexsx\.supabase\.co/, async (route) => {
    const req = route.request(), url = new URL(req.url()), metodo = req.method();
    const corpo = req.postData() ? (() => { try { return JSON.parse(req.postData()); } catch { return req.postData(); } })() : null;
    const json = (status, obj, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: obj === undefined ? '' : JSON.stringify(obj) });
    const p = url.pathname;
    log.push(`${metodo} ${p}${url.search}`);
    if (metodo === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });

    // ---------------- auth
    if (p === '/auth/v1/token') {
      const u = banco.usuarios[corpo?.email];
      if (!u || u.senha !== corpo.password) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      usuarioAtual.u = u;
      return json(200, sessao(u));
    }
    if (p === '/auth/v1/user' && metodo === 'GET') return usuarioAtual.u ? json(200, usuarioJson(usuarioAtual.u)) : json(401, { msg: 'not authenticated' });
    if (p === '/auth/v1/user' && metodo === 'PUT') { if (corpo.password) usuarioAtual.u.senha = corpo.password; return json(200, usuarioJson(usuarioAtual.u)); }
    if (p === '/auth/v1/logout') { usuarioAtual.u = null; return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }); }
    if (p.startsWith('/auth/v1/factors')) {
      if (p.endsWith('/challenge')) return json(200, { id: 'ch1', type: 'totp', expires_at: Date.now() / 1000 + 300 });
      if (p.endsWith('/verify')) { usuarioAtual.u.aal = 'aal2'; usuarioAtual.u.fatores = [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'teste', created_at: banco.agora, updated_at: banco.agora }]; return json(200, sessao(usuarioAtual.u)); }
      return json(200, { id: 'f1', type: 'totp', friendly_name: corpo?.friendly_name, totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>', secret: 'ABCDEF', uri: 'otpauth://x' } });
    }

    // ---------------- rpc
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.split('/').pop();
      if (fn === 'log_event') { banco.audit_log.push({ id: ++banco.seq, at: new Date().toISOString(), actor_email: usuarioAtual.u?.email, action: corpo.p_action, client_id: corpo.p_client_id, details: corpo.p_details }); return json(200, null); }
      if (fn === 'admin_next_proposal_code') return json(200, 'ELG-2026-' + String(banco.proposals.length + 1).padStart(3, '0'));
      if (fn === 'admin_auth_events') return json(200, [{ at: banco.agora, action: 'login', actor: 'admin@eloga.test', ip: '127.0.0.1' }]);
      if (fn === 'my_mark_password_changed') { const pf = banco.profiles.find((x) => x.user_id === usuarioAtual.u.id); if (pf) pf.must_change_password = false; return json(200, null); }
      if (fn === 'admin_reset_assessment') { banco.assessments = banco.assessments.filter((a) => a.client_id !== corpo.p_client_id); return json(200, null); }
      return json(404, { message: 'função ' + fn });
    }

    // ---------------- tabelas
    if (p.startsWith('/rest/v1/')) {
      const tabela = p.split('/').pop();
      if (!banco[tabela]) return json(404, { message: 'tabela ' + tabela });
      const umObjeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (metodo === 'GET' || metodo === 'HEAD') {
        const linhas = filtrar(banco[tabela], url.searchParams);
        const lim = url.searchParams.get('limit'), off = +(url.searchParams.get('offset') || 0);
        const range = req.headers()['range'];
        let out = linhas;
        if (range) { const [a, b] = range.split('-').map(Number); out = linhas.slice(a, b + 1); }
        else out = linhas.slice(off, lim ? off + +lim : undefined);
        const hdr = { 'content-range': `0-${Math.max(0, out.length - 1)}/${linhas.length}` };
        if (metodo === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', ...hdr } });
        if (umObjeto) return out.length ? json(200, out[0], hdr) : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        return json(200, out, hdr);
      }
      if (metodo === 'POST') {
        const CHAVES = { app_settings: ['key'], action_plans: ['client_id'], action_plan_views: ['client_id'], client_documents: ['client_id', 'tipo'], material_access: ['material_id', 'client_id'] };
        if ((req.headers()['prefer'] || '').includes('merge-duplicates') && CHAVES[tabela]) {
          const ks = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean).length ? url.searchParams.get('on_conflict').split(',') : CHAVES[tabela];
          const saida = [];
          for (const x of (Array.isArray(corpo) ? corpo : [corpo])) {
            const ex = banco[tabela].find((r) => ks.every((k) => r[k] === x[k]));
            if (ex) { Object.assign(ex, x); saida.push(ex); } else { const n = { id: crypto.randomUUID(), ...x }; banco[tabela].push(n); saida.push(n); }
          }
          return json(201, umObjeto ? saida[0] : saida);
        }
        const itens = (Array.isArray(corpo) ? corpo : [corpo]).map((x) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...x }));
        if (tabela === 'assessments') itens.forEach((x) => { x.created_by = usuarioAtual.u.id; x.status = 'draft'; });
        banco[tabela].push(...itens);
        return json(201, umObjeto ? itens[0] : itens);
      }
      if (metodo === 'PATCH') {
        const alvo = filtrar(banco[tabela], url.searchParams);
        for (const x of alvo) {
          if (tabela === 'assessments' && x.status !== 'draft' && usuarioAtual.u.role !== 'admin') return json(403, { code: '42501', message: 'O diagnóstico já foi enviado e não pode ser alterado.' });
          Object.assign(x, corpo, { updated_at: new Date().toISOString() });
          if (tabela === 'assessments' && corpo.status === 'submitted') x.submitted_at = new Date().toISOString();
        }
        return json(200, umObjeto ? alvo[0] : alvo);
      }
      if (metodo === 'DELETE') { banco[tabela] = banco[tabela].filter((x) => !filtrar([x], url.searchParams).length); return json(204); }
    }

    // ---------------- storage e funções
    if (p.startsWith('/storage/')) return json(404, { message: 'not found' });
    if (p.startsWith('/functions/v1/')) {
      const nome = p.split('/').pop();
      if (nome === 'admin-clientes' && corpo.acao === 'criar_acesso') {
        const uid = crypto.randomUUID();
        banco.usuarios[corpo.email] = { id: uid, email: corpo.email, senha: 'Temp-12345!x', role: 'client', aal: 'aal1', fatores: [] };
        banco.profiles.push({ user_id: uid, role: 'client', client_id: corpo.client_id, must_change_password: true });
        const c = banco.clients.find((x) => x.id === corpo.client_id); c.access_email = corpo.email; c.access_expires_at = corpo.access_expires_at;
        return json(200, { ok: true, senha_temporaria: 'Temp-12345!x', email: corpo.email });
      }
      return json(200, { ok: true });
    }
    return json(404, { message: 'rota não simulada ' + p });
  });
  return log;

  function usuarioJson(u) {
    return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: banco.agora, factors: u.fatores };
  }
  function sessao(u) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return { access_token: jwt({ sub: u.id, email: u.email, role: 'authenticated', aal: u.aal, amr: [{ method: 'password', timestamp: exp - 3600 }], exp, session_id: 's1' }),
      refresh_token: 'r1', token_type: 'bearer', expires_in: 3600, expires_at: exp, user: usuarioJson(u) };
  }
}
