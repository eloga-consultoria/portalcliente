// Relatório de Diagnóstico (integrado: autodiagnóstico + sessão de 45 min) e Proposta comercial.
// Layout fiel ao modelo aprovado "ELOGA | Diagnóstico Operacional". Saída: HTML seguro para tela e impressão.
import { html, confiavel } from '../core/dom.js';
import { CATALOG, FRONT_KEYS, QA, QC, num, avaliar, candidatas, situacaoDados, precoOpcao, semearOpcoes, somarDias } from '../admin/operacional-modelo.js';
import { LEVELS, READ, levelOf } from '../import/autodiagnostico-modelo.js';
import { ROTULOS_CAMPOS } from '../import/leitores.js';

const fmt = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const hoje = () => new Date().toISOString().slice(0, 10);

/** Trecho editável direto no documento (o texto alterado fica salvo no diagnóstico). */
function ed(state, chave, padrao) {
  const v = state.report.edits[chave];
  return html`<span class="editable" contenteditable="true" data-ed="${chave}">${v != null ? v : padrao}</span>`;
}

function capa(titulo1, titulo2, cliente, logo, meta) {
  return html`<div class="cover">
    <div class="logos"><div class="brand">EL<b>O</b>GA<small>Consultoria &amp; Estratégias em Saúde</small></div>
      ${logo ? html`<span class="x">×</span><img src="${logo}" alt="Logo ${cliente.name}">` : ''}</div>
    <h1>${titulo1}<br><em>${titulo2}</em></h1>
    <div class="meta">${meta}</div></div><div class="bar"></div>`;
}

const NIVEL_CLASSE = ['p-bad', 'p-warn', 'p-ok', 'p-ok'];

function radar(state) {
  const vals = FRONT_KEYS.map((k) => num(state.auto.pillars[k]) ?? 0), N = 6, cx = 160, cy = 150, R = 105;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / N; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const f = (n) => n.toFixed(1);
  let g = '';
  [25, 50, 75, 100].forEach((l) => { g += `<polygon points="${[...Array(N)].map((_, i) => pt(i, R * l / 100).map(f).join(',')).join(' ')}" fill="none" stroke="#dfe5ec"/>`; });
  for (let i = 0; i < N; i++) { const [x, y] = pt(i, R); g += `<line x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}" stroke="#dfe5ec"/>`; }
  g += `<polygon points="${vals.map((v, i) => pt(i, R * v / 100).map(f).join(',')).join(' ')}" fill="rgba(91,23,250,.18)" stroke="#5B17FA" stroke-width="2"/>`;
  vals.forEach((v, i) => { const [x, y] = pt(i, R * v / 100); g += `<circle cx="${f(x)}" cy="${f(y)}" r="3.5" fill="#5B17FA"/>`; });
  ['Faturamento', 'Financeiro', 'Comercial', 'Agenda', 'Experiência', 'Regulatório'].forEach((l, i) => {
    const [x, y] = pt(i, R + 22); const anc = Math.abs(x - cx) < 5 ? 'middle' : x > cx ? 'start' : 'end';
    const v = state.auto.pillars[FRONT_KEYS[i]];
    g += `<text x="${f(x)}" y="${f(y + 4)}" font-size="11" font-family="Manrope" font-weight="700" fill="#0B2032" text-anchor="${anc}">${l}</text>`
       + `<text x="${f(x)}" y="${f(y + 17)}" font-size="10.5" font-family="Manrope" fill="#5d6b7a" text-anchor="${anc}">${v === '' || v == null ? '—' : Number(v)}</text>`;
  });
  // Somente números e rótulos fixos entram no SVG: seguro para inserir.
  return confiavel(`<svg viewBox="-45 0 410 310" width="100%" role="img" aria-label="Radar de maturidade por pilar">${g}</svg>`);
}

