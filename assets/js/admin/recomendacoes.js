// Biblioteca de recomendações imediatas (sem custo e sem envio de dados a serviços externos).
// Cada recomendação segue a lógica consultiva de venda:
//   ação que a gestão inicia já → o que ela revela ou o risco de não fazer → como a ELOGA resolve.
// O texto é montado a partir das notas dos pilares, da matriz, da capacidade e do formato recomendado.
import { CATALOG, FRONT_KEYS, num, avaliar, sc, capacidade } from './operacional-modelo.js';

const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

// {SVC} / {svc}: "A atuação da ELOGA em <frente> (<formato>)" — sempre como sujeito da frase.
// {ociosa}: frase com a capacidade não utilizada, quando calculada.
const BIBLIOTECA = {
  fat: {
    baixo: [
      'Levantar as sessões realizadas nos últimos 30 dias sem autorização vigente ou sem confirmação na guia: esse número é a primeira medida da receita em risco. {SVC} implanta a conciliação autorizado × realizado × faturado, que interrompe essa perda.',
      'Classificar as glosas dos últimos 3 meses por operadora e motivo. Glosa sem recurso estruturado se torna perda definitiva; {svc} estabelece o pré-faturamento e o fluxo de recurso com indicador de recuperação.',
    ],
    medio: [
      'Fixar um calendário de envio de lotes por operadora e acompanhar o prazo entre atendimento e recebimento. Reduzir esse ciclo é ganho de caixa imediato; {svc} define as metas e o painel de acompanhamento.',
    ],
  },
  fin: {
    baixo: [
      'Separar integralmente as movimentações pessoais das da clínica e registrar todas as saídas por categoria a partir desta semana. Sem essa base não há margem de contribuição nem ponto de equilíbrio confiáveis; {svc} usa esses números para identificar os procedimentos deficitários.',
      'Calcular, para o procedimento de maior volume, quanto sobra após repasse, impostos e custos diretos. Sem margem conhecida, crescer pode ampliar o prejuízo; {svc} entrega a precificação com margem e a DRE gerencial.',
    ],
    medio: [
      'Fechar o mês em data fixa com DRE gerencial simplificada. A leitura mensal de margem e ticket médio é o que sustenta decisões de expansão; {svc} implanta e acompanha essa rotina.',
    ],
  },
  com: {
    baixo: [
      'Registrar, para cada contato recebido, origem, data e desfecho (agendou ou não, e o motivo). Sem esse registro a conversão fica invisível e os contatos perdidos não são recuperados; {svc} estrutura o funil com metas por etapa.',
      'Padronizar a primeira resposta com um roteiro único e meta de retorno em até 1 hora útil. Tempo de resposta é o principal fator de conversão em saúde; {svc} entrega scripts, treinamento e indicadores da recepção.',
    ],
    medio: [
      'Programar follow-up para quem não agendou em 48 horas e em 7 dias. Reativar contatos já captados tem custo marginal mínimo; {svc} mede o retorno desse fluxo.',
    ],
  },
  age: {
    baixo: [
      'Medir por 2 semanas, por profissional, os horários vagos e a taxa de faltas.{ociosa} {SVC} converte essa ociosidade em atendimentos faturáveis, com grade otimizada e painel de ocupação.',
      'Formalizar por escrito às famílias uma política de faltas e reposições. Falta sem regra compromete a continuidade terapêutica e a receita; {svc} entrega a política e o acompanhamento do absenteísmo.',
    ],
    medio: [
      'Cruzar semanalmente a lista de espera com os horários liberados por faltas e cancelamentos. O encaixe ativo eleva a ocupação sem ampliar a estrutura; {svc} implanta essa rotina com indicador de tempo de espera.',
    ],
  },
  exp: {
    baixo: [
      'Registrar o motivo de cada saída de paciente nos últimos 6 meses. Evasão não medida é receita recorrente perdida sem causa conhecida; {svc} transforma esse dado em plano de retenção.',
      'Aplicar neste mês uma pesquisa curta de satisfação (NPS) às famílias ativas. A percepção da família antecipa a evasão; {svc} implanta a medição contínua e o tratamento das reclamações.',
    ],
    medio: [
      'Definir um ponto de contato estruturado com a família a cada ciclo de evolução terapêutica. Comunicação previsível sustenta a permanência; {svc} desenha e acompanha essa jornada.',
    ],
  },
  reg: {
    baixo: [
      'Listar alvará, licença sanitária, CNES e registros profissionais com as datas de vencimento. Documento vencido pode suspender credenciamentos e pagamentos de operadoras; {svc} entrega o painel de vencimentos e a rotina de renovação.',
      'Verificar as pendências documentais junto a cada operadora credenciada. Pendência regulatória é risco jurídico e financeiro silencioso; {svc} trata a conformidade de forma estruturada.',
    ],
    medio: [
      'Centralizar a documentação regulatória em pasta única, com responsável definido. A rotina preventiva evita interrupções no faturamento; {svc} implanta o controle de vencimentos.',
    ],
  },
};

