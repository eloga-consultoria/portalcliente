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
  minMonths:3,
  // Bônus: produtos que agregam valor à consultoria. "valor" é o valor de referência (ancoragem da oferta).
  bonus: {
    plano: { name:'Plano de Ação Integrado no Portal', chamada:'Seu plano vivo, acompanhado semana a semana', valor:1500,
      desc:'Cada ação do diagnóstico vira tarefa com responsável, prazo, meta e status, visível para a gestão e para a ELOGA no portal da clínica. Nada se perde entre um encontro e outro: o avanço é medido, os atrasos aparecem cedo e as decisões são tomadas sobre fatos.',
      items:['Ações com responsável, data de entrega e meta mensurável','Ciclo PDCA: planejar, executar, checar e ajustar','Painel de andamento por frente e por responsável','Revisão do plano em cada encontro de acompanhamento'] },
    jornada: { name:'E-book Jornada do Paciente e da Família', chamada:'Cada ponto de contato desenhado para reter', valor:497,
      desc:'Mapa completo do primeiro contato à alta, com o que a família precisa ouvir, receber e sentir em cada etapa. Padroniza a experiência, reduz a evasão nos primeiros 90 dias e transforma famílias satisfeitas em indicação.',
      items:['Mapa das etapas e dos momentos críticos','Checklist por etapa para a equipe','Mensagens-modelo para os marcos do tratamento'] },
    scripts: { name:'Scripts de Atendimento e Conversão', chamada:'Do primeiro contato à avaliação agendada', valor:697,
      desc:'Roteiros para WhatsApp e telefone: primeira resposta, qualificação, apresentação do plano terapêutico, objeções de preço e reativação de quem não agendou. A conversão deixa de depender de quem atende e passa a seguir um método.',
      items:['Script de primeiro contato e qualificação','Respostas às principais objeções','Roteiro de apresentação do plano de tratamento','Sequência de follow-up e reativação'] },
    cartao: { name:'Cartão de Agendamento Personalizado', chamada:'Compromisso visível, menos faltas', valor:297,
      desc:'Cartão com a identidade da clínica, os horários fixos do paciente e as regras de falta, reposição e cancelamento. Simples e decisivo: a família leva para casa o combinado e a agenda ganha previsibilidade.',
      items:['Arte com a identidade visual da clínica','Versões impressa e digital (WhatsApp)','Política de faltas e reposições em linguagem acolhedora'] },
    planilhas: { name:'Planilhas Automatizadas de Indicadores', chamada:'A equipe registra, os indicadores aparecem sozinhos', valor:997,
      desc:'Planilhas prontas, com campos guiados, que calculam automaticamente ocupação, faltas, conversão, faturamento, glosa e margem. A gestão recebe os números sem fórmulas, sem retrabalho e sem depender de sistemas caros.',
      items:['Campos guiados e validados','Indicadores calculados automaticamente','Guia de preenchimento para a equipe'] },
    dashboard: { name:'Dashboard Personalizado da Clínica', chamada:'A operação inteira em uma tela', valor:1997,
      desc:'Painel com os dados reais da clínica, alimentado pelos relatórios que os sistemas atuais já emitem ou pelas planilhas do Kit Organizacional, sem trocar de sistema. Receita, agenda, conversão e qualidade lado a lado para decidir com rapidez e segurança.',
      items:['Leitura dos relatórios exportados pelos sistemas já utilizados','Integração com as planilhas do Kit Organizacional','Indicadores por unidade, profissional e convênio','Atualização simples, sem conhecimento técnico'] },
    marca: { name:'Ficha de Posicionamento da Marca', chamada:'Redes sociais que atraem o paciente certo', valor:597,
      desc:'Diagnóstico do posicionamento da clínica que define público, tom de voz, diferenciais e os formatos de conteúdo com maior potencial: educativo, prova social, bastidores e autoridade. O conteúdo deixa de ser improviso e passa a gerar contatos qualificados.',
      items:['Ficha diagnóstica de posicionamento','Direcionamento de formatos e temas de postagem','Linha editorial inicial para 30 dias'] },
    termos: { name:'Modelos de Termos por Forma de Adesão', chamada:'Segurança jurídica em cada contrato', valor:797,
      desc:'Termos de adesão e consentimento para cada forma de entrada do paciente: particular, convênio, liminar judicial e reembolso. Regras de pagamento, faltas, reposições, cancelamento e LGPD claras desde o primeiro dia, reduzindo conflitos e inadimplência.',
      items:['Termo para atendimento particular e pacotes','Termos para convênio e para liminar judicial','Termo para reembolso','Cláusulas de faltas, cancelamento e LGPD (validação pelo jurídico da clínica recomendada)'] },
  },
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
    D: { who: '', nochange: '', success: '', team: '', budget: '', decisorPresent: '' }, devolutiva: '', freeNotes: '', extras: [] },
  matrix: { scores: {}, ovFront: '', ovFronts: [], ovFormat: '', findings: [{ t: '', i: '', on: true }, { t: '', i: '', on: true }, { t: '', i: '', on: true }],
    quickwins: [{ t: '', on: true }, { t: '', on: true }, { t: '', on: true }], goal3m: '', exec: '' },
  report: { edits: {} },
  proposal: { date: hoje(), validity: 15, code: '', onsite: 0, payment: 'Mensal, via PIX ou boleto, com vencimento no dia 10',
    options: [{ type: '', fronts: [], months: 3, system: false, recommended: true, prices: {} }, { type: '', fronts: [], months: 3, system: false, recommended: false, prices: {} }],
    extras: [], infoAdicional: '', secoes: {}, secoesExtras: [],
    bonus: {}, bonusExtras: [], bonusEm: 'recomendada', oferta: ofertaPadrao() },
});

