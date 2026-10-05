// Modelo do DIAGNÓSTICO OPERACIONAL (sessão de 45 min), portado do HTML aprovado
// "ELOGA | Diagnóstico Operacional" v1.0 (03/10/2026). Perguntas, pesos, catálogo
// e regras da matriz são os mesmos. Valores do catálogo são provisórios (base R$ 150/h)
// e podem ser ajustados proposta a proposta.
export const CATALOG = {
  fronts: {
    fat: { name:'Faturamento e ciclo de receita', pillar:'Faturamento e ciclo de receita', monthly:1800,
      monthlyNote:'R$ 1.800 a R$ 2.400/mês conforme volume de guias e operadoras',
      prereq:'Relatórios de autorizações, guias, lotes, demonstrativos e glosas de no mínimo 3 meses.',
      modules:['Autorizações: fluxo de solicitação, validade e saldo de sessões, pendências','Confirmação de atendimento: conferência por sessão (token, assinatura, biometria)','Conciliação: autorizado × confirmado × realizado × faturado','Pré-faturamento: conferência das guias antes do envio','Faturamento: rotina e calendário de envio de lotes por operadora','Pós-faturamento: demonstrativos, glosas por motivo, recurso de glosa e conciliação do recebimento','Liminares: controle de pagamentos judiciais e atrasos'],
      deliverables:['POP do ciclo de receita','Planilha de controle de autorizações e conciliação','Painel de glosas por operadora e motivo','Treinamento da equipe de autorização e faturamento'],
      kpis:['% de sessões sem autorização','% autorizado e não faturado','Taxa de glosa','% de recuperação em recurso','Prazo de faturamento e de recebimento','Receita em risco (R$)'] },
    com: { name:'Atendimento ao cliente', pillar:'Comercial', monthly:1500,
      prereq:'CRM ou registro estruturado de leads (origem, datas, status) de no mínimo 3 meses.',
      modules:['Captação: canais, origem e qualidade dos contatos','Atendimento e agendamento: scripts, tempo de resposta, comunicação com paciente e família','Funil: contato → avaliação → início do tratamento, follow-up e reativação','Equipe: treinamento da recepção e do agendamento'],
      deliverables:['Scripts de atendimento','Funil de atendimento estruturado','POP de atendimento','Treinamento da recepção'],
      kpis:['Tempo de primeira resposta','Conversão por etapa do funil','Comparecimento à avaliação','Início de tratamento','Contatos perdidos e motivos'] },
    age: { name:'Agenda e capacidade', pillar:'Agenda', monthly:1200,
      prereq:'Sistema de agendamento parametrizado (agendado, realizado, falta, cancelamento).',
      modules:['Grade dos profissionais','Ocupação por profissional e sala','Faltas, cancelamentos e política de faltas','Lista de espera','Produtividade'],
      deliverables:['Grade otimizada','Política de faltas e cancelamentos','Painel de ocupação','Rotina de gestão da lista de espera'],
      kpis:['Taxa de ocupação','Absenteísmo','Horas ociosas','Receita ociosa (R$)','Tempo em lista de espera'] },
    fin: { name:'Financeiro', pillar:'Financeiro', monthly:1500,
      prereq:'Receitas por procedimento e custos fixos e variáveis.',
      modules:['Precificação','Custos fixos e variáveis','Margem de contribuição','Fluxo de caixa','DRE gerencial','Ponto de equilíbrio','Repasse de profissionais'],
      deliverables:['Tabela de preços com margem','DRE gerencial','Painel financeiro','Rotina de fechamento mensal'],
      kpis:['Margem de contribuição','Ticket médio','Ponto de equilíbrio','Inadimplência','Procedimentos deficitários'] },
    exp: { name:'Experiência do paciente', pillar:'Experiência do paciente', monthly:900,
      prereq:'Base de pacientes com datas de entrada, saída e frequência.',
      modules:['Mapa da jornada do paciente','Pesquisa de satisfação (NPS)','Tratamento de reclamações','Comunicação com a família','Retenção'],
      deliverables:['Mapa da jornada','Pesquisa de satisfação implantada','Fluxo de tratamento de reclamações','Rotina de retenção'],
      kpis:['NPS','Tempo médio de permanência','Taxa de evasão','Receita perdida por evasão','Reclamações'] },
    reg: { name:'Regulatório', pillar:'Regulatório', monthly:900,
      prereq:'Documentos da clínica e dos profissionais.',
      modules:['Alvarás e vigilância sanitária','CNES','Registros profissionais','Documentação para credenciamento de operadoras','LGPD','Controle de vencimentos'],
      deliverables:['Checklist documental','Painel de vencimentos','Pasta regulatória organizada','Rotina de renovação'],
      kpis:['% de documentos vigentes','Pendências críticas','Vencimentos em 90 dias'] }
  },
  formats: {
    kit:      { name:'Kit de organização operacional', price:900, unit:'único', cobranca:'unico',
                desc:'Estruturação dos registros para gerar indicadores confiáveis em até 3 meses.',
                items:['Kit de planilhas conforme a frente prioritária','Parametrização com os dados da clínica','Guia de preenchimento e checklist de rotina semanal','Painel simples de acompanhamento','1 encontro de implantação (1h30) e 1 checagem do preenchimento em 30 dias','Suporte com resposta em até 2 dias úteis, por e-mail ou WhatsApp'] },
    analise:  { name:'Análise pontual', price:1200, unit:'por frente', cobranca:'por_frente', nota:'abatido do programa se contratado em até 30 dias',
                desc:'Análise dos dados da frente, relatório e apresentação com recomendações.',
                items:['Coleta e análise dos dados de no mínimo 3 meses','Relatório com indicadores e linha de base','Apresentação dos resultados e das recomendações','Valor integralmente abatido do programa se contratado em até 30 dias'] },
    programa: { name:'Programa de acompanhamento', price:null, unit:'mensal', cobranca:'soma_frentes',
                desc:'Análise, implantação das melhorias e acompanhamento com indicadores, do antes ao depois.',
                items:['Linha de base dos indicadores da frente','Plano de ação construído em conjunto','Implantação de fluxos, ferramentas, POPs e ITs','Treinamento da equipe','Reuniões em datas fixas com painel de indicadores (implantado, resultado, pendente)','Resposta em até 2 dias úteis entre as reuniões, por e-mail ou WhatsApp','Encerramento com relatório antes/depois, kit da frente e termo de encerramento'] },
    autonomo: { name:'Programa do profissional autônomo', price:800, unit:'mensal', cobranca:'mensal', frentesFixas:['fat','age','exp','reg'],
                desc:'Acompanhamento de faturamento, agenda, experiência e regulatório para quem atende sozinho.',
                items:['Encontros quinzenais com apresentação a partir das planilhas preenchidas','Plano de ação','Kit de independência completo: planilhas de preenchimento e dashboards','Indicadores de margem de contribuição e ticket médio','Painel simples durante o programa e BI completo liberado no encerramento','Resposta em até 2 dias úteis, por e-mail ou WhatsApp'] }
  },
  system: { name:'Implantação de sistema (CRM ou agendamento)', price:3000,
            items:['Desenho do funil e das etapas','Campos obrigatórios e regras de registro','Configuração funcional do sistema','POPs, ITs e scripts no sistema','Treinamento da equipe','Acompanhamento da adoção por 3 meses'],
            outside:['Integrações via API, WhatsApp API oficial, automações complexas e migração de base são executadas pelo parceiro de tecnologia, com orçamento próprio'] },
  minMonths:3
};
export const FRONT_KEYS = ['fat','fin','com','age','exp','reg'];
export const CATALOGO_PADRAO = JSON.parse(JSON.stringify(CATALOG));
export const FORMATOS_BASE = ['kit', 'analise', 'programa', 'autonomo']; // usados na recomendação automática da matriz

