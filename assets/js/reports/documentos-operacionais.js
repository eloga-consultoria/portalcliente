// Relatório de Diagnóstico (integrado: autodiagnóstico + sessão de 45 min) e Proposta comercial.
// Layout fiel ao modelo aprovado "ELOGA | Diagnóstico Operacional". Saída: HTML seguro para tela e impressão.
import { html, confiavel } from '../core/dom.js';
import { COBRANCA_EXTRA, CATALOG, FRONT_KEYS, QC, CRIT, num, avaliar, candidatas, situacaoDados, precoOpcao, semearOpcoes, somarDias, capacidade, DIAS, recorrente, recTexto, recAtiva, minutosDeAtendimento } from '../admin/operacional-modelo.js';
import { LEVELS, READ, levelOf } from '../import/autodiagnostico-modelo.js';
import { ROTULOS_CAMPOS, limparItem } from '../import/leitores.js';

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
    <div class="logos"><div class="brand brand-img"><img src="assets/img/eloga-marca-clara.png" alt="ELOGA"><small>Consultoria &amp; Estratégias em Saúde</small></div>
      ${logo ? html`<span class="x brand-img">×</span><img class="logo-cliente" src="${logo}" alt="Logo ${cliente.name}">` : ''}</div>
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
  const lv = state.auto.level || '—', nomes = ev.fronts.map((k) => CATALOG.fronts[k].name.toLowerCase());
  const low = candidatas(state).map((k) => CATALOG.fronts[k].name.toLowerCase());
  return `${cliente.name || 'A clínica'} apresenta nível de maturidade "${lv}"${state.auto.overall !== '' ? ` (nota ${state.auto.overall}/100)` : ''} no autodiagnóstico. `
    + (low.length ? `Os pilares com maior fragilidade são ${low.join(' e ')}. ` : '')
    + (nomes.length > 1 ? `A sessão de diagnóstico indicou ${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)} como frentes prioritárias de atuação.`
      : `A sessão de diagnóstico indicou ${nomes[0] || 'a frente prioritária'} como frente prioritária de atuação.`);
}

// ===================================================================== RELATÓRIO
/** Seções do relatório. A administradora escolhe quais entram antes de gerar o PDF. */
export const SECOES_RELATORIO = [
  ['resumo', 'Resumo executivo'], ['maturidade', 'Maturidade por pilar (radar)'], ['leitura', 'Leitura por pilar'],
  ['autodiag', 'O que o autodiagnóstico revelou'], ['contexto', 'Contexto da operação'], ['capacidade', 'Capacidade de atendimento'],
  ['achados', 'Principais achados'], ['recomendacoes', 'Recomendações imediatas'], ['complementares', 'Informações complementares'],
  ['dados', 'Situação dos dados'], ['caminho', 'Caminho recomendado'],
];
export const secaoAtiva = (state, id) => (state.report.secoes || {})[id] !== false;

const n0 = (v) => Number(v || 0).toLocaleString('pt-BR');
const SIST = { nenhum: 'Nenhum', planilha: 'Planilha', sistema: 'Sistema' };

