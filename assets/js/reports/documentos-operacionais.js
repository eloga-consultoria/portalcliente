// Relatório de Diagnóstico (integrado: autodiagnóstico + sessão de 45 min) e Proposta comercial.
// Layout fiel ao modelo aprovado "ELOGA | Diagnóstico Operacional". Saída: HTML seguro para tela e impressão.
import { html, confiavel } from '../core/dom.js';
import { COBRANCA_EXTRA, CATALOG, FRONT_KEYS, QC, num, avaliar, candidatas, situacaoDados, precoOpcao, semearOpcoes, somarDias, capacidade, DIAS, recorrente } from '../admin/operacional-modelo.js';
import { LEVELS, READ, levelOf } from '../import/autodiagnostico-modelo.js';
import { ROTULOS_CAMPOS } from '../import/leitores.js';

const fmt = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const brl2 = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: Number(v) % 1 ? 2 : 0, maximumFractionDigits: 2 });
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
/** Seções do relatório. A administradora escolhe quais entram antes de gerar o PDF. */
export const SECOES_RELATORIO = [
  ['resumo', 'Resumo executivo'], ['maturidade', 'Maturidade por pilar (radar)'], ['leitura', 'Leitura por pilar'],
  ['autodiag', 'O que o autodiagnóstico revelou'], ['contexto', 'Contexto da operação'], ['capacidade', 'Capacidade de atendimento'],
  ['achados', 'Principais achados'], ['recomendacoes', 'Recomendações imediatas'], ['dados', 'Situação dos dados'], ['caminho', 'Caminho recomendado'],
];
export const secaoAtiva = (state, id) => (state.report.secoes || {})[id] !== false;

const n0 = (v) => Number(v || 0).toLocaleString('pt-BR');
const SIST = { nenhum: 'Nenhum', planilha: 'Planilha', sistema: 'Sistema' };