/* ---------------- roteiro ---------------- */
export const QA = [
  'Quais especialidades ou procedimentos a clínica oferece?',
  'Quantos profissionais atendem? Quantas pessoas trabalham no administrativo?',
  'Quantos atendimentos, em média, a clínica realiza por mês?',
  'Qual é a divisão entre convênio, particular e liminar?',
  'Quais sistemas utiliza hoje para agenda, prontuário, CRM e faturamento?'
];
export const QB = {
  fat:['Quanto tempo leva entre o atendimento e o recebimento?','Existe atendimento realizado que não foi faturado? Sabe quanto?','Qual é o percentual de glosa hoje? Vocês fazem recurso?','Quem confere as autorizações e as confirmações de sessão?','Há liminares com pagamento em atraso?'],
  com:['Por onde chegam os interessados? Quantos por mês?','Quanto tempo a equipe leva para responder o primeiro contato?','De cada 10 interessados, quantos viram paciente?','Existe roteiro de atendimento ou cada pessoa responde do seu jeito?','O que acontece com quem não agenda?'],
  age:['Qual é a ocupação da agenda? Há horários vazios recorrentes?','Qual é o índice de faltas? Existe política de faltas?','Há lista de espera? Por que esses pacientes não são encaixados?','Quem monta a grade dos profissionais?'],
  fin:['Sabe quanto sobra de cada atendimento depois dos custos e do repasse?','Como os preços foram definidos?','As contas pessoais são separadas das contas da clínica?','Qual é o faturamento mínimo para cobrir os custos do mês?'],
  exp:['Quanto tempo, em média, um paciente permanece na clínica?','Por que os pacientes saem? Isso é registrado?','Vocês medem a satisfação? Como as reclamações são tratadas?'],
  reg:['Alvará, licença sanitária e CNES estão vigentes?','Os registros dos profissionais estão em dia?','Existe controle de vencimentos?','Há pendências de documentação com operadoras?']
};
export const QC = [
  'O sistema gera relatórios? Consegue extrair os últimos 3 meses?',
  'As informações são registradas por todos ou só por algumas pessoas?',
  'Existe planilha de controle paralela ao sistema?'
];
export const QD = [
  {k:'who', q:'Além de você, quem participa dessa decisão?'},
  {k:'nochange', q:'Se nada mudar em 3 meses, o que acontece com a clínica?'},
  {k:'success', q:'O que precisa ser diferente daqui a 3 meses para valer a pena?'},
  {k:'team', q:'A equipe tem disponibilidade para participar das mudanças?'},
  {k:'budget', q:'Há previsão de investimento em gestão para os próximos 3 meses?'}
];


