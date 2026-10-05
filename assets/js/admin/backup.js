// BACKUP (somente administração): exporta todos os dados do portal num arquivo
// CRIPTOGRAFADO com senha (AES-256-GCM + PBKDF2 600.000 iterações), gerado no
// navegador. Sem a senha, o arquivo é ilegível — guarde a senha em local seguro.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, fmtDataHora, baixar } from '../core/dom.js';
import { avisar, avisarErro, ocupado } from '../core/ui.js';
import { CONFIG } from '../config.js';

const TABELAS = ['clients', 'profiles', 'assessments', 'self_assessments', 'operational_diagnoses', 'proposals', 'consents',
  'app_settings', 'client_documents', 'action_plans', 'action_plan_views', 'materials', 'material_access', 'audit_log'];
const ITERACOES = 600000;
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function chave(senha, sal) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITERACOES }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function cifrar(obj, senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(senha, sal), new TextEncoder().encode(JSON.stringify(obj))));
  return { formato: 'ELOGA-BACKUP-1', criado_em: new Date().toISOString(), kdf: { alg: 'PBKDF2-SHA256', iteracoes: ITERACOES, sal: b64(sal) }, cifra: 'AES-256-GCM', iv: b64(iv), dados: b64(dados) };
}
export async function decifrar(arquivo, senha) {
  if (arquivo?.formato !== 'ELOGA-BACKUP-1') throw new Error('Este arquivo não é um backup do Portal ELOGA.');
  try {
    const k = await chave(senha, deB64(arquivo.kdf.sal));
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(arquivo.iv) }, k, deB64(arquivo.dados));
    return JSON.parse(new TextDecoder().decode(claro));
  } catch { throw new Error('Senha incorreta ou arquivo alterado.'); }
}

async function todasAsLinhas(tabela, progresso) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const parte = await q(db.from(tabela).select('*').range(de, de + 999));
    linhas.push(...parte);
    progresso(`${tabela}: ${linhas.length} registro(s)`);
    if (parte.length < 1000) return linhas;
  }
}

