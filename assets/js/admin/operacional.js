// Diagnóstico operacional do cliente (uso exclusivo da administração):
// Preparação · Sessão de 45 min · Matriz de encaixe · Relatório · Proposta.
// Estado salvo automaticamente em operational_diagnoses.data.
import { db, q, registrar } from '../core/api.js';
import { html, montar, $, $$, debounce, fmtData, fmtDataHora, imprimirDocumento, nomeArquivo } from '../core/dom.js';
import { avisar, avisarErro, confirmar, ocupado } from '../core/ui.js';
import { CATALOG, FRONT_KEYS, QB, QC, QD, CRIT, PH, estadoPadrao, mesclar, num, candidatas, sc, avaliar, semearOpcoes, somarDias,
  DIAS, ESPECIALIDADES, COBRANCAS, SISTEMAS, NIVEL_SISTEMA, capacidade, recorrente, usaFrentes } from './operacional-modelo.js';
import { carregarCatalogo } from './catalogo.js';
import { brl } from '../core/dom.js';
import { relatorioHtml, propostaHtml, SECOES_RELATORIO, secaoAtiva } from '../reports/documentos-operacionais.js';

const ETAPAS = ['lead', 'autodiagnostico', 'diagnostico_operacional', 'relatorio_emitido', 'proposta_emitida', 'cliente_ativo'];

/** Copia os dados do autodiagnóstico importado para o estado do diagnóstico. */
export function aplicarAutodiagnostico(state, auto) {
  if (!auto) return;
  state.auto.overall = auto.overall ?? '';
  state.auto.level = auto.level || '';
  state.auto.leadClass = auto.lead_class || '';
  state.auto.date = auto.filled_at ? String(auto.filled_at).slice(0, 10) : '';
  for (const p of auto.pillars || []) if (p.id in state.auto.pillars) state.auto.pillars[p.id] = p.score ?? '';
  const d = auto.identification?.dores || {};
  const partes = [];
  if (d.preocupacoes?.length) partes.push('Preocupações: ' + [].concat(d.preocupacoes).join(', '));
  if (d.contexto) partes.push('Contexto: ' + d.contexto);
  if (d.impacto) partes.push('Impacto percebido: ' + d.impacto);
  if (d.tempo) partes.push('Há quanto tempo: ' + d.tempo);
  const dec = auto.identification?.decisao || {};
  if (dec.momento) partes.push('Momento: ' + dec.momento + (dec.decisor ? ' · Decisor: ' + dec.decisor : '') + (dec.investimento ? ' · Investimento: ' + dec.investimento : ''));
  if (partes.length && !state.auto.notes) state.auto.notes = partes.join('\n');
  if (!state.session.fronts.length) state.session.fronts = candidatas(state);
}

async function subirEtapa(cliente, etapa) {
  if (ETAPAS.indexOf(cliente.stage) >= ETAPAS.indexOf(etapa)) return;
  await q(db.from('clients').update({ stage: etapa }).eq('id', cliente.id));
  cliente.stage = etapa;
}