export const CRIT = [['g', 'Gravidade'], ['i', 'Impacto financeiro'], ['u', 'Urgência'], ['p', 'Prontidão dos dados']];
export const PH = [[5, 'Abertura'], [12, 'A · Contexto'], [30, 'B · Dor e impacto'], [37, 'C · Dados'], [43, 'D · Decisão'], [45, 'Encerramento']];

const hoje = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/** Estado inicial (mesma estrutura do modelo; dados cadastrais vêm da tabela clients). */
export const estadoPadrao = () => ({
  version: 2,
  client: { sessionDate: hoje(), profile: 'terapias', payer: 'misto' },
  auto: { overall: '', level: '', leadClass: '', date: '', notes: '', pillars: { fat: '', fin: '', com: '', age: '', exp: '', reg: '' } },
  session: { ctx: contextoPadrao(), fronts: [], A: ['', '', '', '', ''], B: {}, C: [{ v: '', n: '' }, { v: '', n: '' }, { v: '', n: '' }],
    D: { who: '', nochange: '', success: '', team: '', budget: '', decisorPresent: '' }, devolutiva: '', freeNotes: '' },
  matrix: { scores: {}, ovFront: '', ovFormat: '', findings: [{ t: '', i: '' }, { t: '', i: '' }, { t: '', i: '' }], quickwins: ['', '', ''], goal3m: '', exec: '' },
  report: { edits: {} },
  proposal: { date: hoje(), validity: 15, code: '', onsite: 0, payment: 'Mensal, via PIX ou boleto, com vencimento no dia 10',
    options: [{ type: '', fronts: [], months: 3, system: false, recommended: true, prices: {} }, { type: '', fronts: [], months: 3, system: false, recommended: false, prices: {} }],
    extras: [], infoAdicional: '' },
});

/** Custos adicionais da proposta: descrição, forma de cobrança e valor. */
export const COBRANCA_EXTRA = [['unico', 'Valor único'], ['mensal', 'Por mês'], ['encontro', 'Por encontro'], ['hora', 'Por hora']];