/** Oferta especial: empilhamento de valor, bônus de decisão rápida, garantia, vagas e condição de pagamento. */
export const ofertaPadrao = () => ({ on: false, titulo: 'Condição especial de implantação', prazo: '',
  intro: 'Não se trata de juntar serviços e dar desconto: é um pacote completo para aumentar a conversão, o ticket médio e o faturamento da clínica, com as ferramentas que a equipe usa no dia a dia.',
  garantia: { on: true, texto: 'Garantia de entrega: se a linha de base dos indicadores não for apresentada em até 30 dias após o envio completo dos dados, a ELOGA segue com o acompanhamento sem custo até a entrega.' },
  vagas: { on: false, texto: 'Para preservar a qualidade do acompanhamento, a ELOGA inicia no máximo 3 novas clínicas por mês.' },
  pagamento: { on: true, texto: 'A primeira mensalidade vence somente após o encontro de início.' } });

/** Bônus marcados na proposta (catálogo + bônus avulsos), com o valor de referência usado. */
export function bonusDaProposta(state) {
  const P = state.proposal;
  if (Array.isArray(P.bonusSnapshot)) return P.bonusSnapshot; // proposta emitida: textos congelados
  const doCatalogo = Object.entries(P.bonus || {}).filter(([k, b]) => b?.on && CATALOG.bonus?.[k]).map(([k, b]) => {
    const c = CATALOG.bonus[k];
    return { id: k, name: c.name, chamada: c.chamada || '', desc: c.desc || '', items: [...(c.items || [])], valor: b.valor != null && b.valor !== '' ? +b.valor : +c.valor || 0, rapido: !!b.rapido };
  });
  const avulsos = (P.bonusExtras || []).filter((b) => String(b.name || '').trim()).map((b, i) => ({ id: 'x' + i, name: b.name.trim(), chamada: b.chamada || '', desc: b.desc || '', items: [], valor: +b.valor || 0, rapido: !!b.rapido }));
  return [...doCatalogo, ...avulsos];
}

/** Valor total de uma opção no período (pagamento único + mensalidades × meses). */
export function valorOpcao(o) { const p = precoOpcao(o); return p.once + p.monthly * p.months; }