export function relatorioHtml({ state, cliente, autodiag, logo }) {
  const ev = avaliar(state), st = situacaoDados(state, ev), F = CATALOG.formats;
  const achados = state.matrix.findings.filter((f) => f.t.trim() && f.on !== false);
  const recs = state.matrix.quickwins.filter(recAtiva).map(recTexto).filter((q) => q.trim());
  const complementares = (state.session.extras || []).filter((c) => c.on !== false && (String(c.titulo || '').trim() || String(c.valor || '').trim()));
  const nomesPrio = ev.fronts.map((k) => CATALOG.fronts[k].name);
  const x = state.session.ctx || {};
  const cap = capacidade(x);
  const perfil = autodiag ? Object.entries({ ...(autodiag.identification?.estrutura || {}) })
    .filter(([, v]) => (Array.isArray(v) ? v.length : String(v || '').trim()))
    .map(([k, v]) => [ROTULOS_CAMPOS['estrutura.' + k] || k, Array.isArray(v) ? v.join(', ') : v]) : [];
  const prioridades = autodiag?.priorities || [];
  const naoSei = autodiag?.unknowns || [];
  const diasAbertos = DIAS.filter(([k]) => x.dias?.[k]?.aberto);
  const horas = (m) => (m ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : '—');
  const linhasContexto = [
    ['Especialidades', [...(x.especialidades || []), x.especialidadesOutras].filter(Boolean).join(', ')],
    ['Formato dos atendimentos', { individual: 'Individual', grupo: 'Em grupo', misto: 'Misto' }[x.modalidade] ? `${{ individual: 'Individual', grupo: 'Em grupo', misto: 'Misto' }[x.modalidade]} · ${x.duracao || '—'} min${cap?.modo !== 'especialidade' && +x.simultaneos > 1 ? ` · ${x.simultaneos} pacientes por sala` : ''}` : ''],
    ['Estrutura', [x.salas && `${x.salas} sala(s)`, (cap?.modo === 'especialidade' ? cap.profissionais : x.profissionais) && `${cap?.modo === 'especialidade' ? cap.profissionais : x.profissionais} profissional(is) de atendimento`, x.administrativos && `${x.administrativos} na equipe administrativa`].filter(Boolean).join(' · ')],
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
        <div class="kpi"><small>${nomesPrio.length > 1 ? 'Frentes prioritárias' : 'Frente prioritária'}</small><b style="font-size:${nomesPrio.length > 1 ? 14 : 17}px">${nomesPrio.join(' · ') || '—'}</b></div></div>`,
    maturidade: () => html`<h2>${'{n}'}Maturidade por pilar</h2>
      <div class="radar-wrap avoid"><div>${radar(state)}</div>
        <div><p>${ed(state, 'radar', 'O radar consolida as notas do autodiagnóstico preenchido pela gestão, de 0 a 100 por pilar. Quanto mais próximo da borda, mais estruturado o pilar.')}</p>
        <p class="hint">Faixas: abaixo de 40 inicial · 40 a 59 em estruturação · 60 a 79 estruturada · 80 ou mais orientada por dados.</p></div></div>`,
    leitura: () => html`<h2>${'{n}'}Leitura por pilar</h2>
      <p class="hint" style="margin:0 0 8px"><span class="fonte fa">A</span> <b>Autodiagnóstico</b>: respostas da própria gestão no formulário do site ·
        <span class="fonte fs">S</span> <b>Diagnóstico operacional</b>: análise da ELOGA na sessão de 45 minutos.</p>
      <table class="t"><thead><tr><th style="width:22%">Pilar</th><th style="width:39%"><span class="fonte fa">A</span> Autodiagnóstico</th><th><span class="fonte fs">S</span> Sessão de diagnóstico</th></tr></thead><tbody>
      ${FRONT_KEYS.map((k) => { const v = num(state.auto.pillars[k]); const l = v === null ? null : levelOf(v);
        const explorada = state.session.fronts.includes(k), s0 = state.matrix.scores[k] || {};
        const notas = CRIT.map(([c, nome]) => (s0[c] ?? null) === null ? null : `${nome} ${s0[c]}/3`).filter(Boolean);
        return html`<tr class="avoid"><td><b>${CATALOG.fronts[k].pillar}</b>${ev.fronts.includes(k) ? html` <span class="pill p-top">prioritária</span>` : ''}</td>
          <td><div>${v === null ? '—' : html`<b>${v}/100</b>`} ${l === null ? '' : html`<span class="pill ${NIVEL_CLASSE[l]}">${LEVELS[l].name}</span>`}</div>
            <div class="hint" style="margin-top:4px">${ed(state, 'pil_' + k, l === null ? '—' : READ[k][l])}</div></td>
          <td>${explorada ? html`${notas.length ? html`<div style="margin-bottom:4px">${notas.join(' · ')}</div>` : ''}
              <div class="hint">${ed(state, 'ses_' + k, notas.length ? 'Pilar explorado na sessão; pontuação da matriz de encaixe ao lado.' : 'Pilar explorado na sessão.')}</div>`
            : html`<span class="hint">Não explorado na sessão.</span>`}</td></tr>`; })}</tbody></table>`,
    autodiag: () => (!autodiag ? '' : html`<h2 class="pb">${'{n}'}O que o autodiagnóstico revelou</h2>
      ${prioridades.length ? html`<p>As três prioridades apontadas pelas respostas da gestão, com as respostas literais:</p>
        ${prioridades.map((p, i) => html`<div class="prio avoid"><b>${i + 1}. ${CATALOG.fronts[p.id]?.pillar || p.id}</b> <span class="hint">· ${p.nota ?? '—'}/100</span>
          ${(p.itens || []).map((it) => html`<p class="quote">Respondeu “${it.rotulo}” para: ${limparItem(it.t)}</p>`)}</div>`)}` : ''}
      ${naoSei.length ? html`<h3>O que a operação ainda não enxerga</h3><p>Itens marcados como “Não sei”: mostram onde faltam dados para decidir com segurança.</p>
        <ul class="ck">${naoSei.map((y) => html`<li><b>${y.pillar}:</b> ${limparItem(y.t)}</li>`)}</ul>` : ''}
      ${perfil.length ? html`<h3>Perfil da operação declarado</h3><table class="t avoid"><tbody>${perfil.map(([r, v]) => html`<tr><td style="width:36%"><b>${r}</b></td><td>${v}</td></tr>`)}</tbody></table>` : ''}`),
    contexto: () => (!linhasContexto.length && !diasAbertos.length ? '' : html`<h2>${'{n}'}Contexto da operação</h2>
      ${diasAbertos.length ? html`<h3>Horário de funcionamento</h3>
      <table class="t avoid grade-horario"><thead><tr><th>Dia</th><th>Abertura</th><th>Fechamento</th><th>Intervalo</th><th style="text-align:right">Horas de atendimento</th></tr></thead><tbody>
        ${DIAS.map(([k, nome]) => { const d = x.dias?.[k]; if (!d?.aberto) return html`<tr class="fechado"><td>${nome}</td><td colspan="4">Fechado</td></tr>`;
          return html`<tr><td><b>${nome}</b></td><td>${d.ini || '—'}</td><td>${d.fim || '—'}</td><td>${d.intIni && d.intFim ? `${d.intIni} às ${d.intFim}` : 'Sem intervalo'}</td><td style="text-align:right">${horas(minutosDeAtendimento(d))}</td></tr>`; })}
        <tr class="total"><td colspan="4"><b>Total semanal</b></td><td style="text-align:right"><b>${horas(DIAS.reduce((t, [k]) => t + minutosDeAtendimento(x.dias?.[k]), 0))}</b></td></tr></tbody></table>` : ''}
      ${linhasContexto.length ? html`<h3>Estrutura e modelo de atendimento</h3>
      <table class="t avoid"><tbody>${linhasContexto.map(([r, v]) => html`<tr><td style="width:32%"><b>${r}</b></td><td>${v}</td></tr>`)}</tbody></table>` : ''}`),
    capacidade: () => (!cap ? '' : html`<h2 class="pb">${'{n}'}Capacidade de atendimento</h2>
      <p>${ed(state, 'cap_intro', cap.modo === 'especialidade'
        ? `Calculada a partir do horário de funcionamento (sem os intervalos de fechamento), da duração de ${cap.duracao} minutos por atendimento e dos profissionais e atendimentos simultâneos de cada especialidade${cap.salas ? `, considerando ${cap.salas} sala(s) compartilhada(s)` : ''}: ${cap.porHorario} atendimento(s) possível(is) por horário.`
        : `Calculada a partir do horário de funcionamento (sem os intervalos de fechamento), da duração de ${cap.duracao} minutos por atendimento e de ${cap.porHorario} atendimento(s) possível(is) por horário: o menor número entre salas (${cap.salas}) e profissionais (${cap.profissionais})${cap.simultaneos > 1 ? `, com ${cap.simultaneos} pacientes por sala` : ''}.`)}</p>
      ${cap.modo === 'especialidade' ? html`<table class="t avoid"><thead><tr><th>Especialidade</th><th style="text-align:center">Profissionais</th><th style="text-align:center">Atendimentos simultâneos</th><th style="text-align:center">Por horário</th><th style="text-align:right">Por mês</th></tr></thead><tbody>
        ${cap.especialidades.map((e) => html`<tr><td><b>${e.nome}</b></td><td style="text-align:center">${e.prof}</td><td style="text-align:center">${e.simult}</td><td style="text-align:center">${e.porHorario}</td><td style="text-align:right">${n0(e.mensal)}</td></tr>`)}</tbody></table>` : ''}
      <div class="kpis"><div class="kpi"><small>Por semana</small><b>${n0(cap.semanal)}</b></div><div class="kpi"><small>Por mês</small><b>${n0(cap.mensal)}</b></div>
        <div class="kpi"><small>Ocupação atual</small><b>${cap.ocupacao === null ? '—' : cap.ocupacao + '%'}</b></div></div>
      <table class="t avoid"><thead><tr><th>Dia</th><th>Horas de atendimento</th><th>Horários</th><th>Atendimentos possíveis</th></tr></thead><tbody>
        ${cap.porDia.filter((d) => d.aberto).map((d) => html`<tr><td>${d.nome}</td><td>${Math.floor(d.minutos / 60)}h${d.minutos % 60 ? String(d.minutos % 60).padStart(2, '0') : ''}</td><td>${d.horarios}</td><td>${n0(d.atendimentos)}</td></tr>`)}</tbody></table>
      <div class="callout avoid"><p><b>Gargalo:</b> ${cap.gargalo === 'sem_salas' ? 'informe o número de salas para identificar o gargalo.' : cap.gargalo === 'equilibrado' ? 'salas e profissionais estão equilibrados.' : cap.gargalo === 'salas'
        ? `as salas. Há ${cap.ociosos} profissional(is) a mais do que salas no mesmo horário; com mais uma sala, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`
        : `os profissionais. Há ${cap.ociosos} sala(s) sem profissional no mesmo horário; com mais um profissional, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`}</p>
        ${cap.receitaPotencial ? html`<p style="margin-top:6px">Receita potencial com a agenda cheia: <b>${brl(cap.receitaPotencial)}/mês</b>${cap.receitaOciosa ? html` · capacidade não utilizada: <b>${brl(cap.receitaOciosa)}/mês</b>` : ''} (valor médio de ${brl(cap.ticket)} por atendimento).</p>` : ''}</div>`),
    achados: () => html`<h2>${'{n}'}Principais achados</h2>
      ${achados.length ? html`<table class="t avoid"><thead><tr><th style="width:6%">#</th><th>Achado</th><th style="width:26%">Impacto estimado</th></tr></thead><tbody>
        ${achados.map((f, i) => html`<tr><td>${i + 1}</td><td>${f.t}</td><td>${f.i || 'A medir na linha de base'}</td></tr>`)}</tbody></table>`
        : html`<p class="empty">Registre os achados na aba Matriz.</p>`}`,
    recomendacoes: () => html`<h2>${'{n}'}Recomendações imediatas</h2><p>Ações que a gestão pode iniciar desde já, sem custo adicional:</p>
      ${recs.length ? html`<ul class="ck">${recs.map((y) => html`<li>${y}</li>`)}</ul>` : html`<p class="empty">Registre as recomendações na aba Matriz.</p>`}`,
    complementares: () => (!complementares.length ? '' : html`<h2>${'{n}'}Informações complementares</h2>
      <table class="t avoid"><tbody>${complementares.map((c) => html`<tr><td style="width:32%"><b>${c.titulo || '—'}</b></td><td style="white-space:pre-line">${c.valor || ''}</td></tr>`)}</tbody></table>`),
    dados: () => html`<h2>${'{n}'}Situação dos dados</h2>
      <p><span class="pill ${st[0] === 'apto' ? 'p-ok' : 'p-warn'}">${st[1]}</span></p><p>${ed(state, 'data', st[2])}</p>
      ${state.session.C.some((y) => y.n || y.v) ? html`<table class="t avoid"><thead><tr><th>Verificação</th><th style="width:14%">Situação</th><th>Detalhe</th></tr></thead><tbody>
        ${QC.map((p, i) => html`<tr><td>${p}</td><td>${({ sim: 'Sim', parcial: 'Parcial', nao: 'Não' })[state.session.C[i].v] || '—'}</td><td>${state.session.C[i].n}</td></tr>`)}</tbody></table>` : ''}`,
    caminho: () => html`<h2>${'{n}'}Caminho recomendado</h2>
      <div class="callout avoid"><p>${nomesPrio.length > 1 ? 'Frentes prioritárias' : 'Frente prioritária'}: <b>${nomesPrio.join(', ') || '—'}</b></p>
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

/** Seções da proposta. A administradora escolhe quais entram no PDF. */
export const SECOES_PROPOSTA = [
  ['contexto', 'Contexto e objetivo'], ['escopo', 'Escopo de atuação'], ['acompanhamento', 'Como funciona o acompanhamento'],
  ['condicoes', 'Condições'], ['adicionais', 'Seções adicionais'], ['investimento', 'Investimento (opções)'],
  ['custos', 'Custos adicionais'], ['proximos', 'Próximos passos'], ['aceite', 'Aceite (assinaturas)'],
];
export const secaoPropostaAtiva = (state, id) => (state.proposal.secoes || {})[id] !== false;
const nomesFrentes = (ks) => ks.map((k) => CATALOG.fronts[k]?.name).filter(Boolean);
const listaNatural = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a.at(-1) : a[0] || '');

export function propostaHtml({ state, cliente, logo, editavel = true }) {
  semearOpcoes(state);
  const P = state.proposal, ev = avaliar(state), opts = P.options.filter((o) => o.type);
  const validade = somarDias(P.date, P.validity);
  const frentes = [...new Set(opts.flatMap((o) => CATALOG.formats[o.type]?.frentesFixas || o.fronts))].filter((k) => CATALOG.fronts[k]);
  const temPrograma = opts.some((o) => recorrente(CATALOG.formats[o.type]));
  const temSistema = opts.some((o) => o.system);
  const achados = state.matrix.findings.filter((f) => f.t.trim() && f.on !== false).slice(0, 5);
  const extras = (P.extras || []).filter((x) => String(x.desc || '').trim() && Number(x.valor) > 0);
  const adicionais = (P.secoesExtras || []).filter((x) => x.on !== false && (String(x.titulo || '').trim() || String(x.texto || '').trim()));
  const E = editavel ? (k, d) => ed(state, k, d) : (k, d) => html`${state.report.edits[k] ?? d}`;
  const on = (id) => secaoPropostaAtiva(state, id);
  const prio = nomesFrentes(ev.fronts).map((x) => x.toLowerCase());
  let n = 0; const sec = () => ++n;

  const ACOMP = [
    ['Linha de base', 'Medição inicial dos indicadores da frente para comparar o antes e o depois.'],
    ['Plano de ação', 'Construído em conjunto com a gestão, com responsáveis, prazos e metas.'],
    ['Implantação', 'Fluxos, ferramentas, POPs, ITs e treinamento da equipe.'],
    ['Acompanhamento', 'Reuniões em datas fixas com painel de indicadores: implantado, resultado e pendente. Resposta em até 2 dias úteis entre as reuniões, por e-mail ou WhatsApp.'],
    ['Encerramento', 'Relatório comparativo antes e depois, entrega do kit da frente (painéis, planilhas, POPs e materiais de treinamento) e termo de encerramento.'],
  ];
  const PASSOS = ['Escolha da opção e aceite desta proposta.', 'Assinatura do contrato.', 'Agendamento do encontro de início e envio dos dados para a linha de base.'];

  return html`
  ${capa('Proposta de', 'Consultoria', cliente, logo,
    html`<b>${cliente.name}</b>${cliente.contact_name ? ' · A/C ' + cliente.contact_name : ''}<br>${P.code ? 'Proposta nº ' + P.code + ' · ' : ''}Emitida em ${fmt(P.date)} · <b>Válida até ${fmt(validade)}</b>`)}
  <div class="page">
    ${on('contexto') ? html`<h2><span class="num">${sec()}</span>Contexto e objetivo</h2>
    <p>${E('p_ctx', `A partir do autodiagnóstico e da sessão de diagnóstico realizada em ${fmt(state.client.sessionDate)}, ${prio.length ? listaNatural(prio) + (prio.length > 1 ? ' foram identificadas como as frentes' : ' foi identificada como a frente') : 'a frente prioritária foi identificada como a frente'} de maior impacto para ${cliente.name || 'a clínica'} neste momento.`)}</p>
    ${achados.length ? html`<p><b>Pontos que motivam esta proposta:</b></p><ul class="ck">${achados.map((f) => html`<li>${f.t}${f.i ? html` <span class="hint">(${f.i})</span>` : ''}</li>`)}</ul>` : ''}
    ${state.matrix.goal3m.trim() ? html`<div class="callout"><b>Objetivo para os próximos 3 meses:</b> “${state.matrix.goal3m}”</div>` : ''}` : ''}

    ${on('escopo') && frentes.length ? html`<h2><span class="num">${sec()}</span>Escopo de atuação</h2>
    ${frentes.map((k) => { const F = CATALOG.fronts[k]; return html`<div class="avoid" style="margin-bottom:14px"><h3>${F.name}</h3>
      <table class="t"><thead><tr><th style="width:50%">O que será trabalhado</th><th>O que a clínica recebe</th></tr></thead><tbody>
      <tr><td><ul class="ck">${F.modules.map((m) => html`<li>${m}</li>`)}</ul></td><td><ul class="ck">${F.deliverables.map((m) => html`<li>${m}</li>`)}</ul>
      <p style="margin-top:8px"><b>Indicadores acompanhados:</b> ${F.kpis.join(' · ')}</p></td></tr></tbody></table></div>`; })}` : ''}

    ${on('acompanhamento') && temPrograma ? html`<h2><span class="num">${sec()}</span>Como funciona o acompanhamento</h2>
    <table class="t avoid"><thead><tr><th style="width:24%">Etapa</th><th>O que acontece</th></tr></thead><tbody>
      ${ACOMP.map(([t, d], i) => html`<tr><td><b>${t}</b></td><td>${E('pa_' + i, d)}</td></tr>`)}
    </tbody></table>` : ''}

    ${on('condicoes') ? html`<h2><span class="num">${sec()}</span>Condições</h2>
    <table class="t avoid"><tbody>
      <tr><td style="width:30%"><b>Pagamento</b></td><td>${P.payment}</td></tr>
      <tr><td><b>Formato</b></td><td>${E('pc_formato', `Encontros online${+P.onsite ? `, com ${+P.onsite} encontro(s) presencial(is) em Osasco/São Paulo incluído(s)` : ''}. Fora da Grande São Paulo, passagem e hospedagem são custeadas pela clínica, mediante aprovação prévia.`)}</td></tr>
      ${temPrograma ? html`<tr><td><b>Duração mínima</b></td><td>${E('pc_duracao', `Programas de acompanhamento: ${CATALOG.minMonths} meses.`)}</td></tr>` : ''}
      <tr><td><b>Fora do escopo</b></td><td>${E('pc_fora', `Frentes não contratadas; armazenamento de dados de pacientes${temSistema ? '; ' + CATALOG.system.outside.join('; ') : ''}.`)}</td></tr>
      <tr><td><b>Validade</b></td><td><b>${P.validity} dias corridos — até ${fmt(validade)}.</b> Após essa data, valores e disponibilidade de agenda podem ser revistos.</td></tr>
      ${(P.infoAdicional || '').trim() ? html`<tr><td><b>Informações adicionais</b></td><td style="white-space:pre-line">${P.infoAdicional.trim()}</td></tr>` : ''}
    </tbody></table>` : ''}

    ${on('adicionais') ? adicionais.map((x) => html`<h2><span class="num">${sec()}</span>${x.titulo || 'Informações'}</h2>
      <p style="white-space:pre-line">${x.texto || ''}</p>`) : ''}

    ${on('investimento') ? html`<h2><span class="num">${sec()}</span>Investimento</h2>
    ${opts.length ? html`<div class="opts">${P.options.map((o, i) => cartaoOpcao(o, i))}</div>` : html`<p class="empty">Monte as opções no painel acima.</p>`}` : ''}
    ${on('custos') && extras.length ? html`<div class="avoid"><h3 style="margin-top:18px">Custos adicionais</h3>
      <table class="t"><thead><tr><th>Descrição</th><th style="width:22%">Cobrança</th><th style="width:20%;text-align:right">Valor</th></tr></thead><tbody>
        ${extras.map((x) => html`<tr><td>${x.desc}</td><td>${(COBRANCA_EXTRA.find(([v]) => v === x.cobranca) || COBRANCA_EXTRA[0])[1]}</td><td style="text-align:right"><b>${brl2(x.valor)}</b></td></tr>`)}
      </tbody></table>
      <p class="hint" style="margin-top:6px">Os custos adicionais somam-se ao valor da opção escolhida.</p></div>` : ''}

    ${on('proximos') ? html`<h2><span class="num">${sec()}</span>Próximos passos</h2>
    <ul class="ck">${PASSOS.map((t, i) => html`<li>${E('pp_' + i, t)}</li>`)}</ul>` : ''}
    ${on('aceite') ? html`<table class="t avoid" style="margin-top:22px"><thead><tr><th style="width:50%">Aceite da clínica</th><th>ELOGA</th></tr></thead><tbody>
      <tr><td style="height:70px">Opção escolhida: ____<br><br>Nome: ________________________ Data: __/__/____</td><td>Helle Machado<br>Consultoria &amp; Estratégias em Saúde</td></tr></tbody></table>` : ''}
  </div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Proposta válida até ${fmt(validade)}</span></div>`;
}