export function mesclar(base, src) {
  for (const k in src) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mesclar(base[k], src[k]);
    else base[k] = src[k];
  }
  return base;
}

export const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
export const hojeIso = hoje;

export function candidatas(state) {
  return FRONT_KEYS.map((k) => ({ k, v: num(state.auto.pillars[k]) })).filter((x) => x.v !== null).sort((a, b) => a.v - b.v).slice(0, 2).map((x) => x.k);
}

export function sc(state, k) { return state.matrix.scores[k] || (state.matrix.scores[k] = { g: null, i: null, u: null, p: null }); }

/** Regra da matriz: prioritária = maior Gravidade + Impacto (desempate pelo total); formato pela prontidão, urgência e decisor. */
export function avaliar(state) {
  const fr = state.session.fronts;
  const rows = fr.map((k) => { const s = sc(state, k); const gi = (s.g ?? 0) + (s.i ?? 0); return { k, s, gi, total: gi + (s.u ?? 0) + (s.p ?? 0) }; });
  let prio = null;
  rows.forEach((r) => { if (!prio || r.gi > prio.gi || (r.gi === prio.gi && r.total > prio.total)) prio = r; });
  let fmt = '', why = '';
  if (state.client.profile === 'autonomo') { fmt = 'autonomo'; why = 'Profissional autônomo: oferta em pacote fechado.'; }
  else if (prio) {
    const p = prio.s.p ?? 0, u = prio.s.u ?? 0, dec = state.session.D.decisorPresent === 'sim';
    if (p <= 1) { fmt = 'kit'; why = 'Prontidão dos dados baixa (0–1): é preciso organizar os registros antes de analisar.'; }
    else if (u >= 2 && dec) { fmt = 'programa'; why = 'Dados disponíveis, urgência alta e decisor presente.'; }
    else { fmt = 'analise'; why = 'Dados disponíveis, mas com indecisão, urgência moderada ou decisor ausente: análise pontual como porta de entrada (valor abatido do programa).'; }
  }
  return { rows, prioAuto: prio?.k || '', fmtAuto: fmt, why, front: state.matrix.ovFront || prio?.k || '', format: state.matrix.ovFormat || fmt };
}

export function faixa(v) {
  if (v === null) return ['—', 'b-off', ''];
  if (v < 40) return ['Crítico', 'p-bad', 'Ponto crítico: processos inexistentes ou informais, com risco direto ao resultado.'];
  if (v < 60) return ['Em estruturação', 'p-warn', 'Existem práticas, mas dependem de pessoas e ainda não geram indicadores confiáveis.'];
  if (v < 80) return ['Estruturado', 'p-ok', 'Processo definido e aplicado; há espaço para padronização e monitoramento.'];
  return ['Orientado por dados', 'p-ok', 'Processo maduro, medido e acompanhado por indicadores.'];
}

export function situacaoDados(state, ev) {
  const pr = ev.front ? sc(state, ev.front).p : null;
  if (pr === null || pr === undefined) {
    const sim = state.session.C.filter((c) => c.v === 'sim').length;
    return sim >= 2 ? ['apto', 'Apto para análise', 'Os dados disponíveis permitem medir a linha de base da frente prioritária.']
      : ['nao', 'Organização necessária antes da análise', 'Os registros atuais ainda não permitem extrair 3 meses de dados confiáveis.'];
  }
  if (pr >= 2) return ['apto', 'Apto para análise', 'Os sistemas e registros atuais permitem extrair ao menos 3 meses de dados para medir a linha de base.'];
  return ['nao', 'Organização necessária antes da análise', 'Os registros atuais não permitem extrair 3 meses de dados confiáveis. O primeiro passo é estruturar os controles para gerar indicadores.'];
}

/** Como cada formato é cobrado: único, por frente, mensal fixo ou soma das mensalidades das frentes. */
export const COBRANCA_FORMATO = { unico: 'Valor único', por_frente: 'Valor único por frente', mensal: 'Mensal fixo', soma_frentes: 'Mensal: soma das frentes' };
export const recorrente = (f) => ['mensal', 'soma_frentes'].includes(f?.cobranca);
export const usaFrentes = (f) => !!f && !f.frentesFixas && ['unico', 'por_frente', 'soma_frentes'].includes(f.cobranca);