export async function render(el) {
  const historico = await q(db.from('audit_log').select('at, actor_email, details').eq('action', 'backup.exportado').order('at', { ascending: false }).limit(10));
  montar(el, html`<div class="wrap" style="max-width:920px">
    <div class="page-head"><div><span class="eyebrow">Continuidade</span><h1>Backup</h1><p>Cópia completa e criptografada dos dados do portal.</p></div></div>
    <div class="grid g2">
      <div class="card"><h2>Gerar backup agora</h2>
        <p class="small muted">Inclui clientes, acessos (sem senhas), diagnósticos, propostas, consentimentos e auditoria. A logo dos clientes é opcional.</p>
        <form id="f-bkp" class="stack" novalidate>
          <div class="field"><label for="b-s1">Senha do backup (mínimo 12 caracteres)</label><input id="b-s1" type="password" autocomplete="new-password"></div>
          <div class="field"><label for="b-s2">Confirme a senha</label><input id="b-s2" type="password" autocomplete="new-password"></div>
          <label class="check"><input type="checkbox" id="b-logos" checked> Incluir logos dos clientes</label>
          <div class="notice warn small">Sem esta senha não há como abrir o backup. Guarde-a no seu gerenciador de senhas, separada do arquivo.</div>
          <p id="b-status" class="small muted" aria-live="polite" style="margin:0"></p>
          <button class="btn primary" type="submit">Gerar e baixar backup</button></form></div>
      <div class="card"><h2>Verificar um backup</h2>
        <p class="small muted">Confere se o arquivo abre com a senha e mostra o que ele contém. Nada é alterado no portal.</p>
        <form id="f-ver" class="stack" novalidate>
          <div class="field"><label for="v-arq">Arquivo .eloga-backup</label><input id="v-arq" type="file" accept=".eloga-backup,.json,application/json"></div>
          <div class="field"><label for="v-s">Senha</label><input id="v-s" type="password" autocomplete="off"></div>
          <button class="btn secondary" type="submit">Verificar</button>
          <div id="v-res"></div></form></div>
    </div>
    <div class="card" style="margin-top:16px"><h2>Onde guardar</h2>
      <ul class="small"><li><b>Regra 3-2-1:</b> 3 cópias, em 2 lugares diferentes, 1 fora do computador (ex.: Google Drive da ELOGA e um pendrive guardado).</li>
        <li><b>Frequência:</b> ao menos 1 vez por mês e sempre antes de excluir clientes em lote. O painel lembra você após ${CONFIG.lembreteBackupDias} dias.</li>
        <li><b>Backup automático (2 vezes por semana):</b> configure o fluxo do GitHub (docs/BACKUP.md). Ele copia o banco inteiro, criptografado, sem custo.</li>
        <li>Nunca envie o arquivo e a senha pelo mesmo canal.</li></ul></div>
    <div class="card" style="margin-top:16px"><h2>Últimos backups pelo portal</h2>
      ${historico.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Quando</th><th>Quem</th><th>Conteúdo</th></tr></thead><tbody>
        ${historico.map((h) => html`<tr><td>${fmtDataHora(h.at)}</td><td>${h.actor_email}</td><td class="small">${Object.entries(h.details?.registros || {}).map(([t, n]) => `${t}: ${n}`).join(' · ')}</td></tr>`)}</tbody></table></div>`
        : html`<p class="small muted">Nenhum backup gerado ainda.</p>`}</div></div>`);

  $('#f-bkp', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const s1 = $('#b-s1', el).value, s2 = $('#b-s2', el).value, st = $('#b-status', el);
    if (s1.length < 12) return avisar('Use uma senha com pelo menos 12 caracteres.', 'bad');
    if (s1 !== s2) return avisar('As senhas não coincidem.', 'bad');
    ocupado(e.submitter, async () => {
      try {
        const dados = { gerado_em: new Date().toISOString(), origem: location.origin + location.pathname, tabelas: {}, logos: {} };
        for (const t of TABELAS) dados.tabelas[t] = await todasAsLinhas(t, (m) => { st.textContent = 'Lendo ' + m; });
        if ($('#b-logos', el).checked) {
          for (const c of dados.tabelas.clients.filter((x) => x.logo_path)) {
            st.textContent = 'Copiando logo: ' + c.name;
            const { data: blob } = await db.storage.from('client-logos').download(c.logo_path);
            if (blob) dados.logos[c.logo_path] = { tipo: blob.type, base64: b64(new Uint8Array(await blob.arrayBuffer())) };
          }
        }
        st.textContent = 'Criptografando...';
        const cifrado = await cifrar(dados, s1);
        const nome = `ELOGA_backup_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.eloga-backup`;
        baixar(new Blob([JSON.stringify(cifrado)], { type: 'application/json' }), nome);
        const registros = Object.fromEntries(Object.entries(dados.tabelas).map(([t, l]) => [t, l.length]));
        await registrar('backup.exportado', { detalhes: { arquivo: nome, registros, logos: Object.keys(dados.logos).length } });
        st.textContent = 'Backup gerado: ' + nome;
        $('#b-s1', el).value = $('#b-s2', el).value = '';
        avisar('Backup baixado. Guarde o arquivo e a senha em locais diferentes.', 'ok');
      } catch (err) { st.textContent = ''; avisarErro(err); }
    });
  });

  $('#f-ver', el).addEventListener('submit', (e) => {
    e.preventDefault();
    const arq = $('#v-arq', el).files[0], senha = $('#v-s', el).value, res = $('#v-res', el);
    if (!arq || !senha) return avisar('Escolha o arquivo e informe a senha.', 'bad');
    ocupado(e.submitter, async () => {
      try {
        const dados = await decifrar(JSON.parse(await arq.text()), senha);
        montar(res, html`<div class="notice"><b>Backup íntegro.</b> Gerado em ${fmtDataHora(dados.gerado_em)}.
          <ul>${Object.entries(dados.tabelas).map(([t, l]) => html`<li>${t}: ${l.length} registro(s)</li>`)}<li>logos: ${Object.keys(dados.logos || {}).length}</li></ul></div>`);
      } catch (err) { montar(res, html`<div class="notice bad">${err.message}</div>`); }
    });
  });
}