/** Ajusta estados salvos em versões anteriores (recomendações em texto, frente única). */
export function normalizarEstado(state) {
  const m = state.matrix;
  m.quickwins = (m.quickwins || []).map((x) => (typeof x === 'string' ? { t: x, on: true } : { t: x?.t || '', on: x?.on !== false }));
  m.findings = (m.findings || []).map((f) => ({ t: f?.t || '', i: f?.i || '', on: f?.on !== false }));
  if (!Array.isArray(m.ovFronts)) m.ovFronts = [];
  if (!m.ovFronts.length && m.ovFront) m.ovFronts = [m.ovFront];
  state.session.extras = (Array.isArray(state.session.extras) ? state.session.extras : []).map((c) => ({ titulo: c?.titulo || '', valor: c?.valor || '', pilar: c?.pilar || '', on: c?.on !== false }));
  state.report.ocultos = state.report.ocultos && typeof state.report.ocultos === 'object' ? state.report.ocultos : {};
  state.session.ctx.esp = state.session.ctx.esp && typeof state.session.ctx.esp === 'object' ? state.session.ctx.esp : {};
  state.proposal.secoesExtras = Array.isArray(state.proposal.secoesExtras) ? state.proposal.secoesExtras : [];
  state.proposal.bonus = state.proposal.bonus && typeof state.proposal.bonus === 'object' && !Array.isArray(state.proposal.bonus) ? state.proposal.bonus : {};
  state.proposal.bonusExtras = Array.isArray(state.proposal.bonusExtras) ? state.proposal.bonusExtras : [];
  state.proposal.oferta = mesclar(ofertaPadrao(), state.proposal.oferta && typeof state.proposal.oferta === 'object' ? state.proposal.oferta : {});
  return state;
}
/** Texto e inclusão de uma recomendação (aceita o formato antigo, só texto). */
export const recTexto = (x) => (typeof x === 'string' ? x : x?.t || '');
export const recAtiva = (x) => typeof x === 'string' || x?.on !== false;

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
  const manuais = (Array.isArray(state.matrix.ovFronts) && state.matrix.ovFronts.length ? state.matrix.ovFronts : (state.matrix.ovFront ? [state.matrix.ovFront] : []))
    .filter((k) => FRONT_KEYS.includes(k));
  const fronts = manuais.length ? manuais : (prio ? [prio.k] : []);
  return { rows, prioAuto: prio?.k || '', fmtAuto: fmt, why, fronts, manual: manuais.length > 0, front: fronts[0] || '', format: state.matrix.ovFormat || fmt };
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
  if (salvo.bonus && typeof salvo.bonus === 'object') CATALOG.bonus = salvo.bonus;
  if (salvo.minMonths) CATALOG.minMonths = +salvo.minMonths;
}