export function precoOpcao(o) {
  const f = CATALOG.formats[o.type], fr = CATALOG.fronts;
  if (!f) return { once: 0, monthly: 0, months: 0 };
  const p = (...ks) => { for (const k of ks) if (o.prices[k] != null && o.prices[k] !== '') return +o.prices[k]; return null; };
  const meses = Math.max(CATALOG.minMonths, +o.months || CATALOG.minMonths);
  const sistema = o.system ? (p('sys') ?? CATALOG.system.price) : 0;
  switch (f.cobranca) {
    case 'unico': return { once: p('valor', 'kit') ?? +f.price ?? 0, monthly: 0, months: 0 };
    case 'por_frente': return { once: o.fronts.reduce((s, k) => s + (p('fr_' + k, 'an_' + k) ?? +f.price), 0), monthly: 0, months: 0 };
    case 'mensal': return { once: sistema, monthly: p('mensal', 'auto') ?? +f.price, months: meses };
    case 'soma_frentes': return { once: sistema, monthly: o.fronts.reduce((s, k) => s + (p('pr_' + k) ?? +(fr[k]?.monthly || 0)), 0), months: meses };
    default: return { once: 0, monthly: 0, months: 0 };
  }
}

/** Aplica o catálogo salvo pela administradora (Configurações) sobre o padrão. */
export function aplicarCatalogo(salvo) {
  if (!salvo || typeof salvo !== 'object') return;
  if (salvo.fronts) for (const k of Object.keys(CATALOG.fronts)) if (salvo.fronts[k]) Object.assign(CATALOG.fronts[k], salvo.fronts[k]);
  if (salvo.formats) { for (const k of Object.keys(CATALOG.formats)) if (!salvo.formats[k]) delete CATALOG.formats[k]; Object.assign(CATALOG.formats, salvo.formats); }
  if (salvo.system) Object.assign(CATALOG.system, salvo.system);
  if (salvo.minMonths) CATALOG.minMonths = +salvo.minMonths;
}

/** Sugere as opções da proposta a partir do formato recomendado (só se ainda não montadas). */
export function semearOpcoes(state) {
  const ev = avaliar(state), o = state.proposal.options;
  if (o[0].type || !ev.format) return;
  const f = ev.front ? [ev.front] : [];
  if (ev.format === 'autonomo') { o[0] = { ...o[0], type: 'autonomo', fronts: [], recommended: true }; o[1] = { ...o[1], type: '', recommended: false }; }
  else if (ev.format === 'kit') { o[0] = { ...o[0], type: 'kit', fronts: f, recommended: true }; o[1] = { ...o[1], type: 'programa', fronts: f, recommended: false }; }
  else if (ev.format === 'analise') { o[0] = { ...o[0], type: 'analise', fronts: f, recommended: false }; o[1] = { ...o[1], type: 'programa', fronts: f, recommended: true }; }
  else { o[0] = { ...o[0], type: 'programa', fronts: f, recommended: true }; o[1] = { ...o[1], type: 'analise', fronts: f, recommended: false }; }
}

export function somarDias(d, n) { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + (+n || 0)); return x.toISOString().slice(0, 10); }

// =====================================================================
// CONTEXTO RÁPIDO DA OPERAÇÃO + CAPACIDADE
// =====================================================================
export const DIAS = [['seg', 'Segunda'], ['ter', 'Terça'], ['qua', 'Quarta'], ['qui', 'Quinta'], ['sex', 'Sexta'], ['sab', 'Sábado'], ['dom', 'Domingo']];
export const ESPECIALIDADES = ['ABA', 'Fonoaudiologia', 'Terapia ocupacional', 'Psicologia', 'Psicopedagogia', 'Fisioterapia', 'Nutrição', 'Musicoterapia', 'Neuropsicologia', 'Medicina', 'Estética'];
export const COBRANCAS = ['Sessão avulsa', 'Pacote de sessões', 'Mensalidade', 'Convênio', 'Liminar', 'Reembolso'];
export const SISTEMAS = [['agenda', 'Agenda'], ['prontuario', 'Prontuário'], ['crm', 'CRM / atendimento'], ['faturamento', 'Faturamento']];
export const NIVEL_SISTEMA = [['nenhum', 'Nenhum'], ['planilha', 'Planilha'], ['sistema', 'Sistema']];