function resumoAuto(state, cliente, ev) {
  const lv = state.auto.level || '—', fr = ev.front ? CATALOG.fronts[ev.front].name : 'a frente prioritária';
  const low = candidatas(state).map((k) => CATALOG.fronts[k].name.toLowerCase());
  return `${cliente.name || 'A clínica'} apresenta nível de maturidade "${lv}"${state.auto.overall !== '' ? ` (nota ${state.auto.overall}/100)` : ''} no autodiagnóstico. `
    + (low.length ? `Os pilares com maior fragilidade são ${low.join(' e ')}. ` : '')
    + `A sessão de diagnóstico indicou ${fr.toLowerCase()} como frente prioritária de atuação.`;
}

// ===================================================================== RELATÓRIO
export function relatorioHtml({ state, cliente, autodiag, logo }) {
  const ev = avaliar(state), st = situacaoDados(state, ev), F = CATALOG.formats;
  const achados = state.matrix.findings.filter((f) => f.t.trim());
  const recs = state.matrix.quickwins.filter((q) => q.trim());
  const contexto = QA.map((p, i) => [p, state.session.A[i]]).filter(([, r]) => String(r || '').trim());
  const perfil = autodiag ? Object.entries({ ...(autodiag.identification?.estrutura || {}) })
    .filter(([, v]) => (Array.isArray(v) ? v.length : String(v || '').trim()))
    .map(([k, v]) => [ROTULOS_CAMPOS['estrutura.' + k] || k, Array.isArray(v) ? v.join(', ') : v]) : [];
  const prioridades = autodiag?.priorities || [];
  const naoSei = autodiag?.unknowns || [];
  let n = 0; const sec = () => ++n;

  return html`
  ${capa('Relatório de', 'Diagnóstico Operacional', cliente, logo,
    html`<b>${cliente.name}</b>${cliente.city ? ' · ' + cliente.city : ''}<br>
      ${state.auto.date ? html`Autodiagnóstico: ${fmt(state.auto.date)} · ` : ''}Sessão de diagnóstico: ${fmt(state.client.sessionDate)} · Emitido em ${fmt(hoje())}<br>Responsável técnica: Helle Machado`)}
  <div class="page">
    <h2><span class="num">${sec()}</span>Resumo executivo</h2>
    <p class="exec">${ed(state, 'exec', state.matrix.exec.trim() || resumoAuto(state, cliente, ev))}</p>
    <div class="kpis">
      <div class="kpi"><small>Nota geral</small><b>${state.auto.overall === '' ? '—' : state.auto.overall + '/100'}</b></div>
      <div class="kpi"><small>Nível de maturidade</small><b>${state.auto.level || '—'}</b></div>
      <div class="kpi"><small>Frente prioritária</small><b style="font-size:17px">${ev.front ? CATALOG.fronts[ev.front].name : '—'}</b></div>
    </div>

    <h2><span class="num">${sec()}</span>Maturidade por pilar</h2>
    <div class="radar-wrap avoid"><div>${radar(state)}</div>
      <div><p>O radar consolida as notas do autodiagnóstico preenchido pela gestão, de 0 a 100 por pilar. Quanto mais próximo da borda, mais estruturado o pilar.</p>
      <p class="hint">Faixas: abaixo de 40 inicial · 40 a 59 em estruturação · 60 a 79 estruturada · 80 ou mais orientada por dados.</p></div></div>

    <h2 class="pb"><span class="num">${sec()}</span>Leitura por pilar</h2>
    <table class="t avoid"><thead><tr><th style="width:28%">Pilar</th><th style="width:20%">Nota</th><th>Leitura</th></tr></thead><tbody>
    ${FRONT_KEYS.map((k) => {
      const v = num(state.auto.pillars[k]); const l = v === null ? null : levelOf(v);
      return html`<tr><td><b>${CATALOG.fronts[k].pillar}</b>${ev.front === k ? html` <span class="pill p-top">prioritária</span>` : ''}</td>
        <td>${v === null ? '—' : v} ${l === null ? '' : html`<span class="pill ${NIVEL_CLASSE[l]}">${LEVELS[l].name}</span>`}</td>
        <td>${ed(state, 'pil_' + k, l === null ? '—' : READ[k][l])}</td></tr>`;
    })}</tbody></table>

    ${autodiag ? html`
    <h2 class="pb"><span class="num">${sec()}</span>O que o autodiagnóstico revelou</h2>
    ${prioridades.length ? html`<p>As três prioridades apontadas pelas respostas da gestão, com as respostas literais:</p>
      ${prioridades.map((p, i) => html`<div class="prio avoid"><b>${i + 1}. ${CATALOG.fronts[p.id]?.pillar || p.id}</b> <span class="hint">· ${p.nota ?? '—'}/100</span>
        ${(p.itens || []).map((it) => html`<p class="quote">Respondeu “${it.rotulo}” para: ${it.t}</p>`)}</div>`)}` : ''}
    ${naoSei.length ? html`<h3>O que a operação ainda não enxerga</h3><p>Itens marcados como “Não sei”: mostram onde faltam dados para decidir com segurança.</p>
      <ul class="ck">${naoSei.map((x) => html`<li><b>${x.pillar}:</b> ${x.t}</li>`)}</ul>` : ''}
    ${perfil.length ? html`<h3>Perfil da operação declarado</h3><table class="t avoid"><tbody>${perfil.map(([r, v]) => html`<tr><td style="width:36%"><b>${r}</b></td><td>${v}</td></tr>`)}</tbody></table>` : ''}` : ''}

    ${contexto.length ? html`
    <h2><span class="num">${sec()}</span>Contexto da operação</h2>
    <table class="t avoid"><tbody>${contexto.map(([p, r]) => html`<tr><td style="width:40%"><b>${p}</b></td><td>${r}</td></tr>`)}</tbody></table>` : ''}

    <h2><span class="num">${sec()}</span>Principais achados</h2>
    ${achados.length ? html`<table class="t avoid"><thead><tr><th style="width:6%">#</th><th>Achado</th><th style="width:26%">Impacto estimado</th></tr></thead><tbody>
      ${achados.map((f, i) => html`<tr><td>${i + 1}</td><td>${f.t}</td><td>${f.i || 'A medir na linha de base'}</td></tr>`)}</tbody></table>`
      : html`<p class="empty">Registre os achados na aba Matriz.</p>`}

    <h2><span class="num">${sec()}</span>Recomendações imediatas</h2>
    <p>Ações que a gestão pode iniciar desde já, sem custo adicional:</p>
    ${recs.length ? html`<ul class="ck">${recs.map((x) => html`<li>${x}</li>`)}</ul>` : html`<p class="empty">Registre as recomendações na aba Matriz.</p>`}

    <h2><span class="num">${sec()}</span>Situação dos dados</h2>
    <p><span class="pill ${st[0] === 'apto' ? 'p-ok' : 'p-warn'}">${st[1]}</span></p>
    <p>${ed(state, 'data', st[2])}</p>
    ${state.session.C.some((x) => x.n || x.v) ? html`<table class="t avoid"><thead><tr><th>Verificação</th><th style="width:14%">Situação</th><th>Detalhe</th></tr></thead><tbody>
      ${QC.map((p, i) => html`<tr><td>${p}</td><td>${({ sim: 'Sim', parcial: 'Parcial', nao: 'Não' })[state.session.C[i].v] || '—'}</td><td>${state.session.C[i].n}</td></tr>`)}</tbody></table>` : ''}

    <h2><span class="num">${sec()}</span>Caminho recomendado</h2>
    <div class="callout avoid">
      <p>Frente prioritária: <b>${ev.front ? CATALOG.fronts[ev.front].name : '—'}</b></p>
      <p>Formato recomendado: <b>${ev.format ? F[ev.format].name : '—'}</b></p>
      <p style="margin-top:8px;color:#d7e1ea">${ed(state, 'path', ev.format ? F[ev.format].desc : '')}</p></div>
    ${state.matrix.goal3m.trim() ? html`<p><b>Objetivo declarado pela gestão para os próximos 3 meses:</b> “${state.matrix.goal3m}”</p>` : ''}
    <p>As condições, o escopo e o investimento estão detalhados na proposta comercial, apresentada na devolutiva${state.session.devolutiva ? ' (' + state.session.devolutiva + ')' : ''}.</p>
  </div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Documento confidencial · ${cliente.name}</span></div>`;
}