/** Sugere as opções da proposta a partir do formato recomendado (só se ainda não montadas). */
export function semearOpcoes(state) {
  const ev = avaliar(state), o = state.proposal.options;
  if (o[0].type || !ev.format) return;
  const f = [...ev.fronts];
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

/** Ocupação de referência: deixa folga para reposições, faltas e encaixes da lista de espera. */
export const OCUPACAO_IDEAL = 85;

const dia = (aberto) => ({ aberto, ini: '08:00', fim: '18:00', intIni: '12:00', intFim: '13:00' });
export const contextoPadrao = () => ({
  dias: { seg: dia(true), ter: dia(true), qua: dia(true), qui: dia(true), sex: dia(true), sab: dia(false), dom: dia(false) },
  duracao: 50, modalidade: 'individual', simultaneos: 1, salas: '', profissionais: '', administrativos: '',
  especialidades: [], especialidadesOutras: '', atendimentosMes: '', esp: {},
  mix: { convenio: '', particular: '', liminar: '' },
  sistemas: { agenda: '', prontuario: '', crm: '', faturamento: '' },
  cobranca: [], valorSessao: '', pacoteSessoes: '', pacoteValor: '', mensalidade: '', observacoes: '',
  ocupacaoIdeal: OCUPACAO_IDEAL,
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

/** Especialidades informadas (lista + "outras", separadas por vírgula). */
export function especialidadesDe(ctx) {
  const outras = String(ctx?.especialidadesOutras || '').split(/[,;]/).map((x) => x.replace(/\./g, '').trim()).filter(Boolean);
  return [...new Set([...(ctx?.especialidades || []), ...outras])];
}
const inteiro = (v, min = 0) => Math.max(min, Math.floor(+v || 0));

/**
 * Capacidade de atendimentos.
 * Modo por especialidade (quando há profissionais informados por especialidade):
 *   por horário = Σ (profissionais × atendimentos simultâneos) da especialidade,
 *   limitado pelas salas (as salas são compartilhadas: se houver menos salas que
 *   profissionais, todas as especialidades são reduzidas na mesma proporção).
 * Modo geral: menor número entre salas e profissionais × pacientes simultâneos por sala.
 * Horários por dia = minutos de atendimento (sem os intervalos) ÷ duração.
 */
export function capacidade(ctx) {
  const salas = inteiro(ctx?.salas);
  const dur = Math.max(0, +ctx?.duracao || 0);
  const linhasEsp = especialidadesDe(ctx).map((nome) => ({ nome, prof: inteiro(ctx?.esp?.[nome]?.prof), simult: inteiro(ctx?.esp?.[nome]?.simult ?? 1, 1) }))
    .filter((r) => r.prof > 0);
  const porEsp = linhasEsp.length > 0;
  const prof = porEsp ? linhasEsp.reduce((s, r) => s + r.prof, 0) : inteiro(ctx?.profissionais);
  const simult = porEsp ? null : inteiro(ctx?.simultaneos ?? 1, 1);
  if (!dur || !prof || (!porEsp && !salas)) return null;
  const demanda = porEsp ? linhasEsp.reduce((s, r) => s + r.prof * r.simult, 0) : null;
  const porHorarioDe = (sl, pf) => (porEsp
    ? Math.floor(demanda * (pf / prof) * (sl ? Math.min(1, sl / pf) : 1))
    : Math.min(sl, pf) * simult);
  const porHorario = porHorarioDe(salas, prof);
  const minutosDia = DIAS.map(([k, nome]) => ({ k, nome, aberto: !!ctx.dias?.[k]?.aberto, minutos: minutosDeAtendimento(ctx.dias?.[k]) }));
  const horariosSemana = minutosDia.reduce((s, d) => s + Math.floor(d.minutos / dur), 0);
  const porDia = minutosDia.map((d) => { const horarios = Math.floor(d.minutos / dur); return { ...d, horarios, atendimentos: horarios * porHorario }; });
  const semanal = porDia.reduce((s, d) => s + d.atendimentos, 0);
  const mensal = Math.round(semanal * SEMANAS_POR_MES);
  const gargalo = !salas ? 'sem_salas' : salas < prof ? 'salas' : prof < salas ? 'profissionais' : 'equilibrado';
  const comMais = gargalo === 'salas' ? porHorarioDe(salas + 1, prof) : gargalo === 'profissionais' ? porHorarioDe(salas, prof + 1) : porHorario;
  const ganhoMensal = Math.round((comMais - porHorario) * horariosSemana * SEMANAS_POR_MES);
  const fator = porEsp && salas ? Math.min(1, salas / prof) : 1;
  // Divide o total por horário entre as especialidades (maiores restos), para a soma bater com o total
  const brutos = linhasEsp.map((r) => r.prof * r.simult * fator);
  const porEspHorario = brutos.map(Math.floor);
  let sobra = porHorario - porEspHorario.reduce((a, b) => a + b, 0);
  brutos.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (sobra > 0) { porEspHorario[i]++; sobra--; } });
  const especialidades = linhasEsp.map((r, i) => ({ ...r, porHorario: porEspHorario[i], mensal: Math.round(porEspHorario[i] * horariosSemana * SEMANAS_POR_MES) }));
  const realizados = +ctx.atendimentosMes || 0;
  const ticket = +ctx.valorSessao || ((+ctx.pacoteValor && +ctx.pacoteSessoes) ? +ctx.pacoteValor / +ctx.pacoteSessoes : 0);
  // Ocupação ideal: meta de atendimentos e distância do realizado (positivo = abaixo do ideal)
  const ideal = Math.min(100, Math.max(1, Math.round(+ctx.ocupacaoIdeal || OCUPACAO_IDEAL)));
  const metaMensal = Math.round(mensal * ideal / 100);
  const lacuna = realizados ? metaMensal - realizados : null;
  return {
    modo: porEsp ? 'especialidade' : 'geral', especialidades,
    salas, profissionais: prof, simultaneos: simult, duracao: dur, porHorario, porDia, semanal, mensal,
    diasAbertos: porDia.filter((d) => d.aberto && d.horarios > 0).length,
    gargalo, ociosos: Math.abs(salas - prof), ganhoMensal,
    ocupacao: realizados && mensal ? Math.round(realizados / mensal * 100) : null,
    ticket: ticket || null, receitaPotencial: ticket ? Math.round(mensal * ticket) : null,
    receitaOciosa: ticket && realizados ? Math.round(Math.max(0, mensal - realizados) * ticket) : null,
    ocupacaoIdeal: ideal, metaMensal, lacuna,
    receitaLacuna: ticket && lacuna > 0 ? Math.round(lacuna * ticket) : null,
  };
}