/** Pilar frágil: nota do autodiagnóstico abaixo de 60 ou gravidade/impacto altos na sessão. */
function nivel(state, k) {
  const nota = num(state.auto.pillars[k]);
  const s = state.matrix.scores[k];
  const gi = s ? (s.g ?? 0) + (s.i ?? 0) : 0;
  return (nota !== null && nota < 60) || gi >= 4 ? 'baixo' : 'medio';
}

/**
 * Gera até 5 recomendações imediatas, priorizando as frentes da matriz e,
 * depois, o pilar mais frágil do autodiagnóstico. A última reforça a decisão.
 */
export function gerarRecomendacoes(state) {
  const ev = avaliar(state);
  const formato = CATALOG.formats[ev.format]?.name;
  const cap = capacidade(state.session.ctx);
  const ociosa = cap?.receitaOciosa ? ` A capacidade não utilizada estimada é de ${brl(cap.receitaOciosa)} por mês.` : '';
  const svc = (k) => `a atuação da ELOGA em ${CATALOG.fronts[k].name}${formato ? ` (${formato})` : ''}`;
  const montar = (t, k) => t.replace('{SVC}', svc(k).replace(/^a/, 'A')).replace('{svc}', svc(k)).replace('{ociosa}', ociosa);

  const frentes = [...ev.fronts];
  const restantes = FRONT_KEYS.filter((k) => !frentes.includes(k) && num(state.auto.pillars[k]) !== null)
    .sort((a, b) => num(state.auto.pillars[a]) - num(state.auto.pillars[b]));
  if (!frentes.length) frentes.push(...restantes.splice(0, 2));
  else if (restantes[0] && num(state.auto.pillars[restantes[0]]) < 60) frentes.push(restantes[0]);

  let recs = [];
  frentes.forEach((k, i) => {
    const b = BIBLIOTECA[k]; if (!b) return;
    const lista = nivel(state, k) === 'baixo' ? [...b.baixo, ...b.medio] : [...b.medio, ...b.baixo];
    lista.slice(0, i < ev.fronts.length ? 2 : 1).forEach((t) => recs.push(montar(t, k)));
  });
  const pr = ev.front ? sc(state, ev.front).p : null;
  if (ev.fronts.length) {
    recs = recs.slice(0, 4); // a última posição fica para a recomendação de decisão
    const nomes = ev.fronts.map((k) => CATALOG.fronts[k].name.toLowerCase());
    const alvo = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes.at(-1) : nomes[0];
    recs.push(pr !== null && pr <= 1
      ? `Definir na devolutiva o início da organização dos registros de ${alvo}: sem dados confiáveis, cada decisão segue baseada em percepção, e o próximo trimestre não poderá ser comparado com o atual.`
      : `Definir na devolutiva o início da atuação em ${alvo}: cada mês sem linha de base é um mês de resultado que não poderá ser medido nem recuperado.`);
  }
  return recs.slice(0, 5);
}