// ===================================================================== PROPOSTA
function cartaoOpcao(o, i) {
  const f = CATALOG.formats[o.type]; if (!f) return '';
  const pr = precoOpcao(o), frs = o.fronts.map((k) => CATALOG.fronts[k].name);
  let preco, sub;
  if (o.type === 'kit') { preco = html`${brl(pr.once)} <small>pagamento único</small>`; sub = html`${frs.length ? 'Frente: ' + frs.join(', ') : ''}`; }
  else if (o.type === 'analise') { preco = html`${brl(pr.once)} <small>valor único</small>`; sub = html`${frs.length ? 'Frente: ' + frs.join(', ') + ' · ' : ''}abatido do programa se contratado em até 30 dias`; }
  else {
    preco = html`${brl(pr.monthly)} <small>/mês</small>`;
    sub = html`${o.type === 'programa' && frs.length ? html`Frentes: ${frs.join(', ')}<br>` : ''}Duração: ${pr.months} meses · total ${brl(pr.monthly * pr.months)}${pr.once ? ' + implantação de sistema ' + brl(pr.once) : ''}`;
  }
  const itens = [...f.items];
  if (o.system && (o.type === 'programa' || o.type === 'autonomo')) itens.push('Implantação de sistema: ' + CATALOG.system.items.join(', ').toLowerCase());
  return html`<div class="opt ${o.recommended ? 'rec' : ''} avoid">${o.recommended ? html`<span class="rib">RECOMENDADA</span>` : ''}
    <div class="sub">Opção ${i + 1}</div><h4>${f.name}</h4><p class="sub">${f.desc}</p>
    <div class="price">${preco}</div><p class="sub">${sub}</p>
    <ul class="ck" style="font-size:12.5px">${itens.map((x) => html`<li>${x}</li>`)}</ul></div>`;
}

