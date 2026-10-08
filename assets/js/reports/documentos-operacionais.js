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
const listaNatural = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' e ' + a.at(-1) : a[0] || '');
const SIST = { nenhum: 'Nenhum', planilha: 'Planilha', sistema: 'Sistema' };

/** Síntese técnica da leitura por pilar: autodiagnóstico (0–100) × sessão (critérios 0–3). */
function resumoLeitura(state, ev) {
  const notas = FRONT_KEYS.map((k) => ({ k, v: num(state.auto.pillars[k]) })).filter((x) => x.v !== null).sort((a, b) => a.v - b.v);
  const nome = (k) => CATALOG.fronts[k].pillar.toLowerCase();
  const partes = ['O quadro cruza a percepção da gestão, registrada no autodiagnóstico (0 a 100), com a análise técnica da ELOGA na sessão de diagnóstico, que pontua gravidade, impacto financeiro, urgência e prontidão dos dados (0 a 3).'];
  const frageis = notas.filter((x) => x.v < 60).slice(0, 2);
  if (frageis.length) partes.push(`${frageis.length > 1 ? 'Os pilares' : 'O pilar'} ${frageis.map((x) => `${nome(x.k)} (${x.v}/100)`).join(' e ')} ${frageis.length > 1 ? 'concentram' : 'concentra'} as menores notas, sinal de processos informais ou dependentes de pessoas, com efeito direto sobre receita, continuidade terapêutica e previsibilidade da operação.`);
  else if (notas.length) partes.push(`Nenhum pilar está abaixo de 60/100; o ganho está em padronizar e medir o que já funciona, começando por ${nome(notas[0].k)} (${notas[0].v}/100).`);
  const prio = ev.rows.filter((r) => ev.fronts.includes(r.k));
  if (prio.length) partes.push(`Na sessão, ${prio.map((r) => `${nome(r.k)} (gravidade + impacto ${r.gi}/6)`).join(' e ')} ${prio.length > 1 ? 'confirmaram-se como frentes prioritárias' : 'confirmou-se como frente prioritária'}.`);
  const divergentes = ev.rows.filter((r) => (num(state.auto.pillars[r.k]) ?? 0) >= 60 && r.gi >= 4).map((r) => nome(r.k));
  if (divergentes.length) partes.push(`Em ${divergentes.join(' e ')}, a nota do autodiagnóstico é mais alta do que a gravidade observada na sessão: a percepção interna tende a subestimar o risco, o que reforça a necessidade de medir com dados.`);
  partes.push('Sem intervenção estruturada, essas lacunas permanecem fora dos indicadores e tendem a se refletir em perda de receita e sobrecarga da equipe.');
  return partes.join(' ');
}

/** Pontuação da sessão em pontos (●●○): leitura rápida dos 4 critérios. */
function pontos(v) {
  return html`<span class="dots" aria-label="${v ?? '—'} de 3">${[1, 2, 3].map((i) => html`<i class="${v != null && v >= i ? 'on' : ''}"></i>`)}</span>`;
}
const LETRA = { g: 'G', i: 'I', u: 'U', p: 'P' };