export function relatorioHtml({ state, cliente, autodiag, logo }) {
  const ev = avaliar(state), st = situacaoDados(state, ev), F = CATALOG.formats;
  const achados = state.matrix.findings.filter((f) => f.t.trim());
  const recs = state.matrix.quickwins.filter((q) => q.trim());
  const x = state.session.ctx || {};
  const cap = capacidade(x);
  const perfil = autodiag ? Object.entries({ ...(autodiag.identification?.estrutura || {}) })
    .filter(([, v]) => (Array.isArray(v) ? v.length : String(v || '').trim()))
    .map(([k, v]) => [ROTULOS_CAMPOS['estrutura.' + k] || k, Array.isArray(v) ? v.join(', ') : v]) : [];
  const prioridades = autodiag?.priorities || [];
  const naoSei = autodiag?.unknowns || [];
  const linhasContexto = [
    ['Especialidades', [...(x.especialidades || []), x.especialidadesOutras].filter(Boolean).join(', ')],
    ['Formato dos atendimentos', { individual: 'Individual', grupo: 'Em grupo', misto: 'Misto' }[x.modalidade] ? `${{ individual: 'Individual', grupo: 'Em grupo', misto: 'Misto' }[x.modalidade]} · ${x.duracao || '—'} min${+x.simultaneos > 1 ? ` · ${x.simultaneos} pacientes por sala` : ''}` : ''],
    ['Estrutura', [x.salas && `${x.salas} sala(s)`, x.profissionais && `${x.profissionais} profissional(is) de atendimento`, x.administrativos && `${x.administrativos} na equipe administrativa`].filter(Boolean).join(' · ')],
    ['Funcionamento', DIAS.filter(([k]) => x.dias?.[k]?.aberto).map(([k, nome]) => { const d = x.dias[k]; return `${nome.slice(0, 3)} ${d.ini}–${d.fim}${d.intIni && d.intFim ? ` (pausa ${d.intIni}–${d.intFim})` : ''}`; }).join(' · ')],
    ['Atendimentos realizados por mês', x.atendimentosMes ? n0(x.atendimentosMes) : ''],
    ['Fonte de receita', [x.mix?.convenio && `Convênio ${x.mix.convenio}%`, x.mix?.particular && `Particular ${x.mix.particular}%`, x.mix?.liminar && `Liminar ${x.mix.liminar}%`].filter(Boolean).join(' · ')],
    ['Modelos de cobrança', (x.cobranca || []).join(', ')],
    ['Valores praticados', [x.valorSessao && `Sessão avulsa ${brl(x.valorSessao)}`, x.pacoteValor && `Pacote ${x.pacoteSessoes ? x.pacoteSessoes + ' sessões ' : ''}${brl(x.pacoteValor)}`, x.mensalidade && `Mensalidade ${brl(x.mensalidade)}`].filter(Boolean).join(' · ')],
    ['Sistemas', Object.entries(x.sistemas || {}).filter(([, v]) => v).map(([k, v]) => `${({ agenda: 'Agenda', prontuario: 'Prontuário', crm: 'CRM', faturamento: 'Faturamento' })[k]}: ${SIST[v]}`).join(' · ')],
    ['Observações', x.observacoes],
  ].filter(([, v]) => String(v || '').trim());

  const S = {
    resumo: () => html`<h2>${'{n}'}Resumo executivo</h2>
      <p class="exec">${ed(state, 'exec', state.matrix.exec.trim() || resumoAuto(state, cliente, ev))}</p>
      <div class="kpis"><div class="kpi"><small>Nota geral</small><b>${state.auto.overall === '' ? '—' : state.auto.overall + '/100'}</b></div>
        <div class="kpi"><small>Nível de maturidade</small><b>${state.auto.level || '—'}</b></div>
        <div class="kpi"><small>Frente prioritária</small><b style="font-size:17px">${ev.front ? CATALOG.fronts[ev.front].name : '—'}</b></div></div>`,
    maturidade: () => html`<h2>${'{n}'}Maturidade por pilar</h2>
      <div class="radar-wrap avoid"><div>${radar(state)}</div>
        <div><p>${ed(state, 'radar', 'O radar consolida as notas do autodiagnóstico preenchido pela gestão, de 0 a 100 por pilar. Quanto mais próximo da borda, mais estruturado o pilar.')}</p>
        <p class="hint">Faixas: abaixo de 40 inicial · 40 a 59 em estruturação · 60 a 79 estruturada · 80 ou mais orientada por dados.</p></div></div>`,
    leitura: () => html`<h2 class="pb">${'{n}'}Leitura por pilar</h2>
      <table class="t avoid"><thead><tr><th style="width:28%">Pilar</th><th style="width:20%">Nota</th><th>Leitura</th></tr></thead><tbody>
      ${FRONT_KEYS.map((k) => { const v = num(state.auto.pillars[k]); const l = v === null ? null : levelOf(v);
        return html`<tr><td><b>${CATALOG.fronts[k].pillar}</b>${ev.front === k ? html` <span class="pill p-top">prioritária</span>` : ''}</td>
          <td>${v === null ? '—' : v} ${l === null ? '' : html`<span class="pill ${NIVEL_CLASSE[l]}">${LEVELS[l].name}</span>`}</td>
          <td>${ed(state, 'pil_' + k, l === null ? '—' : READ[k][l])}</td></tr>`; })}</tbody></table>`,
    autodiag: () => (!autodiag ? '' : html`<h2 class="pb">${'{n}'}O que o autodiagnóstico revelou</h2>
      ${prioridades.length ? html`<p>As três prioridades apontadas pelas respostas da gestão, com as respostas literais:</p>
        ${prioridades.map((p, i) => html`<div class="prio avoid"><b>${i + 1}. ${CATALOG.fronts[p.id]?.pillar || p.id}</b> <span class="hint">· ${p.nota ?? '—'}/100</span>
          ${(p.itens || []).map((it) => html`<p class="quote">Respondeu “${it.rotulo}” para: ${it.t}</p>`)}</div>`)}` : ''}
      ${naoSei.length ? html`<h3>O que a operação ainda não enxerga</h3><p>Itens marcados como “Não sei”: mostram onde faltam dados para decidir com segurança.</p>
        <ul class="ck">${naoSei.map((y) => html`<li><b>${y.pillar}:</b> ${y.t}</li>`)}</ul>` : ''}
      ${perfil.length ? html`<h3>Perfil da operação declarado</h3><table class="t avoid"><tbody>${perfil.map(([r, v]) => html`<tr><td style="width:36%"><b>${r}</b></td><td>${v}</td></tr>`)}</tbody></table>` : ''}`),
    contexto: () => (!linhasContexto.length ? '' : html`<h2>${'{n}'}Contexto da operação</h2>
      <table class="t avoid"><tbody>${linhasContexto.map(([r, v]) => html`<tr><td style="width:32%"><b>${r}</b></td><td>${v}</td></tr>`)}</tbody></table>`),
    capacidade: () => (!cap ? '' : html`<h2 class="pb">${'{n}'}Capacidade de atendimento</h2>
      <p>${ed(state, 'cap_intro', `Calculada a partir do horário de funcionamento (sem os intervalos de fechamento), da duração de ${cap.duracao} minutos por atendimento e de ${cap.porHorario} atendimento(s) possível(is) por horário: o menor número entre salas (${cap.salas}) e profissionais (${cap.profissionais})${cap.simultaneos > 1 ? `, com ${cap.simultaneos} pacientes por sala` : ''}.`)}</p>
      <div class="kpis"><div class="kpi"><small>Por semana</small><b>${n0(cap.semanal)}</b></div><div class="kpi"><small>Por mês</small><b>${n0(cap.mensal)}</b></div>
        <div class="kpi"><small>Ocupação atual</small><b>${cap.ocupacao === null ? '—' : cap.ocupacao + '%'}</b></div></div>
      <table class="t avoid"><thead><tr><th>Dia</th><th>Horas de atendimento</th><th>Horários</th><th>Atendimentos possíveis</th></tr></thead><tbody>
        ${cap.porDia.filter((d) => d.aberto).map((d) => html`<tr><td>${d.nome}</td><td>${Math.floor(d.minutos / 60)}h${d.minutos % 60 ? String(d.minutos % 60).padStart(2, '0') : ''}</td><td>${d.horarios}</td><td>${n0(d.atendimentos)}</td></tr>`)}</tbody></table>
      <div class="callout avoid"><p><b>Gargalo:</b> ${cap.gargalo === 'equilibrado' ? 'salas e profissionais estão equilibrados.' : cap.gargalo === 'salas'
        ? `as salas. Há ${cap.ociosos} profissional(is) a mais do que salas no mesmo horário; com mais uma sala, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`
        : `os profissionais. Há ${cap.ociosos} sala(s) sem profissional no mesmo horário; com mais um profissional, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`}</p>
        ${cap.receitaPotencial ? html`<p style="margin-top:6px">Receita potencial com a agenda cheia: <b>${brl(cap.receitaPotencial)}/mês</b>${cap.receitaOciosa ? html` · capacidade não utilizada: <b>${brl(cap.receitaOciosa)}/mês</b>` : ''} (valor médio de ${brl(cap.ticket)} por atendimento).</p>` : ''}</div>`),
    achados: () => html`<h2>${'{n}'}Principais achados</h2>
      ${achados.length ? html`<table class="t avoid"><thead><tr><th style="width:6%">#</th><th>Achado</th><th style="width:26%">Impacto estimado</th></tr></thead><tbody>
        ${achados.map((f, i) => html`<tr><td>${i + 1}</td><td>${f.t}</td><td>${f.i || 'A medir na linha de base'}</td></tr>`)}</tbody></table>`
        : html`<p class="empty">Registre os achados na aba Matriz.</p>`}`,
    recomendacoes: () => html`<h2>${'{n}'}Recomendações imediatas</h2><p>Ações que a gestão pode iniciar desde já, sem custo adicional:</p>
      ${recs.length ? html`<ul class="ck">${recs.map((y) => html`<li>${y}</li>`)}</ul>` : html`<p class="empty">Registre as recomendações na aba Matriz.</p>`}`,
    dados: () => html`<h2>${'{n}'}Situação dos dados</h2>
      <p><span class="pill ${st[0] === 'apto' ? 'p-ok' : 'p-warn'}">${st[1]}</span></p><p>${ed(state, 'data', st[2])}</p>
      ${state.session.C.some((y) => y.n || y.v) ? html`<table class="t avoid"><thead><tr><th>Verificação</th><th style="width:14%">Situação</th><th>Detalhe</th></tr></thead><tbody>
        ${QC.map((p, i) => html`<tr><td>${p}</td><td>${({ sim: 'Sim', parcial: 'Parcial', nao: 'Não' })[state.session.C[i].v] || '—'}</td><td>${state.session.C[i].n}</td></tr>`)}</tbody></table>` : ''}`,
    caminho: () => html`<h2>${'{n}'}Caminho recomendado</h2>
      <div class="callout avoid"><p>Frente prioritária: <b>${ev.front ? CATALOG.fronts[ev.front].name : '—'}</b></p>
        <p>Formato recomendado: <b>${ev.format ? F[ev.format].name : '—'}</b></p>
        <p style="margin-top:8px;color:#d7e1ea">${ed(state, 'path', ev.format ? F[ev.format].desc : '')}</p></div>
      ${state.matrix.goal3m.trim() ? html`<p><b>Objetivo declarado pela gestão para os próximos 3 meses:</b> “${state.matrix.goal3m}”</p>` : ''}
      <p>${ed(state, 'fecho', `As condições, o escopo e o investimento estão detalhados na proposta comercial, apresentada na devolutiva${state.session.devolutiva ? ' (' + state.session.devolutiva + ')' : ''}.`)}</p>`,
  };
  // Numeração contínua só das seções incluídas e com conteúdo
  let n = 0;
  const corpo = SECOES_RELATORIO.filter(([id]) => secaoAtiva(state, id)).map(([id]) => String(S[id]()))
    .filter(Boolean).map((h) => h.replace('{n}', `<span class="num">${++n}</span>`)).join('\n');
  return html`
  ${capa('Relatório de', 'Diagnóstico Operacional', cliente, logo,
    html`<b>${cliente.name}</b>${cliente.city ? ' · ' + cliente.city : ''}<br>
      ${state.auto.date ? html`Autodiagnóstico: ${fmt(state.auto.date)} · ` : ''}Diagnóstico operacional: ${fmt(state.client.sessionDate)} · Emitido em ${fmt(hoje())}<br>Responsável técnica: Helle Machado`)}
  <div class="page">${confiavel(corpo)}</div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Documento confidencial · ${cliente.name}</span></div>`;
}