export function propostaHtml({ state, cliente, logo, editavel = true }) {
  semearOpcoes(state);
  const P = state.proposal, ev = avaliar(state), opts = P.options.filter((o) => o.type);
  const validade = somarDias(P.date, P.validity);
  const frentes = [...new Set(opts.flatMap((o) => (o.type === 'autonomo' ? ['fat', 'age', 'exp', 'reg'] : o.fronts)))];
  const temPrograma = opts.some((o) => o.type === 'programa' || o.type === 'autonomo');
  const temSistema = opts.some((o) => o.system);
  const achados = state.matrix.findings.filter((f) => f.t.trim()).slice(0, 3);
  const E = editavel ? (k, d) => ed(state, k, d) : (k, d) => html`${state.report.edits[k] ?? d}`;
  let n = 0; const sec = () => ++n;

  return html`
  ${capa('Proposta de', 'Consultoria', cliente, logo,
    html`<b>${cliente.name}</b>${cliente.contact_name ? ' · A/C ' + cliente.contact_name : ''}<br>${P.code ? 'Proposta nº ' + P.code + ' · ' : ''}Emitida em ${fmt(P.date)} · <b>Válida até ${fmt(validade)}</b>`)}
  <div class="page">
    <h2><span class="num">${sec()}</span>Contexto e objetivo</h2>
    <p>${E('p_ctx', `A partir do autodiagnóstico e da sessão de diagnóstico realizada em ${fmt(state.client.sessionDate)}, ${ev.front ? CATALOG.fronts[ev.front].name.toLowerCase() : 'a frente prioritária'} foi identificada como a frente de maior impacto para ${cliente.name || 'a clínica'} neste momento.`)}</p>
    ${achados.length ? html`<p><b>Pontos que motivam esta proposta:</b></p><ul class="ck">${achados.map((f) => html`<li>${f.t}${f.i ? html` <span class="hint">(${f.i})</span>` : ''}</li>`)}</ul>` : ''}
    ${state.matrix.goal3m.trim() ? html`<div class="callout"><b>Objetivo para os próximos 3 meses:</b> “${state.matrix.goal3m}”</div>` : ''}

    <h2 class="pb"><span class="num">${sec()}</span>Opções de investimento</h2>
    ${opts.length ? html`<div class="opts">${P.options.map((o, i) => cartaoOpcao(o, i))}</div>` : html`<p class="empty">Monte as opções no painel acima.</p>`}

    ${frentes.length ? html`<h2 class="pb"><span class="num">${sec()}</span>Escopo de atuação</h2>
    ${frentes.map((k) => { const F = CATALOG.fronts[k]; return html`<div class="avoid" style="margin-bottom:14px"><h3>${F.name}</h3>
      <table class="t"><thead><tr><th style="width:50%">O que será trabalhado</th><th>O que a clínica recebe</th></tr></thead><tbody>
      <tr><td><ul class="ck">${F.modules.map((m) => html`<li>${m}</li>`)}</ul></td><td><ul class="ck">${F.deliverables.map((m) => html`<li>${m}</li>`)}</ul>
      <p style="margin-top:8px"><b>Indicadores acompanhados:</b> ${F.kpis.join(' · ')}</p></td></tr></tbody></table></div>`; })}` : ''}

    ${temPrograma ? html`<h2><span class="num">${sec()}</span>Como funciona o acompanhamento</h2>
    <table class="t avoid"><thead><tr><th style="width:24%">Etapa</th><th>O que acontece</th></tr></thead><tbody>
      <tr><td><b>Linha de base</b></td><td>Medição inicial dos indicadores da frente para comparar o antes e o depois.</td></tr>
      <tr><td><b>Plano de ação</b></td><td>Construído em conjunto com a gestão, com responsáveis, prazos e metas.</td></tr>
      <tr><td><b>Implantação</b></td><td>Fluxos, ferramentas, POPs, ITs e treinamento da equipe.</td></tr>
      <tr><td><b>Acompanhamento</b></td><td>Reuniões em datas fixas com painel de indicadores: implantado, resultado e pendente. Resposta em até 2 dias úteis entre as reuniões, por e-mail ou WhatsApp.</td></tr>
      <tr><td><b>Encerramento</b></td><td>Relatório comparativo antes e depois, entrega do kit da frente (painéis, planilhas, POPs e materiais de treinamento) e termo de encerramento.</td></tr>
    </tbody></table>` : ''}

    <h2><span class="num">${sec()}</span>Condições</h2>
    <table class="t avoid"><tbody>
      <tr><td style="width:30%"><b>Pagamento</b></td><td>${P.payment}</td></tr>
      <tr><td><b>Formato</b></td><td>Encontros online${+P.onsite ? `, com ${+P.onsite} encontro(s) presencial(is) em Osasco/São Paulo incluído(s)` : ''}. Fora da Grande São Paulo, passagem e hospedagem são custeadas pela clínica, mediante aprovação prévia.</td></tr>
      <tr><td><b>Duração mínima</b></td><td>Programas de acompanhamento: ${CATALOG.minMonths} meses.</td></tr>
      <tr><td><b>Fora do escopo</b></td><td>Frentes não contratadas; armazenamento de dados de pacientes${temSistema ? '; ' + CATALOG.system.outside.join('; ') : ''}.</td></tr>
      <tr><td><b>Validade</b></td><td><b>${P.validity} dias corridos — até ${fmt(validade)}.</b> Após essa data, valores e disponibilidade de agenda podem ser revistos.</td></tr>
    </tbody></table>

    <h2><span class="num">${sec()}</span>Próximos passos</h2>
    <ul class="ck"><li>Escolha da opção e aceite desta proposta.</li><li>Assinatura do contrato.</li><li>Agendamento do encontro de início e envio dos dados para a linha de base.</li></ul>
    <table class="t avoid" style="margin-top:22px"><thead><tr><th style="width:50%">Aceite da clínica</th><th>ELOGA</th></tr></thead><tbody>
      <tr><td style="height:70px">Opção escolhida: ____<br><br>Nome: ________________________ Data: __/__/____</td><td>Helle Machado<br>Consultoria &amp; Estratégias em Saúde</td></tr></tbody></table>
  </div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Proposta válida até ${fmt(validade)}</span></div>`;
}