export async function criarOperacional({ cliente, autodiag, logo }) {
  await carregarCatalogo();
  const lista = await q(db.from('operational_diagnoses').select('*').eq('client_id', cliente.id).order('updated_at', { ascending: false }).limit(1));
  let registro = lista[0] || null;
  let state = mesclar(estadoPadrao(), registro?.data || {});
  if (!registro) {
    state.client.profile = cliente.profile || 'terapias';
    state.client.payer = cliente.payer || 'misto';
    aplicarAutodiagnostico(state, autodiag);
  }
  let sujo = false, salvando = false, flagEl = null;
  const flag = (t, c = '') => { if (flagEl) { flagEl.textContent = t; flagEl.className = 'saveflag ' + c; } };

  async function gravar() {
    if (!sujo || salvando) return;
    salvando = true; sujo = false; flag('Salvando...');
    try {
      if (registro) registro = await q(db.from('operational_diagnoses').update({ data: state }).eq('id', registro.id).select().single());
      else {
        registro = await q(db.from('operational_diagnoses').insert({ client_id: cliente.id, data: state }).select().single());
        await subirEtapa(cliente, 'diagnostico_operacional');
      }
      flag('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) { sujo = true; flag('Não salvo — tente novamente', 'bad'); avisarErro(e); }
    finally { salvando = false; }
  }
  const salvar = debounce(gravar, 900);
  const mudou = () => { sujo = true; flag('Alterações não salvas...'); salvar(); };

  // ------------------------------------------------------------ util de caminho
  const get = (p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
  const set = (p, v) => { const ks = p.split('.'); let o = state; ks.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; }); o[ks.at(-1)] = v; };
  const campoTexto = (n, pergunta, caminho) => html`<div class="op-q"><div class="qt"><span class="qn">${n}</span>${pergunta}</div>
    <textarea data-k="${caminho}" rows="2" style="min-height:52px">${get(caminho) ?? ''}</textarea></div>`;
  const seg = (caminho, opcoes) => html`<div class="seg" role="group">${opcoes.map(([v, r]) => html`<button type="button" data-seg="${caminho}" data-v="${v}" class="${get(caminho) === v ? 'on' : ''}" aria-pressed="${get(caminho) === v}">${r}</button>`)}</div>`;

  // ------------------------------------------------------------ PREPARAÇÃO
  function preparacao() {
    const cand = candidatas(state);
    return html`<div class="stack">
      <div class="card"><div class="card-head"><div><h2>Preparação da sessão</h2><p>Dados do autodiagnóstico que orientam a conversa. Ajuste se necessário.</p></div>
        ${autodiag ? html`<button class="btn sm secondary" type="button" data-acao="reaplicar">Recarregar do autodiagnóstico importado</button>` : html`<a class="btn sm purple" href="#/importar/${cliente.id}">Importar autodiagnóstico</a>`}</div>
        <div class="grid g4">
          <div class="field"><label>Data da sessão de 45 min</label><input type="date" data-k="client.sessionDate" value="${state.client.sessionDate}"></div>
          <div class="field"><label>Perfil</label><select data-k="client.profile">${[['terapias', 'Clínica de terapias multiprofissional'], ['estetica', 'Clínica de estética'], ['autonomo', 'Profissional autônomo'], ['outro', 'Outro']].map(([v, t]) => html`<option value="${v}" ${state.client.profile === v ? html`selected` : ''}>${t}</option>`)}</select></div>
          <div class="field"><label>Fonte de pagamento predominante</label><select data-k="client.payer">${[['particular', 'Particular'], ['convenio', 'Convênio'], ['misto', 'Misto (convênio + particular)']].map(([v, t]) => html`<option value="${v}" ${state.client.payer === v ? html`selected` : ''}>${t}</option>`)}</select></div>
          <div class="field"><label>Classe do lead</label><select data-k="auto.leadClass"><option value="">—</option>${['A', 'B', 'C'].map((v) => html`<option ${state.auto.leadClass === v ? html`selected` : ''}>${v}</option>`)}</select></div>
          <div class="field"><label>Nota geral (0–100)</label><input type="number" min="0" max="100" data-k="auto.overall" data-num value="${state.auto.overall}"></div>
          <div class="field"><label>Nível de maturidade</label><select data-k="auto.level"><option value="">—</option>${['Inicial', 'Em estruturação', 'Estruturada', 'Orientada por dados'].map((v) => html`<option ${state.auto.level === v ? html`selected` : ''}>${v}</option>`)}</select></div>
          <div class="field"><label>Data do autodiagnóstico</label><input type="date" data-k="auto.date" value="${state.auto.date}"></div>
        </div>
        <h3 style="margin-top:20px">Nota por pilar (0–100)</h3>
        <div class="grid g3">${FRONT_KEYS.map((k) => html`<div class="field"><label>${CATALOG.fronts[k].pillar}${cand.includes(k) ? html` <span class="badge purple">candidata</span>` : ''}</label>
          <input type="number" min="0" max="100" data-k="auto.pillars.${k}" data-num value="${state.auto.pillars[k]}"></div>`)}</div>
        <div class="field" style="margin-top:16px"><label>Observações da ficha (dores, contexto, momento)</label><textarea data-k="auto.notes" rows="4">${state.auto.notes}</textarea></div>
      </div>
      <div class="notice info">${cand.length ? html`<b>Frentes candidatas:</b> ${cand.map((k) => CATALOG.fronts[k].name + ' (' + state.auto.pillars[k] + ')').join(' e ')}. Prepare as perguntas do bloco B dessas frentes.` : 'Preencha as notas por pilar para identificar as frentes candidatas.'}</div>
    </div>`;
  }

  // ------------------------------------------------------------ SESSÃO
  let cron = { inicio: null, acumulado: 0, int: null };
  // ------------------------------------------------------------ A · CONTEXTO (preenchimento rápido)
  const chip = (caminho, valor, rotulo) => { const on = (get(caminho) || []).includes(valor);
    return html`<button type="button" class="chip ${on ? 'on' : ''}" data-lista="${caminho}" data-v="${valor}" aria-pressed="${on}">${rotulo || valor}</button>`; };
  const numero = (caminho, rotulo, extra = '') => html`<div class="field"><label>${rotulo}</label><input type="number" min="0" inputmode="numeric" data-k="${caminho}" data-num data-ctx value="${get(caminho) ?? ''}" ${extra}></div>`;

  function caixaCapacidade() {
    const c = capacidade(state.session.ctx);
    if (!c) return html`<div class="notice info">Informe duração, salas e profissionais para calcular a capacidade.</div>`;
    const n = (v) => Number(v).toLocaleString('pt-BR');
    return html`<div class="grid g4">
      <div class="kpi accent"><div class="k-label">Por horário</div><div class="k-value">${n(c.porHorario)}</div><div class="k-note" style="color:#a9bcc6">menor entre ${c.salas} sala(s) e ${c.profissionais} profissional(is) × ${c.simultaneos}</div></div>
      <div class="kpi"><div class="k-label">Por semana</div><div class="k-value">${n(c.semanal)}</div><div class="k-note">${c.diasAbertos} dia(s) de atendimento</div></div>
      <div class="kpi"><div class="k-label">Por mês</div><div class="k-value">${n(c.mensal)}</div><div class="k-note">média de 4,33 semanas</div></div>
      <div class="kpi"><div class="k-label">Ocupação atual</div><div class="k-value">${c.ocupacao === null ? '—' : c.ocupacao + '%'}</div><div class="k-note">${c.ocupacao === null ? 'informe os atendimentos/mês' : 'realizados ÷ capacidade'}</div></div></div>
      <p class="small" style="margin:10px 0 0"><b>Gargalo:</b> ${c.gargalo === 'equilibrado' ? 'salas e profissionais equilibrados.' : c.gargalo === 'salas' ? `salas (${c.ociosos} profissional(is) sem sala no mesmo horário). Com +1 sala: +${n(c.ganhoMensal)} atendimentos/mês.` : `profissionais (${c.ociosos} sala(s) ociosa(s) por horário). Com +1 profissional: +${n(c.ganhoMensal)} atendimentos/mês.`}
      ${c.receitaPotencial ? html` · <b>Receita potencial:</b> ${brl(c.receitaPotencial)}/mês${c.receitaOciosa ? html` · <b>Capacidade ociosa:</b> ${brl(c.receitaOciosa)}/mês` : ''}` : ''}</p>`;
  }

  function contexto() {
    const x = state.session.ctx;
    return html`<div class="card"><div class="card-head"><div><h3>A · Contexto da operação</h3><p>Toque nas opções; digite só números.</p></div></div>
      <h4 class="label" style="margin:4px 0 8px">Funcionamento</h4>
      <div class="table-wrap"><table class="t"><thead><tr><th>Dia</th><th>Abre</th><th>Fecha</th><th>Intervalo (início)</th><th>Intervalo (fim)</th></tr></thead><tbody>
        ${DIAS.map(([k, nome]) => { const d = x.dias[k]; return html`<tr>
          <td><label class="check"><input type="checkbox" data-chk="session.ctx.dias.${k}.aberto" ${d.aberto ? html`checked` : ''}> ${nome}</label></td>
          ${['ini', 'fim', 'intIni', 'intFim'].map((f) => html`<td><input type="time" step="300" data-k="session.ctx.dias.${k}.${f}" data-ctx value="${d[f]}" ${d.aberto ? '' : html`disabled`} aria-label="${nome} ${f}"></td>`)}</tr>`; })}
      </tbody></table></div>
      <div class="toolbar" style="margin:8px 0 18px"><button type="button" class="btn sm secondary" data-acao="copiar-dias">Copiar segunda para terça a sexta</button>
        <span class="xs muted">Deixe o intervalo em branco se a clínica não fecha.</span></div>
      <div class="grid g4">
        ${numero('session.ctx.duracao', 'Duração do atendimento (min)')}
        <div class="field"><label>Formato</label>${seg('session.ctx.modalidade', [['individual', 'Individual'], ['grupo', 'Em grupo'], ['misto', 'Misto']])}</div>
        ${numero('session.ctx.simultaneos', 'Pacientes por sala no mesmo horário', 'min="1"')}
        ${numero('session.ctx.salas', 'Salas de atendimento')}
        ${numero('session.ctx.profissionais', 'Profissionais de atendimento')}
        ${numero('session.ctx.administrativos', 'Equipe administrativa')}
        ${numero('session.ctx.atendimentosMes', 'Atendimentos realizados/mês')}
      </div>
      <div id="caixa-capacidade" style="margin:16px 0 20px">${caixaCapacidade()}</div>
      <h4 class="label" style="margin:0 0 8px">Especialidades</h4>
      <div class="chips">${ESPECIALIDADES.map((e) => chip('session.ctx.especialidades', e))}</div>
      <input type="text" style="margin-top:8px" data-k="session.ctx.especialidadesOutras" value="${x.especialidadesOutras}" placeholder="Outras especialidades">
      <h4 class="label" style="margin:18px 0 8px">Fonte de receita (% aproximado)</h4>
      <div class="grid g3">${numero('session.ctx.mix.convenio', 'Convênio %')}${numero('session.ctx.mix.particular', 'Particular %')}${numero('session.ctx.mix.liminar', 'Liminar %')}</div>
      <h4 class="label" style="margin:18px 0 8px">Modelos de cobrança</h4>
      <div class="chips">${COBRANCAS.map((e) => chip('session.ctx.cobranca', e))}</div>
      <div class="grid g4" style="margin-top:12px">
        ${numero('session.ctx.valorSessao', 'Valor da sessão avulsa (R$)')}${numero('session.ctx.pacoteSessoes', 'Sessões no pacote')}
        ${numero('session.ctx.pacoteValor', 'Valor do pacote (R$)')}${numero('session.ctx.mensalidade', 'Mensalidade (R$)')}</div>
      <h4 class="label" style="margin:18px 0 8px">Sistemas</h4>
      <div class="grid g4">${SISTEMAS.map(([k, r]) => html`<div class="field"><label>${r}</label>${seg('session.ctx.sistemas.' + k, NIVEL_SISTEMA)}</div>`)}</div>
      <div class="field" style="margin-top:16px"><label>Observações de contexto</label><textarea rows="2" data-k="session.ctx.observacoes">${x.observacoes}</textarea></div>
    </div>`;
  }

  function sessao() {
    return html`<div class="stack">
      <div class="card tight no-print"><div class="row between"><div class="row"><span class="clock" id="clock">00:00</span>
        <button class="btn sm secondary" type="button" data-acao="cron">${cron.inicio ? 'Pausar' : cron.acumulado ? 'Retomar' : 'Iniciar'}</button>
        <button class="btn sm ghost" type="button" data-acao="cron-zerar">Zerar</button></div><span class="small muted" id="fase">Bloco atual: —</span></div>
        <div class="timeline" style="margin-top:12px">${[['0–5 min', 'Abertura'], ['5–12 min', 'A · Contexto'], ['12–30 min', 'B · Dor e impacto'], ['30–37 min', 'C · Dados'], ['37–43 min', 'D · Decisão'], ['43–45 min', 'Encerramento']].map(([t, n], i) => html`<div class="tl" data-fase="${i}"><b>${t}</b><span>${n}</span></div>`)}</div></div>
      <div class="card"><h3>Abertura</h3><div class="notice">“O objetivo de hoje é entender a sua operação a partir do autodiagnóstico. Em até 48 horas apresento o relatório de diagnóstico e o caminho recomendado.”</div>
        ${state.auto.notes ? html`<p class="small muted" style="margin-top:12px;white-space:pre-line"><b>Da ficha:</b> ${state.auto.notes}</p>` : ''}</div>
      ${contexto()}
      <div class="card"><h3>B · Dor e impacto <span class="badge purple">frentes candidatas</span></h3>
        <p class="small muted">Selecione as frentes exploradas (sugestão: as 2 menores notas do autodiagnóstico, em roxo).</p>
        <div class="chips" style="margin-bottom:10px">${FRONT_KEYS.map((k) => html`<button type="button" class="chip ${state.session.fronts.includes(k) ? 'on' : ''}" data-frente="${k}" aria-pressed="${state.session.fronts.includes(k)}" style="${candidatas(state).includes(k) && !state.session.fronts.includes(k) ? 'border-color:var(--purple);color:var(--purple)' : ''}">${CATALOG.fronts[k].name}${num(state.auto.pillars[k]) !== null ? ' · ' + state.auto.pillars[k] : ''}</button>`)}</div>
        ${state.session.fronts.length ? state.session.fronts.map((k) => { if (!state.session.B[k]) state.session.B[k] = QB[k].map(() => '');
          return html`<div style="margin:6px 0 14px"><h4 style="margin:10px 0 4px;color:var(--purple)">${CATALOG.fronts[k].name}</h4>${QB[k].map((p, i) => campoTexto(i + 1, p, `session.B.${k}.${i}`))}</div>`; })
          : html`<p class="muted"><i>Nenhuma frente selecionada.</i></p>`}</div>
      <div class="card"><h3>C · Dados disponíveis <span class="badge purple">define o formato</span></h3>
        ${QC.map((p, i) => html`<div class="op-q"><div class="qt"><span class="qn">${i + 1}</span>${p}</div><div style="margin-bottom:6px">${seg(`session.C.${i}.v`, [['sim', 'Sim'], ['parcial', 'Parcial'], ['nao', 'Não']])}</div>
          <input type="text" data-k="session.C.${i}.n" value="${state.session.C[i].n}" placeholder="Detalhe (sistema, período disponível, quem registra)"></div>`)}</div>
      <div class="card"><h3>D · Decisão</h3>${QD.map((x, i) => campoTexto(i + 1, x.q, `session.D.${x.k}`))}
        <div class="op-q"><div class="qt"><span class="qn">✓</span>O decisor participou da sessão?</div>${seg('session.D.decisorPresent', [['sim', 'Sim'], ['nao', 'Não']])}</div></div>
      <div class="card"><h3>Encerramento</h3><div class="grid g2">
        <div class="field"><label>Data e horário da devolutiva (20 min)</label><input type="text" data-k="session.devolutiva" value="${state.session.devolutiva}" placeholder="ex.: 06/10 às 14h"></div>
        <div class="field"><label>Anotações livres</label><textarea data-k="session.freeNotes">${state.session.freeNotes}</textarea></div></div></div>
    </div>`;
  }
  function tick(el) {
    const s = Math.floor((cron.acumulado + (cron.inicio ? Date.now() - cron.inicio : 0)) / 1000), m = Math.floor(s / 60);
    const c = $('#clock', el); if (!c) return;
    c.textContent = String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    const idx = PH.findIndex((p) => m < p[0]);
    $('#fase', el).textContent = 'Bloco atual: ' + (idx >= 0 ? PH[idx][1] : 'Tempo encerrado');
    $$('.tl', el).forEach((t) => t.classList.toggle('now', +t.dataset.fase === idx));
  }

  // ------------------------------------------------------------ MATRIZ
  function matriz() {
    const fr = state.session.fronts, ev = avaliar(state), F = CATALOG.formats;
    return html`<div class="stack">
      <div class="card"><div class="card-head"><div><h2>Matriz de encaixe</h2><p>Pontue cada frente explorada de 0 a 3. A ferramenta indica a frente prioritária e o formato a ofertar; você pode ajustar.</p></div></div>
      ${fr.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Frente</th>${CRIT.map((c) => html`<th style="text-align:center">${c[1]}</th>`)}<th style="text-align:center">G + I</th><th></th></tr></thead><tbody>
        ${ev.rows.map((r) => html`<tr><td><b>${CATALOG.fronts[r.k].name}</b><div class="xs muted">Autodiagnóstico: ${state.auto.pillars[r.k] === '' ? '—' : state.auto.pillars[r.k]}</div></td>
          ${CRIT.map((c) => html`<td style="text-align:center"><div class="score-btns" role="group" aria-label="${c[1]}">${[0, 1, 2, 3].map((nn) => html`<button type="button" class="${r.s[c[0]] === nn ? 'on' : ''}" data-nota="${r.k}|${c[0]}|${nn}" aria-pressed="${r.s[c[0]] === nn}">${nn}</button>`)}</div></td>`)}
          <td style="text-align:center"><b>${r.gi}</b></td><td>${ev.prioAuto === r.k ? html`<span class="badge lime">Prioritária</span>` : ''}</td></tr>`)}</tbody></table></div>`
        : html`<p class="muted"><i>Selecione as frentes exploradas na aba Sessão (bloco B).</i></p>`}
      <p class="xs muted" style="margin-top:8px"><b>Gravidade:</b> 0 pontual · 3 estrutural e recorrente | <b>Impacto:</b> 0 não identificado · 3 perda relevante ou mensurável | <b>Urgência:</b> 0 sem prazo · 3 precisa mudar agora | <b>Prontidão dos dados:</b> 0 sem registro · 3 três meses ou mais extraíveis</p></div>
      <div class="result-boxes">
        <div class="box"><small>Frente prioritária</small><div class="v">${ev.front ? CATALOG.fronts[ev.front].name : '—'}</div><p>${state.matrix.ovFront ? 'Definida manualmente.' : 'Maior soma de Gravidade + Impacto.'}</p></div>
        <div class="box"><small>Formato a ofertar</small><div class="v">${ev.format ? F[ev.format].name : '—'}</div><p>${state.matrix.ovFormat ? 'Definido manualmente.' : ev.why || 'Pontue a matriz para obter a recomendação.'}</p></div></div>
      <div class="card"><h3>Ajuste manual (opcional)</h3><div class="grid g2">
        <div class="field"><label>Frente prioritária</label><select data-k="matrix.ovFront"><option value="">Automático</option>${FRONT_KEYS.map((k) => html`<option value="${k}" ${state.matrix.ovFront === k ? html`selected` : ''}>${CATALOG.fronts[k].name}</option>`)}</select></div>
        <div class="field"><label>Formato a ofertar</label><select data-k="matrix.ovFormat"><option value="">Automático</option>${Object.entries(F).map(([k, v]) => html`<option value="${k}" ${state.matrix.ovFormat === k ? html`selected` : ''}>${v.name}</option>`)}</select></div></div></div>
      <div class="card"><h3>Principais achados <span class="badge purple">3 a 5</span></h3>
        ${state.matrix.findings.map((f, i) => html`<div class="grid" style="grid-template-columns:2fr 1fr auto;align-items:end;margin-bottom:10px">
          <div class="field"><label>Achado ${i + 1}</label><input type="text" data-k="matrix.findings.${i}.t" value="${f.t}"></div>
          <div class="field"><label>Impacto estimado (R$ ou %)</label><input type="text" data-k="matrix.findings.${i}.i" value="${f.i}"></div>
          <div>${state.matrix.findings.length > 3 ? html`<button type="button" class="btn sm ghost" data-remover-achado="${i}" aria-label="Remover achado ${i + 1}">Remover</button>` : ''}</div></div>`)}
        <button class="btn sm secondary" type="button" data-acao="mais-achado" ${state.matrix.findings.length >= 5 ? html`disabled` : ''}>+ Achado</button></div>
      <div class="card"><h3>Recomendações imediatas <span class="badge purple">o cliente aplica sozinho</span></h3>
        ${state.matrix.quickwins.map((x, i) => html`<div class="field" style="margin-bottom:8px"><label>Recomendação ${i + 1}</label><input type="text" data-k="matrix.quickwins.${i}" value="${x}"></div>`)}</div>
      <div class="card"><h3>Objetivo do cliente</h3><div class="grid g2">
        <div class="field"><label>O que precisa ser diferente em 3 meses (palavras do cliente)</label><textarea data-k="matrix.goal3m">${state.matrix.goal3m}</textarea></div>
        <div class="field"><label>Resumo executivo do relatório (3 linhas)</label><textarea data-k="matrix.exec" placeholder="Se vazio, é gerado automaticamente.">${state.matrix.exec}</textarea></div></div></div>
    </div>`;
  }

  // ------------------------------------------------------------ RELATÓRIO
  function relatorio() {
    return html`<div class="area-doc">
      <div class="card tight no-print" style="margin-bottom:12px"><div class="card-head" style="margin-bottom:8px"><div><h3 style="margin:0">Seções do relatório</h3>
        <p>Desmarque o que não deve entrar no PDF. Os textos com contorno podem ser editados direto no documento.</p></div></div>
        <div class="chips">${SECOES_RELATORIO.map(([id, nome]) => html`<label class="chip"><input type="checkbox" data-secao="${id}" ${secaoAtiva(state, id) ? html`checked` : ''}>${nome}</label>`)}</div></div>
      <div class="toolbar no-print" style="margin-bottom:12px"><span class="small muted" style="margin-right:auto">Confira o documento antes de gerar o PDF.
        ${registro?.report_issued_at ? html`<br>Último PDF gerado em ${fmtDataHora(registro.report_issued_at)}.` : ''}</span>
        <button class="btn secondary" type="button" data-acao="atualizar-doc">Atualizar com os dados</button>
        <button class="btn purple" type="button" data-acao="pdf-relatorio">Gerar PDF do relatório</button></div>
      <div class="doc doc-imprimir" id="doc-relatorio">${relatorioHtml({ state, cliente, autodiag, logo })}</div></div>`;
  }

  // ------------------------------------------------------------ PROPOSTA
  let emitidas = [];
  async function carregarEmitidas() { emitidas = await q(db.from('proposals').select('*').eq('client_id', cliente.id).order('created_at', { ascending: false })); }

  function editorOpcoes() {
    const F = CATALOG.formats;
    return state.proposal.options.map((o, i) => {
      const f = F[o.type], comFrentes = usaFrentes(f), rec = recorrente(f);
      let precos = '';
      if (f?.cobranca === 'unico') precos = html`<div class="field"><label>Valor (R$)</label><input type="number" min="0" data-preco="${i}|valor" value="${o.prices.valor ?? o.prices.kit ?? f.price ?? ''}"></div>`;
      if (f?.cobranca === 'mensal') precos = html`<div class="field"><label>Valor mensal (R$)</label><input type="number" min="0" data-preco="${i}|mensal" value="${o.prices.mensal ?? o.prices.auto ?? f.price ?? ''}"></div>`;
      if (f?.cobranca === 'por_frente') precos = o.fronts.map((k) => html`<div class="field"><label>${f.name} · ${CATALOG.fronts[k].name} (R$)</label><input type="number" min="0" data-preco="${i}|fr_${k}" value="${o.prices['fr_' + k] ?? o.prices['an_' + k] ?? f.price ?? ''}"></div>`);
      if (f?.cobranca === 'soma_frentes') precos = o.fronts.map((k) => html`<div class="field"><label>${CATALOG.fronts[k].name} · mensal (R$)</label><input type="number" min="0" data-preco="${i}|pr_${k}" value="${o.prices['pr_' + k] ?? CATALOG.fronts[k].monthly}">${CATALOG.fronts[k].monthlyNote ? html`<span class="hint">${CATALOG.fronts[k].monthlyNote}</span>` : ''}</div>`);
      return html`<div class="opt-editor"><h4 style="margin:0 0 10px">Opção ${i + 1}</h4>
        <div class="grid g2"><div class="field"><label>Programa</label><select data-op-tipo="${i}"><option value="">— sem opção —</option>${Object.entries(F).map(([k, v]) => html`<option value="${k}" ${o.type === k ? html`selected` : ''}>${v.name}</option>`)}</select></div>
        ${rec ? html`<div class="field"><label>Duração (meses, mínimo ${CATALOG.minMonths})</label><input type="number" min="${CATALOG.minMonths}" data-op-meses="${i}" value="${o.months}"></div>` : html`<div></div>`}</div>
        ${comFrentes ? html`<p class="label" style="margin:10px 0 6px">Frentes</p><div class="chips">${FRONT_KEYS.map((k) => html`<button type="button" class="chip ${o.fronts.includes(k) ? 'on' : ''}" data-op-frente="${i}|${k}" aria-pressed="${o.fronts.includes(k)}">${CATALOG.fronts[k].name}</button>`)}</div>` : ''}
        <div class="grid g2" style="margin-top:10px">${precos}</div>
        <div class="row" style="margin-top:10px">${rec ? html`<label class="check"><input type="checkbox" data-op-sistema="${i}" ${o.system ? html`checked` : ''}> Incluir ${CATALOG.system.name.toLowerCase()} (${brl(CATALOG.system.price)})</label>` : ''}
          <label class="check"><input type="radio" name="op-rec" data-op-rec="${i}" ${o.recommended ? html`checked` : ''}> Opção recomendada</label></div></div>`;
    });
  }

  function proposta() {
    semearOpcoes(state);
    const P = state.proposal;
    const emitidaAtual = P.code && emitidas.find((x) => x.code === P.code);
    return html`<div class="stack">
      <div class="card no-print"><div class="card-head"><div><h2>Montagem da proposta</h2><p>Documento separado do relatório. Ao emitir, a proposta recebe número e fica registrada sem alterações.</p></div></div>
        <div class="grid g3" style="margin-bottom:12px">
          <div class="field"><label>Data de emissão</label><input type="date" data-k="proposal.date" value="${P.date}" ${emitidaAtual ? html`disabled` : ''}></div>
          <div class="field"><label>Validade (dias corridos)</label><input type="number" min="1" data-k="proposal.validity" data-num value="${P.validity}" ${emitidaAtual ? html`disabled` : ''}></div>
          <div class="field"><label>Nº da proposta</label><input type="text" value="${P.code || 'gerado ao emitir'}" disabled></div></div>
        <div class="grid g2">${editorOpcoes()}</div>
        <div class="grid g2" style="margin-top:12px">
          <div class="field"><label>Encontros presenciais incluídos (Osasco / São Paulo)</label><input type="number" min="0" data-k="proposal.onsite" data-num value="${P.onsite}"></div>
          <div class="field"><label>Forma de pagamento</label><input type="text" data-k="proposal.payment" value="${P.payment}"></div></div>
      </div>
      <div class="area-doc">
        <div class="toolbar no-print" style="margin-bottom:12px"><span class="small muted" style="margin-right:auto">${emitidaAtual ? html`Proposta <b>${P.code}</b> emitida em ${fmtData(emitidaAtual.issued_at)}. Alterações exigem nova versão.` : 'Rascunho: confira antes de emitir.'}</span>
          <button class="btn secondary" type="button" data-acao="atualizar-doc">Atualizar com os dados</button>
          ${emitidaAtual ? html`<button class="btn secondary" type="button" data-acao="nova-versao">Nova versão</button><button class="btn purple" type="button" data-acao="pdf-proposta">Gerar PDF novamente</button>`
            : html`<button class="btn purple" type="button" data-acao="emitir-proposta">Emitir proposta e gerar PDF</button>`}</div>
        <div class="doc doc-imprimir" id="doc-proposta">${propostaHtml({ state, cliente, logo })}</div></div>
      <div class="card no-print"><div class="card-head"><div><h2>Propostas emitidas</h2><p>Registro imutável do que foi enviado ao cliente.</p></div></div>
        ${emitidas.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Número</th><th>Emissão</th><th>Validade</th><th>Situação</th><th></th></tr></thead><tbody>
          ${emitidas.map((p) => html`<tr><td><b>${p.code}</b></td><td>${fmtData(p.issued_at)}</td><td>${fmtData(p.valid_until)}</td>
            <td><select data-status-proposta="${p.id}" aria-label="Situação da proposta ${p.code}">${['emitida', 'enviada', 'aceita', 'recusada', 'expirada', 'cancelada'].map((s) => html`<option value="${s}" ${p.status === s ? html`selected` : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`)}</select></td>
            <td><button class="btn sm secondary" type="button" data-reimprimir="${p.id}">PDF</button></td></tr>`)}</tbody></table></div>`
          : html`<p class="muted small">Nenhuma proposta emitida ainda.</p>`}</div>
    </div>`;
  }

  // ------------------------------------------------------------ montagem e eventos
  const ABAS = { preparacao, sessao, matriz, relatorio, proposta };

  async function montarAba(el, aba, flagNode) {
    flagEl = flagNode;
    if (aba === 'proposta') await carregarEmitidas();
    montar(el, ABAS[aba]());
    if (aba === 'sessao') tick(el);
    const ctl = new AbortController(), o = { signal: ctl.signal };
    const redesenhar = () => { const y = scrollY; montar(el, ABAS[aba]()); if (aba === 'sessao') tick(el); scrollTo({ top: y }); };

    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.k && t.type !== 'checkbox') { set(t.dataset.k, t.hasAttribute('data-num') ? (t.value === '' ? '' : +t.value) : t.value); mudou();
        if (t.hasAttribute('data-ctx')) { const cx = $('#caixa-capacidade', el); if (cx) montar(cx, caixaCapacidade()); }
        if (aba === 'preparacao' && /auto\.pillars/.test(t.dataset.k)) { /* candidatas mudam: redesenha ao sair do campo */ } }
      if (t.dataset.ed) { state.report.edits[t.dataset.ed] = t.innerText; mudou(); }
      if (t.dataset.preco) { const [i, k] = t.dataset.preco.split('|'); state.proposal.options[+i].prices[k] = t.value; mudou(); }
      if (t.dataset.opMeses) { state.proposal.options[+t.dataset.opMeses].months = Math.max(CATALOG.minMonths, +t.value || CATALOG.minMonths); mudou(); }
    }, o);
    el.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.dataset.chk) { set(t.dataset.chk, t.checked); mudou(); redesenhar(); return; }
      if (t.dataset.secao) { state.report.secoes = { ...(state.report.secoes || {}), [t.dataset.secao]: t.checked }; mudou(); redesenhar(); return; }
      if (t.dataset.k && (t.tagName === 'SELECT' || /auto\.pillars/.test(t.dataset.k))) redesenhar();
      if (t.dataset.preco || t.dataset.opMeses) redesenhar();
      if (t.dataset.opTipo) {
        const op = state.proposal.options[+t.dataset.opTipo]; op.type = t.value;
        const ev = avaliar(state); if (!op.fronts.length && ev.front && usaFrentes(CATALOG.formats[t.value])) op.fronts = [ev.front];
        mudou(); redesenhar();
      }
      if (t.dataset.opSistema) { state.proposal.options[+t.dataset.opSistema].system = t.checked; mudou(); redesenhar(); }
      if (t.dataset.opRec) { state.proposal.options.forEach((x, i) => { x.recommended = i === +t.dataset.opRec; }); mudou(); redesenhar(); }
      if (t.dataset.statusProposta) {
        try {
          await q(db.from('proposals').update({ status: t.value }).eq('id', t.dataset.statusProposta));
          if (t.value === 'aceita') await q(db.from('clients').update({ stage: 'cliente_ativo' }).eq('id', cliente.id)), (cliente.stage = 'cliente_ativo');
          if (t.value === 'recusada' && await confirmar('Marcar o cliente como “não fechou”?', 'A etapa do cliente no painel passa para “Não fechou”.', { rotulo: 'Marcar' })) {
            await q(db.from('clients').update({ stage: 'nao_fechou' }).eq('id', cliente.id)); cliente.stage = 'nao_fechou';
          }
          avisar('Situação da proposta atualizada.', 'ok');
        } catch (err) { avisarErro(err); }
      }
    }, o);
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.seg) { const atual = get(b.dataset.seg); set(b.dataset.seg, atual === b.dataset.v ? '' : b.dataset.v); mudou(); redesenhar(); return; }
      if (b.dataset.lista) { const a = get(b.dataset.lista) || []; const i = a.indexOf(b.dataset.v); i > -1 ? a.splice(i, 1) : a.push(b.dataset.v); set(b.dataset.lista, a); mudou(); b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); return; }
      if (b.dataset.frente) { const a = state.session.fronts, k = b.dataset.frente, i = a.indexOf(k); i > -1 ? a.splice(i, 1) : a.push(k); mudou(); redesenhar(); return; }
      if (b.dataset.nota) { const [k, c, nn] = b.dataset.nota.split('|'); const s = sc(state, k); s[c] = s[c] === +nn ? null : +nn; mudou(); redesenhar(); return; }
      if (b.dataset.removerAchado) { state.matrix.findings.splice(+b.dataset.removerAchado, 1); mudou(); redesenhar(); return; }
      if (b.dataset.opFrente) { const [i, k] = b.dataset.opFrente.split('|'); const a = state.proposal.options[+i].fronts, j = a.indexOf(k); j > -1 ? a.splice(j, 1) : a.push(k); mudou(); redesenhar(); return; }
      if (b.dataset.reimprimir) { const p = emitidas.find((x) => x.id === b.dataset.reimprimir); return imprimirSnapshot(p); }
      switch (b.dataset.acao) {
        case 'reaplicar':
          if (await confirmar('Recarregar do autodiagnóstico?', 'As notas e observações da preparação serão substituídas pelas do autodiagnóstico importado.', { rotulo: 'Recarregar' })) {
            state.auto.notes = ''; aplicarAutodiagnostico(state, autodiag); mudou(); redesenhar();
          } break;
        case 'cron':
          if (cron.inicio) { cron.acumulado += Date.now() - cron.inicio; cron.inicio = null; clearInterval(cron.int); }
          else { cron.inicio = Date.now(); cron.int = setInterval(() => tick(el), 500); }
          b.textContent = cron.inicio ? 'Pausar' : 'Retomar'; tick(el); break;
        case 'cron-zerar': cron.inicio = null; cron.acumulado = 0; clearInterval(cron.int); redesenhar(); break;
        case 'copiar-dias': { const d = state.session.ctx.dias; ['ter', 'qua', 'qui', 'sex'].forEach((k) => { d[k] = { ...d.seg }; }); mudou(); redesenhar(); avisar('Horário de segunda copiado para terça a sexta.'); break; }
        case 'mais-achado': if (state.matrix.findings.length < 5) { state.matrix.findings.push({ t: '', i: '' }); mudou(); redesenhar(); } break;
        case 'atualizar-doc': redesenhar(); avisar('Documento atualizado.'); break;
        case 'pdf-relatorio': await ocupado(b, gerarRelatorio); break;
        case 'emitir-proposta': await ocupado(b, emitirProposta); redesenhar(); break;
        case 'pdf-proposta': imprimirDocumento($('#doc-proposta', el), 'ELOGA_Proposta_' + state.proposal.code + '_' + nomeArquivo(cliente.name)); registrar('proposta.pdf_gerado', { entidade: 'proposals', id: state.proposal.code, cliente: cliente.id }); break;
        case 'nova-versao':
          if (await confirmar('Criar nova versão?', 'A proposta emitida continua registrada. A nova versão receberá outro número ao ser emitida.', { rotulo: 'Criar nova versão' })) {
            state.proposal.code = ''; mudou(); redesenhar();
          } break;
        default:
      }
    }, o);

    async function gerarRelatorio() {
      await salvar.flush();
      const doc = $('#doc-relatorio', el);
      imprimirDocumento(doc, 'ELOGA_Relatorio_Diagnostico_' + nomeArquivo(cliente.name));
      if (!registro) { sujo = true; await gravar(); }
      registro = await q(db.from('operational_diagnoses').update({ report_issued_at: new Date().toISOString(), status: 'concluido' }).eq('id', registro.id).select().single());
      await subirEtapa(cliente, 'relatorio_emitido');
      registrar('relatorio.pdf_gerado', { entidade: 'operational_diagnoses', id: registro.id, cliente: cliente.id });
    }

    async function emitirProposta() {
      if (!state.proposal.options.some((x) => x.type)) { avisar('Monte ao menos uma opção antes de emitir.', 'bad'); return; }
      if (!(await confirmar('Emitir a proposta?', 'A proposta recebe um número e fica registrada como enviada ao cliente. Depois disso, alterações exigem nova versão.', { rotulo: 'Emitir e gerar PDF' }))) return;
      await salvar.flush();
      if (!registro) { sujo = true; await gravar(); }
      const code = await q(db.rpc('admin_next_proposal_code'));
      state.proposal.code = code;
      const snapshot = structuredClone(state);
      await q(db.from('proposals').insert({ client_id: cliente.id, diagnosis_id: registro?.id ?? null, code, issued_at: state.proposal.date,
        valid_until: somarDias(state.proposal.date, state.proposal.validity), snapshot }));
      sujo = true; await gravar();
      await subirEtapa(cliente, 'proposta_emitida');
      await carregarEmitidas();
      montar(el, ABAS.proposta());
      imprimirDocumento($('#doc-proposta', el), 'ELOGA_Proposta_' + code + '_' + nomeArquivo(cliente.name));
      avisar('Proposta ' + code + ' emitida.', 'ok');
    }

    return () => { ctl.abort(); clearInterval(cron.int); };
  }

  function imprimirSnapshot(p) {
    const caixa = document.createElement('div');
    caixa.className = 'doc';
    montar(caixa, propostaHtml({ state: mesclar(estadoPadrao(), p.snapshot), cliente, logo, editavel: false }));
    imprimirDocumento(caixa, 'ELOGA_Proposta_' + p.code + '_' + nomeArquivo(cliente.name));
    registrar('proposta.pdf_gerado', { entidade: 'proposals', id: p.id, cliente: cliente.id, detalhes: { codigo: p.code, reimpressao: true } });
  }

  return { montarAba, salvar, registro: () => registro, state: () => state };
}