// ===================================================================== PROPOSTA
function cartaoOpcao(o, i) {
  const f = CATALOG.formats[o.type]; if (!f) return '';
  const pr = precoOpcao(o), frs = (f.frentesFixas ? [] : o.fronts).map((k) => CATALOG.fronts[k].name);
  let preco, sub;
  if (f.cobranca === 'unico') { preco = html`${brl(pr.once)} <small>pagamento único</small>`; sub = html`${frs.length ? 'Frente: ' + frs.join(', ') : ''}${f.nota ? (frs.length ? ' · ' : '') + f.nota : ''}`; }
  else if (f.cobranca === 'por_frente') { preco = html`${brl(pr.once)} <small>valor único</small>`; sub = html`${frs.length ? 'Frente: ' + frs.join(', ') : ''}${f.nota ? (frs.length ? ' · ' : '') + f.nota : ''}`; }
  else {
    preco = html`${brl(pr.monthly)} <small>/mês</small>`;
    sub = html`${frs.length ? html`Frentes: ${frs.join(', ')}<br>` : ''}Duração: ${pr.months} meses · total ${brl(pr.monthly * pr.months)}${pr.once ? ' + ' + CATALOG.system.name.toLowerCase() + ' ' + brl(pr.once) : ''}`;
  }
  const itens = [...(f.items || [])];
  if (o.system && recorrente(f)) itens.push(CATALOG.system.name + ': ' + CATALOG.system.items.join(', ').toLowerCase());
  return html`<div class="opt ${o.recommended ? 'rec' : ''} avoid">${o.recommended ? html`<span class="rib">RECOMENDADA</span>` : ''}
    <div class="sub">Opção ${i + 1}</div><h4>${f.name}</h4><p class="sub">${f.desc}</p>
    <div class="price">${preco}</div><p class="sub">${sub}</p>
    <ul class="ck" style="font-size:12.5px">${itens.map((x) => html`<li>${x}</li>`)}</ul></div>`;
}