export function relatorioHtml({ state, cliente, autodiag, logo, editavel = true }) {
  const ev = avaliar(state), st = situacaoDados(state, ev), F = CATALOG.formats;
  const ocultos = state.report.ocultos || {};
  // Seleção por item: na tela, cada item tem a sua caixa; desmarcado fica apagado e não vai para o PDF.
  // Na versão publicada (editavel = false), os itens desmarcados simplesmente não aparecem.
  const caixa = (attr, ligado) => (editavel ? html`<input type="checkbox" class="sel-item no-print" ${attr} ${ligado ? html`checked` : ''} title="Aparecer no PDF" aria-label="Aparecer no PDF">` : '');
  const vis = (k) => editavel || !ocultos[k];
  const cl = (k) => (ocultos[k] ? 'fora' : '');
  const sel = (k) => caixa(html`data-item="${k}"`, !ocultos[k]);
  const selP = (cam, ligado) => caixa(html`data-chk="${cam}"`, ligado);
  const E = editavel ? (k, d) => ed(state, k, d) : (k, d) => html`${state.report.edits[k] ?? d}`;
  const EK = (cam, v) => (editavel ? html`<span class="editable" contenteditable="true" data-edk="${cam}">${v}</span>` : html`${v}`);

  const achados = state.matrix.findings.map((f, i) => ({ ...f, i: f.i, idx: i })).filter((f) => f.t.trim() && (editavel || f.on !== false));
  const recs = state.matrix.quickwins.map((x, i) => ({ t: recTexto(x), on: recAtiva(x), idx: i })).filter((x) => x.t.trim() && (editavel || x.on));
  const extrasDe = (k) => (state.session.extras || []).map((c, i) => ({ ...c, idx: i }))
    .filter((c) => (k === null ? !state.session.fronts.includes(c.pilar) : c.pilar === k) && (String(c.titulo || '').trim() || String(c.valor || '').trim()) && (editavel || c.on !== false));
  const complementares = extrasDe(null);
  const nomesPrio = ev.fronts.map((k) => CATALOG.fronts[k].name);
  const x = state.session.ctx || {};
  const cap = capacidade(x);
  const perfil = autodiag ? Object.entries({ ...(autodiag.identification?.estrutura || {}) })
    .filter(([, v]) => (Array.isArray(v) ? v.length : String(v || '').trim()))
    .map(([k, v]) => [k, ROTULOS_CAMPOS['estrutura.' + k] || k, Array.isArray(v) ? v.join(', ') : v]) : [];
  const prioridades = autodiag?.priorities || [];
  const naoSei = autodiag?.unknowns || [];
  const diasAbertos = DIAS.filter(([k]) => x.dias?.[k]?.aberto);
  const horas = (m) => (m ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : '—');
  const MOD = { individual: 'Individual', grupo: 'Em grupo', misto: 'Misto' };
  const linhasContexto = [
    ['esp', 'Especialidades', [...(x.especialidades || []), x.especialidadesOutras].filter(Boolean).join(', ')],
    ['formato', 'Formato dos atendimentos', MOD[x.modalidade] ? `${MOD[x.modalidade]} · ${x.duracao || '—'} min${cap?.modo !== 'especialidade' && +x.simultaneos > 1 ? ` · ${x.simultaneos} atendimentos simultâneos` : ''}` : ''],
    ['estrutura', 'Estrutura', [x.salas && `${x.salas} sala(s)`, (cap?.modo === 'especialidade' ? cap.profissionais : x.profissionais) && `${cap?.modo === 'especialidade' ? cap.profissionais : x.profissionais} profissional(is) de atendimento`, x.administrativos && `${x.administrativos} na equipe administrativa`].filter(Boolean).join(' · ')],
    ['realizados', 'Atendimentos realizados por mês', x.atendimentosMes ? n0(x.atendimentosMes) : ''],
    ['receita', 'Fonte de receita', [x.mix?.convenio && `Convênio ${x.mix.convenio}%`, x.mix?.particular && `Particular ${x.mix.particular}%`, x.mix?.liminar && `Liminar ${x.mix.liminar}%`].filter(Boolean).join(' · ')],
    ['cobranca', 'Modelos de cobrança', (x.cobranca || []).join(', ')],
    ['valores', 'Valores praticados', [x.valorSessao && `Sessão avulsa ${brl(x.valorSessao)}`, x.pacoteValor && `Pacote ${x.pacoteSessoes ? x.pacoteSessoes + ' sessões ' : ''}${brl(x.pacoteValor)}`, x.mensalidade && `Mensalidade ${brl(x.mensalidade)}`].filter(Boolean).join(' · ')],
    ['sistemas', 'Sistemas', Object.entries(x.sistemas || {}).filter(([, v]) => v).map(([k, v]) => `${({ agenda: 'Agenda', prontuario: 'Prontuário', crm: 'CRM', faturamento: 'Faturamento' })[k]}: ${SIST[v]}`).join(' · ')],
    ['obs', 'Observações', x.observacoes],
  ].filter(([k, , v]) => String(v || '').trim() && vis('ctx_' + k));

  // Caminho recomendado: frentes, entregas e indicadores do catálogo
  const frentesCam = ev.fronts.filter((k) => CATALOG.fronts[k]);
  const entregas = frentesCam.flatMap((k) => CATALOG.fronts[k].deliverables.slice(0, frentesCam.length > 1 ? 2 : 4));
  const indicadores = frentesCam.flatMap((k) => CATALOG.fronts[k].kpis.slice(0, frentesCam.length > 1 ? 2 : 4));
  const alvo = listaNatural(nomesPrio.map((y) => y.toLowerCase()));
  const tituloCam = !ev.format ? `Estruturar ${alvo || 'a frente prioritária'} com método e indicadores`
    : ev.format === 'kit' ? `Organizar os registros de ${alvo} para decidir com dados`
    : ev.format === 'analise' ? `Medir ${alvo} e transformar a análise em plano de ação`
    : ev.format === 'autonomo' ? 'Organizar a gestão do consultório com acompanhamento próximo'
    : `Estruturar ${alvo} com acompanhamento e resultado medido`;
  const porQueAgora = [
    cap?.receitaLacuna ? `Para chegar à ocupação ideal de ${cap.ocupacaoIdeal}%, faltam ${n0(cap.lacuna)} atendimentos por mês, o equivalente a ${brl(cap.receitaLacuna)} mensais.` : cap?.receitaOciosa ? `A capacidade não utilizada representa ${brl(cap.receitaOciosa)} por mês.` : '',
    achados.filter((f) => f.on !== false && f.i).length ? `Os achados da sessão já apontam impacto mensurável (${achados.filter((f) => f.on !== false && f.i).map((f) => f.i).slice(0, 2).join('; ')}).` : '',
    'Cada mês sem linha de base é um mês de resultado que não poderá ser medido nem recuperado.',
  ].filter(Boolean).join(' ');

  const S = {
    resumo: () => html`<h2>${'{n}'}Resumo executivo</h2>
      <p class="exec">${E('exec', state.matrix.exec.trim() || resumoAuto(state, cliente, ev))}</p>
      ${vis('res_kpis') ? html`<div class="kpis ${cl('res_kpis')}">${sel('res_kpis')}<div class="kpi"><small>Nota geral</small><b>${state.auto.overall === '' ? '—' : state.auto.overall + '/100'}</b></div>
        <div class="kpi"><small>Nível de maturidade</small><b>${state.auto.level || '—'}</b></div>
        <div class="kpi"><small>${nomesPrio.length > 1 ? 'Frentes prioritárias' : 'Frente prioritária'}</small><b style="font-size:${nomesPrio.length > 1 ? 14 : 17}px">${nomesPrio.join(' · ') || '—'}</b></div></div>` : ''}`,
    maturidade: () => html`<h2>${'{n}'}Maturidade por pilar</h2>
      <div class="radar-wrap avoid"><div>${radar(state)}</div>
        <div><p>${E('radar', 'O radar consolida as notas do autodiagnóstico preenchido pela gestão, de 0 a 100 por pilar. Quanto mais próximo da borda, mais estruturado o pilar.')}</p>
        <p class="hint">Faixas: abaixo de 40 inicial · 40 a 59 em estruturação · 60 a 79 estruturada · 80 ou mais orientada por dados.</p></div></div>`,
    leitura: () => html`<h2>${'{n}'}Leitura por pilar</h2>
      <table class="t leitura"><thead><tr><th style="width:21%">Pilar</th><th style="width:40%"><span class="fonte fa">A</span> Autodiagnóstico</th><th><span class="fonte fs">S</span> Sessão de diagnóstico</th></tr></thead><tbody>
      ${FRONT_KEYS.filter((k) => vis('lei_' + k)).map((k) => { const v = num(state.auto.pillars[k]); const l = v === null ? null : levelOf(v);
        const explorada = state.session.fronts.includes(k), s0 = state.matrix.scores[k] || {};
        const pontuada = CRIT.some(([c]) => s0[c] != null), gi = (s0.g ?? 0) + (s0.i ?? 0);
        const extras = extrasDe(k);
        return html`<tr class="avoid ${cl('lei_' + k)}"><td>${sel('lei_' + k)}<b>${CATALOG.fronts[k].pillar}</b>${ev.fronts.includes(k) ? html` <span class="pill p-top">prioritária</span>` : ''}</td>
          <td><div>${v === null ? '—' : html`<b>${v}/100</b>`} ${l === null ? '' : html`<span class="pill ${NIVEL_CLASSE[l]}">${LEVELS[l].name}</span>`}</div>
            <div class="hint" style="margin-top:4px">${E('pil_' + k, l === null ? '—' : READ[k][l])}</div></td>
          <td>${explorada ? html`${pontuada ? html`<div class="crit-linha">${CRIT.map(([c, nome]) => html`<span class="crit" title="${nome}"><b>${LETRA[c]}</b>${pontos(s0[c])}</span>`)}<span class="gi">G+I <b>${gi}/6</b></span></div>` : html`<span class="hint">Explorado na sessão, sem pontuação na matriz.</span>`}
              ${state.report.edits['ses_' + k] ? html`<div class="hint" style="margin-top:4px">${E('ses_' + k, '')}</div>` : ''}
              ${extras.map((c) => html`<div class="extra-pilar ${c.on === false ? 'fora' : ''}">${selP(`session.extras.${c.idx}.on`, c.on !== false)}<b>${EK(`session.extras.${c.idx}.titulo`, c.titulo || 'Informação')}:</b> ${EK(`session.extras.${c.idx}.valor`, c.valor || '')}</div>`)}`
            : html`<span class="hint">Não explorado na sessão.</span>`}</td></tr>`; })}</tbody></table>
      <p class="legenda"><span class="fonte fa">A</span> respostas da gestão no autodiagnóstico, de 0 a 100 · <span class="fonte fs">S</span> análise da ELOGA na sessão de 45 minutos, de 0 a 3:
        <b>G</b> gravidade · <b>I</b> impacto financeiro · <b>U</b> urgência · <b>P</b> prontidão dos dados (${pontos(2)} = 2 de 3). <b>G+I</b> define a prioridade.</p>
      ${vis('lei_resumo') ? html`<div class="sintese avoid ${cl('lei_resumo')}">${sel('lei_resumo')}<small>Síntese da leitura</small><p>${E('lei_resumo', resumoLeitura(state, ev))}</p></div>` : ''}`,
    autodiag: () => (!autodiag ? '' : html`<h2 class="pb">${'{n}'}O que o autodiagnóstico revelou</h2>
      ${prioridades.length ? html`<p>${E('ad_intro', 'As três prioridades apontadas pelas respostas da gestão, com as respostas literais:')}</p>
        ${prioridades.map((p, i) => (vis('ad_p' + i) ? html`<div class="prio avoid ${cl('ad_p' + i)}">${sel('ad_p' + i)}<b>${i + 1}. ${CATALOG.fronts[p.id]?.pillar || p.id}</b> <span class="hint">· ${p.nota ?? '—'}/100</span>
          ${(p.itens || []).map((it, j) => (vis(`ad_p${i}_${j}`) ? html`<p class="quote ${cl(`ad_p${i}_${j}`)}">${sel(`ad_p${i}_${j}`)}${E(`ad_p${i}_${j}`, `Respondeu “${it.rotulo}” para: ${limparItem(it.t)}`)}</p>` : ''))}</div>` : ''))}` : ''}
      ${naoSei.length ? html`<h3>O que a operação ainda não enxerga</h3><p>${E('ad_naosei', 'Itens marcados como “Não sei”: mostram onde faltam dados para decidir com segurança.')}</p>
        <ul class="ck">${naoSei.map((y, i) => (vis('ad_n' + i) ? html`<li class="${cl('ad_n' + i)}">${sel('ad_n' + i)}<b>${y.pillar}:</b> ${E('ad_n' + i, limparItem(y.t))}</li>` : ''))}</ul>` : ''}
      ${perfil.length ? html`<h3>Perfil da operação declarado</h3><table class="t avoid"><tbody>${perfil.filter(([k]) => vis('ad_f_' + k)).map(([k, r, v]) => html`<tr class="${cl('ad_f_' + k)}"><td style="width:36%">${sel('ad_f_' + k)}<b>${r}</b></td><td>${E('ad_f_' + k, v)}</td></tr>`)}</tbody></table>` : ''}`),
    contexto: () => (!linhasContexto.length && !diasAbertos.length ? '' : html`<h2>${'{n}'}Contexto da operação</h2>
      ${diasAbertos.length && vis('ctx_horario') ? html`<div class="${cl('ctx_horario')}"><h3>${sel('ctx_horario')}Horário de funcionamento</h3>
      <table class="t avoid grade-horario"><thead><tr><th>Dia</th><th>Abertura</th><th>Fechamento</th><th>Intervalo</th><th style="text-align:right">Horas de atendimento</th></tr></thead><tbody>
        ${DIAS.map(([k, nome]) => { const d = x.dias?.[k]; if (!d?.aberto) return html`<tr class="fechado"><td>${nome}</td><td colspan="4">Fechado</td></tr>`;
          return html`<tr><td><b>${nome}</b></td><td>${d.ini || '—'}</td><td>${d.fim || '—'}</td><td>${d.intIni && d.intFim ? `${d.intIni} às ${d.intFim}` : 'Sem intervalo'}</td><td style="text-align:right">${horas(minutosDeAtendimento(d))}</td></tr>`; })}
        <tr class="total"><td colspan="4"><b>Total semanal</b></td><td style="text-align:right"><b>${horas(DIAS.reduce((t, [k]) => t + minutosDeAtendimento(x.dias?.[k]), 0))}</b></td></tr></tbody></table></div>` : ''}
      ${linhasContexto.length ? html`<h3>Estrutura e modelo de atendimento</h3>
      <table class="t avoid"><tbody>${linhasContexto.map(([k, r, v]) => html`<tr class="${cl('ctx_' + k)}"><td style="width:32%">${sel('ctx_' + k)}<b>${r}</b></td><td style="white-space:pre-line">${E('ctx_' + k, v)}</td></tr>`)}</tbody></table>` : ''}`),
    capacidade: () => (!cap ? '' : html`<h2 class="pb">${'{n}'}Capacidade de atendimento</h2>
      <p>${E('cap_intro', cap.modo === 'especialidade'
        ? `Calculada a partir do horário de funcionamento (sem os intervalos de fechamento), da duração de ${cap.duracao} minutos por atendimento e dos profissionais e atendimentos simultâneos de cada especialidade${cap.salas ? `, considerando ${cap.salas} sala(s) compartilhada(s)` : ''}: ${cap.porHorario} atendimento(s) possível(is) por horário.`
        : `Calculada a partir do horário de funcionamento (sem os intervalos de fechamento), da duração de ${cap.duracao} minutos por atendimento e de ${cap.porHorario} atendimento(s) possível(is) por horário: o menor número entre salas (${cap.salas}) e profissionais (${cap.profissionais})${cap.simultaneos > 1 ? `, com ${cap.simultaneos} atendimentos simultâneos` : ''}.`)}</p>
      ${cap.modo === 'especialidade' && vis('cap_esp') ? html`<table class="t avoid ${cl('cap_esp')}"><thead><tr><th>${sel('cap_esp')}Especialidade</th><th style="text-align:center">Profissionais</th><th style="text-align:center">Atendimentos simultâneos</th><th style="text-align:center">Por horário</th><th style="text-align:right">Por mês</th></tr></thead><tbody>
        ${cap.especialidades.map((e) => html`<tr><td><b>${e.nome}</b></td><td style="text-align:center">${e.prof}</td><td style="text-align:center">${e.simult}</td><td style="text-align:center">${e.porHorario}</td><td style="text-align:right">${n0(e.mensal)}</td></tr>`)}</tbody></table>` : ''}
      ${vis('cap_kpis') ? html`<div class="kpis k4 ${cl('cap_kpis')}">${sel('cap_kpis')}<div class="kpi"><small>Por semana</small><b>${n0(cap.semanal)}</b></div><div class="kpi"><small>Por mês</small><b>${n0(cap.mensal)}</b></div>
        <div class="kpi"><small>Ocupação atual</small><b>${cap.ocupacao === null ? '—' : cap.ocupacao + '%'}</b></div>
        <div class="kpi ideal"><small>Ocupação ideal</small><b>${cap.ocupacaoIdeal}%</b><span>${n0(cap.metaMensal)} atend./mês</span></div></div>
        ${cap.ocupacao !== null ? html`<div class="ocup avoid"><div class="barra"><i style="width:${Math.min(100, cap.ocupacao)}%"></i><b style="left:${cap.ocupacaoIdeal}%" title="Ideal"></b></div>
          <p>${E('cap_ocup', cap.lacuna > 0 ? `A operação utiliza ${cap.ocupacao}% da capacidade. Para atingir a ocupação ideal de ${cap.ocupacaoIdeal}%, seriam necessários ${n0(cap.lacuna)} atendimentos a mais por mês${cap.receitaLacuna ? `, o equivalente a ${brl(cap.receitaLacuna)} mensais` : ''}. A faixa ideal preserva folga para reposições, faltas e encaixes da lista de espera.`
            : cap.lacuna < 0 ? `A operação utiliza ${cap.ocupacao}% da capacidade, acima da ocupação ideal de ${cap.ocupacaoIdeal}%. Agenda acima do ideal reduz a folga para reposições e encaixes e aumenta o risco de sobrecarga da equipe; o próximo passo é planejar a ampliação da capacidade.`
            : `A operação está na ocupação ideal de ${cap.ocupacaoIdeal}%, com folga para reposições, faltas e encaixes.`)}</p></div>` : html`<p class="hint">Ocupação ideal de referência: ${cap.ocupacaoIdeal}% da capacidade (${n0(cap.metaMensal)} atendimentos por mês), preservando folga para reposições, faltas e encaixes.</p>`}` : ''}
      ${vis('cap_dias') ? html`<table class="t avoid ${cl('cap_dias')}"><thead><tr><th>${sel('cap_dias')}Dia</th><th>Horas de atendimento</th><th>Horários</th><th>Atendimentos possíveis</th></tr></thead><tbody>
        ${cap.porDia.filter((d) => d.aberto).map((d) => html`<tr><td>${d.nome}</td><td>${horas(d.minutos)}</td><td>${d.horarios}</td><td>${n0(d.atendimentos)}</td></tr>`)}</tbody></table>` : ''}
      ${vis('cap_garg') ? html`<div class="callout avoid ${cl('cap_garg')}">${sel('cap_garg')}<p><b>Gargalo:</b> ${E('cap_garg', cap.gargalo === 'sem_salas' ? 'informe o número de salas para identificar o gargalo.' : cap.gargalo === 'equilibrado' ? 'salas e profissionais estão equilibrados.' : cap.gargalo === 'salas'
        ? `as salas. Há ${cap.ociosos} profissional(is) a mais do que salas no mesmo horário; com mais uma sala, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`
        : `os profissionais. Há ${cap.ociosos} sala(s) sem profissional no mesmo horário; com mais um profissional, a capacidade cresce em ${n0(cap.ganhoMensal)} atendimentos por mês.`)}</p>
        ${cap.receitaPotencial ? html`<p style="margin-top:6px">${E('cap_receita', `Receita potencial com a agenda cheia: ${brl(cap.receitaPotencial)}/mês${cap.receitaOciosa ? ` · capacidade não utilizada: ${brl(cap.receitaOciosa)}/mês` : ''} (valor médio de ${brl(cap.ticket)} por atendimento).`)}</p>` : ''}</div>` : ''}`),
    achados: () => html`<h2>${'{n}'}Principais achados</h2>
      ${achados.length ? html`<table class="t avoid"><thead><tr><th style="width:9%">#</th><th>Achado</th><th style="width:26%">Impacto estimado</th></tr></thead><tbody>
        ${achados.map((f, i) => html`<tr class="${f.on === false ? 'fora' : ''}"><td style="white-space:nowrap">${selP(`matrix.findings.${f.idx}.on`, f.on !== false)}${i + 1}</td><td>${EK(`matrix.findings.${f.idx}.t`, f.t)}</td><td>${EK(`matrix.findings.${f.idx}.i`, f.i || 'A medir na linha de base')}</td></tr>`)}</tbody></table>`
        : html`<p class="empty">Registre os achados na aba Matriz.</p>`}`,
    recomendacoes: () => html`<h2>${'{n}'}Recomendações imediatas</h2><p>${E('rec_intro', 'Ações que a gestão pode iniciar desde já e o que cada uma prepara para a etapa seguinte:')}</p>
      ${recs.length ? html`<ul class="ck">${recs.map((y) => html`<li class="${y.on ? '' : 'fora'}">${selP(`matrix.quickwins.${y.idx}.on`, y.on)}${EK(`matrix.quickwins.${y.idx}.t`, y.t)}</li>`)}</ul>` : html`<p class="empty">Registre as recomendações na aba Matriz.</p>`}`,
    complementares: () => (!complementares.length ? '' : html`<h2>${'{n}'}Informações complementares</h2>
      <table class="t avoid"><tbody>${complementares.map((c) => html`<tr class="${c.on === false ? 'fora' : ''}"><td style="width:32%">${selP(`session.extras.${c.idx}.on`, c.on !== false)}<b>${EK(`session.extras.${c.idx}.titulo`, c.titulo || '—')}</b></td><td style="white-space:pre-line">${EK(`session.extras.${c.idx}.valor`, c.valor || '')}</td></tr>`)}</tbody></table>`),
    dados: () => html`<h2>${'{n}'}Situação dos dados</h2>
      <p><span class="pill ${st[0] === 'apto' ? 'p-ok' : 'p-warn'}">${st[1]}</span></p><p>${E('data', st[2])}</p>
      ${state.session.C.some((y) => y.n || y.v) && vis('dados_tab') ? html`<table class="t avoid ${cl('dados_tab')}"><thead><tr><th>${sel('dados_tab')}Verificação</th><th style="width:14%">Situação</th><th>Detalhe</th></tr></thead><tbody>
        ${QC.map((p, i) => html`<tr><td>${p}</td><td>${({ sim: 'Sim', parcial: 'Parcial', nao: 'Não' })[state.session.C[i].v] || '—'}</td><td>${EK(`session.C.${i}.n`, state.session.C[i].n)}</td></tr>`)}</tbody></table>` : ''}`,
    caminho: () => html`<h2>${'{n}'}Caminho recomendado</h2>
      <div class="caminho avoid">
        <div class="cam-topo"><small>Próximo passo recomendado</small>
          <h3>${E('cam_titulo', tituloCam)}</h3>
          <p>${ev.format ? html`<span class="cam-formato">${F[ev.format].name}</span> ` : ''}${E('path', ev.format ? F[ev.format].desc : '')}</p></div>
        <div class="cam-grid">
          ${entregas.length && vis('cam_entregas') ? html`<div class="${cl('cam_entregas')}">${sel('cam_entregas')}<small>O que a clínica passa a ter</small><ul class="ck">${entregas.map((y, i) => html`<li>${E('cam_e' + i, y)}</li>`)}</ul></div>` : ''}
          ${indicadores.length && vis('cam_kpis') ? html`<div class="${cl('cam_kpis')}">${sel('cam_kpis')}<small>Como o resultado será medido</small><ul class="ck">${indicadores.map((y, i) => html`<li>${E('cam_k' + i, y)}</li>`)}</ul></div>` : ''}
          ${vis('cam_agora') ? html`<div class="${cl('cam_agora')}">${sel('cam_agora')}<small>Por que começar agora</small><p>${E('cam_agora', porQueAgora)}</p></div>` : ''}
        </div>
        ${state.matrix.goal3m.trim() && vis('cam_obj') ? html`<p class="cam-obj ${cl('cam_obj')}">${sel('cam_obj')}<b>Objetivo declarado pela gestão para os próximos 3 meses:</b> “${EK('matrix.goal3m', state.matrix.goal3m)}”</p>` : ''}
        <div class="cam-cta"><b>${E('cam_cta_t', 'Conheça a proposta')}</b><span>${E('fecho', `As opções, o escopo e o investimento estão na proposta comercial, apresentada na devolutiva${state.session.devolutiva ? ' (' + state.session.devolutiva + ')' : ''}. Escolha o formato que melhor se ajusta ao momento da clínica e inicie a implantação.`)}</span></div>
      </div>`,
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