const dia = (aberto) => ({ aberto, ini: '08:00', fim: '18:00', intIni: '12:00', intFim: '13:00' });
export const contextoPadrao = () => ({
  dias: { seg: dia(true), ter: dia(true), qua: dia(true), qui: dia(true), sex: dia(true), sab: dia(false), dom: dia(false) },
  duracao: 50, modalidade: 'individual', simultaneos: 1, salas: '', profissionais: '', administrativos: '',
  especialidades: [], especialidadesOutras: '', atendimentosMes: '',
  mix: { convenio: '', particular: '', liminar: '' },
  sistemas: { agenda: '', prontuario: '', crm: '', faturamento: '' },
  cobranca: [], valorSessao: '', pacoteSessoes: '', pacoteValor: '', mensalidade: '', observacoes: '',
});

const minutos = (h) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || '')); return m ? +m[1] * 60 + +m[2] : null; };

/** Minutos em que a clínica atende no dia (desconta o intervalo de fechamento). */
export function minutosDeAtendimento(d) {
  if (!d?.aberto) return 0;
  const a = minutos(d.ini), b = minutos(d.fim);
  if (a === null || b === null || b <= a) return 0;
  let total = b - a;
  const ia = minutos(d.intIni), ib = minutos(d.intFim);
  if (ia !== null && ib !== null && ib > ia) total -= Math.max(0, Math.min(b, ib) - Math.max(a, ia));
  return Math.max(0, total);
}

export const SEMANAS_POR_MES = 52 / 12;

/**
 * Capacidade de atendimentos.
 * Por horário = menor número entre salas e profissionais × pacientes simultâneos por sala
 * (cada profissional ocupa uma sala por vez). Horários por dia = minutos de atendimento ÷ duração.
 */
export function capacidade(ctx) {
  const salas = Math.max(0, Math.floor(+ctx?.salas || 0));
  const prof = Math.max(0, Math.floor(+ctx?.profissionais || 0));
  const simult = Math.max(1, Math.floor(+ctx?.simultaneos || 1));
  const dur = Math.max(0, +ctx?.duracao || 0);
  if (!salas || !prof || !dur) return null;
  const frentes = Math.min(salas, prof);
  const porHorario = frentes * simult;
  const porDia = DIAS.map(([k, nome]) => {
    const min = minutosDeAtendimento(ctx.dias?.[k]);
    const horarios = Math.floor(min / dur);
    return { k, nome, aberto: !!ctx.dias?.[k]?.aberto, minutos: min, horarios, atendimentos: horarios * porHorario };
  });
  const semanal = porDia.reduce((s, d) => s + d.atendimentos, 0);
  const mensal = Math.round(semanal * SEMANAS_POR_MES);
  const gargalo = salas < prof ? 'salas' : prof < salas ? 'profissionais' : 'equilibrado';
  // Quanto cresce eliminando o gargalo (+1 sala ou +1 profissional)
  const novoFrentes = gargalo === 'equilibrado' ? frentes : Math.min(gargalo === 'salas' ? salas + 1 : salas, gargalo === 'profissionais' ? prof + 1 : prof);
  const mensalSemGargalo = Math.round(semanal / frentes * novoFrentes * SEMANAS_POR_MES);
  const realizados = +ctx.atendimentosMes || 0;
  const ticket = +ctx.valorSessao || ((+ctx.pacoteValor && +ctx.pacoteSessoes) ? +ctx.pacoteValor / +ctx.pacoteSessoes : 0);
  return {
    salas, profissionais: prof, simultaneos: simult, duracao: dur, porHorario, porDia, semanal, mensal,
    diasAbertos: porDia.filter((d) => d.aberto && d.horarios > 0).length,
    gargalo, ociosos: Math.abs(salas - prof), ganhoMensal: mensalSemGargalo - mensal,
    ocupacao: realizados && mensal ? Math.round(realizados / mensal * 100) : null,
    ticket: ticket || null, receitaPotencial: ticket ? Math.round(mensal * ticket) : null,
    receitaOciosa: ticket && realizados ? Math.round(Math.max(0, mensal - realizados) * ticket) : null,
  };
}