export function propostaHtml({ state, cliente, logo, editavel = true }) {
  semearOpcoes(state);
  const P = state.proposal, ev = avaliar(state), opts = P.options.filter((o) => o.type);
  const validade = somarDias(P.date, P.validity);
  const frentes = [...new Set(opts.flatMap((o) => CATALOG.formats[o.type]?.frentesFixas || o.fronts))].filter((k) => CATALOG.fronts[k]);
  const temPrograma = opts.some((o) => recorrente(CATALOG.formats[o.type]));
  const temSistema = opts.some((o) => o.system);
  const achados = state.matrix.findings.filter((f) => f.t.trim()).slice(0, 3);
  const extras = (P.extras || []).filter((x) => String(x.desc || '').trim() && Number(x.valor) > 0);
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
      ${(P.infoAdicional || '').trim() ? html`<tr><td><b>Informações adicionais</b></td><td style="white-space:pre-line">${P.infoAdicional.trim()}</td></tr>` : ''}
    </tbody></table>

    <h2><span class="num">${sec()}</span>Próximos passos</h2>
    <ul class="ck"><li>Escolha da opção e aceite desta proposta.</li><li>Assinatura do contrato.</li><li>Agendamento do encontro de início e envio dos dados para a linha de base.</li></ul>

    <h2 class="pb"><span class="num">${sec()}</span>Investimento</h2>
    ${opts.length ? html`<div class="opts">${P.options.map((o, i) => cartaoOpcao(o, i))}</div>` : html`<p class="empty">Monte as opções no painel acima.</p>`}
    ${extras.length ? html`<h3 style="margin-top:18px">Custos adicionais</h3>
      <table class="t avoid"><thead><tr><th>Descrição</th><th style="width:22%">Cobrança</th><th style="width:20%;text-align:right">Valor</th></tr></thead><tbody>
        ${extras.map((x) => html`<tr><td>${x.desc}</td><td>${(COBRANCA_EXTRA.find(([v]) => v === x.cobranca) || COBRANCA_EXTRA[0])[1]}</td><td style="text-align:right"><b>${brl2(x.valor)}</b></td></tr>`)}
      </tbody></table>
      <p class="hint" style="margin-top:6px">Os custos adicionais somam-se ao valor da opção escolhida.</p>` : ''}
    <table class="t avoid" style="margin-top:22px"><thead><tr><th style="width:50%">Aceite da clínica</th><th>ELOGA</th></tr></thead><tbody>
      <tr><td style="height:70px">Opção escolhida: ____<br><br>Nome: ________________________ Data: __/__/____</td><td>Helle Machado<br>Consultoria &amp; Estratégias em Saúde</td></tr></tbody></table>
  </div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Proposta válida até ${fmt(validade)}</span></div>`;
}
