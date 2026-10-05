// Estrutura do AUTODIAGNÓSTICO do site (formulario-eloga), copiada da fonte.
// Usada pelo importador e pelos relatórios. Se o formulário mudar, atualize aqui.
// Arquivo gerado a partir de formulario-eloga/index.html (out/2026).

export const SCALE = [{v:'0',t:'Não existe'},{v:'1',t:'Existe de forma informal'},{v:'2',t:'Existe, mas nem sempre é seguido'},{v:'3',t:'Existe e é seguido'},{v:'4',t:'Existe, é seguido e medido com indicadores'},{v:'ns',t:'Não sei'}];
export const NA = {v:'na',t:'Não se aplica'};
export const PILLARS = [
      {id:'fat',name:'Faturamento e ciclo de receita',hint:'Do atendimento realizado ao valor recebido.',items:[
        {id:'fat_c1',v:'conv',t:'Todo atendimento realizado é conferido com a agenda antes do faturamento.'},
        {id:'fat_c2',v:'conv',t:'As autorizações das operadoras são controladas: validade, quantidade de sessões e uso.'},
        {id:'fat_c3',v:'conv',t:'O faturamento é conferido e enviado dentro do prazo de cada operadora.'},
        {id:'fat_c4',v:'conv',t:'As glosas são registradas por motivo, recorridas e acompanhadas até o desfecho.'},
        {id:'fat_c5',v:'conv',t:'Os valores recebidos são conciliados com o que foi faturado.'},
        {id:'fat_p1',v:'part',t:'Todo atendimento realizado é conferido com a agenda antes da cobrança.'},
        {id:'fat_p2',v:'part',t:'Pacotes e sessões pré-pagas têm saldo controlado por paciente.'},
        {id:'fat_p3',v:'part',t:'Os pagamentos (PIX, cartão, parcelas) são conciliados com os atendimentos realizados.'},
        {id:'fat_p4',v:'part',t:'A inadimplência é acompanhada e cobrada com rotina definida.'},
        {id:'fat_p5',v:'part',t:'As taxas de cada meio de pagamento são conhecidas e consideradas no preço.'}]},
      {id:'fin',name:'Financeiro',hint:'Custos, margem e caixa.',items:[
        {id:'fin1',t:'As contas da empresa são separadas das contas pessoais dos sócios.'},
        {id:'fin2',t:'Existe um demonstrativo mensal de receitas e despesas (DRE).'},
        {id:'fin3',t:'O custo e a margem de cada serviço ou procedimento são conhecidos.'},
        {id:'fin4',t:'Existe um fluxo de caixa projetado para as próximas semanas.'},
        {id:'fin5',solo:1,t:'O repasse aos profissionais segue regra formal e é conferido antes do pagamento.'}]},
      {id:'com',name:'Comercial e conversão',hint:'Do primeiro contato ao paciente que agenda.',items:[
        {id:'com1',t:'A origem de cada novo contato (Instagram, indicação, Google etc.) é registrada.'},
        {id:'com2',t:'Existe um prazo definido para responder novos contatos, e ele é cumprido.'},
        {id:'com3',t:'A taxa de conversão de interessados em pacientes é medida.'},
        {id:'com4',t:'Quem não fechou recebe acompanhamento com rotina definida.'},
        {id:'com5',t:'Instagram, Google, WhatsApp e site passam a mesma mensagem sobre a clínica.'}]},
      {id:'age',name:'Agenda e ocupação',hint:'Ocupação, faltas e capacidade.',items:[
        {id:'age1',t:'A taxa de ocupação da agenda é acompanhada por profissional ou sala.'},
        {id:'age2',t:'Faltas e cancelamentos são medidos.'},
        {id:'age3',t:'Os horários são confirmados com o paciente antes do atendimento.'},
        {id:'age4',t:'Horários vagos são repostos com encaixe, lista de espera ou reativação.'},
        {id:'age5',solo:1,t:'A capacidade da agenda é usada para decidir contratações e expansão.'}]},
      {id:'exp',name:'Experiência do paciente e qualidade',hint:'Jornada, padronização e satisfação.',items:[
        {id:'exp1',t:'A jornada do paciente, do primeiro contato ao pós-atendimento, está mapeada.'},
        {id:'exp2',solo:1,t:'Os processos críticos têm POPs atualizados e conhecidos pela equipe.'},
        {id:'exp3',t:'Existe uma pesquisa de satisfação (NPS ou similar) com rotina definida.'},
        {id:'exp4',t:'Reclamações e falhas no atendimento são registradas e tratadas.'},
        {id:'exp5',solo:1,t:'A equipe recebe treinamento e reciclagem, com registro.'}]},
      {id:'reg',name:'Regulatório',na:1,hint:'Documentos e licenças obrigatórios. Use “Não se aplica” quando o item não vale para o seu serviço.',items:[
        {id:'reg1',t:'Alvará de funcionamento e licença sanitária estão válidos, com vencimentos controlados.'},
        {id:'reg2',t:'O cadastro no CNES está atualizado: profissionais, serviços e equipamentos.'},
        {id:'reg3',t:'A responsabilidade técnica está formalizada no conselho de cada área.'},
        {id:'reg4',t:'O AVCB ou CLCB está válido.'},
        {id:'reg5',t:'Prontuários e registros seguem as normas do conselho profissional e a LGPD.'}]}
    ];
export const LEVELS = [
      {name:'Inicial',text:'A operação funciona, mas ainda depende de esforço pessoal e de decisões sem dados. Há espaço relevante para ganhar controle e previsibilidade.'},
      {name:'Em estruturação',text:'A operação já tem práticas importantes, mas elas ainda não são consistentes em todas as áreas. Padronizar e medir é o próximo passo.'},
      {name:'Estruturada',text:'A operação tem processos definidos na maior parte das áreas. O ganho agora está em medir e ajustar com base em indicadores.'},
      {name:'Orientada por dados',text:'A operação é gerida com processos e dados. O foco passa a ser sustentar o crescimento com a mesma qualidade.'}];
export const READ = {
      fat:['Hoje não há controles que garantam que todo atendimento realizado chegue à cobrança. É neste pilar que costumam estar as perdas mais silenciosas da operação.','Existem controles, mas eles dependem de pessoas e não cobrem todas as etapas, do atendimento ao recebimento. O próximo passo é padronizar a conferência entre agenda, cobrança e recebimento.','O ciclo de receita tem etapas definidas e seguidas. O ganho agora está em medir glosas ou inadimplência, prazo de recebimento e atendimentos não cobrados.','O ciclo de receita é controlado e medido de ponta a ponta. O foco passa a ser prevenir falhas e encurtar o prazo entre atendimento e recebimento.'],
      fin:['As decisões financeiras ainda são tomadas sem uma visão clara de custos, margem e caixa. Sem essa base, não é possível saber quais serviços sustentam a operação.','Parte das informações financeiras existe, mas ainda não forma uma visão mensal completa. Organizar DRE, custo por serviço e fluxo de caixa transforma números em decisão.','A operação conhece suas receitas, despesas e margens. O próximo passo é usar esses números para planejar preço, metas e investimentos.','O financeiro orienta as decisões da gestão com números confiáveis. O foco passa a ser previsibilidade e crescimento sustentável.'],
      com:['Os contatos chegam, mas sem registro de origem, prazo de resposta ou acompanhamento de quem não fechou. Assim, a clínica não sabe quantos pacientes deixa de conquistar.','Existem rotinas de atendimento aos interessados, mas sem medição consistente. Medir origem, tempo de resposta e conversão mostra onde o funil perde pacientes.','O processo comercial está definido e é seguido. O ganho agora está em comparar canais e etapas para investir onde a conversão é maior.','O comercial é gerido por indicadores de ponta a ponta. O foco passa a ser previsibilidade de novos pacientes e retenção da base.'],
      age:['Ocupação, faltas e horários vagos ainda não são medidos. Sem esses números, a capacidade ociosa da clínica fica invisível.','Há confirmação e alguma reposição de horários, mas sem acompanhamento sistemático. Medir ocupação e faltas por profissional é o primeiro passo para reduzir a ociosidade.','A agenda é acompanhada e os horários vagos têm destino definido. O próximo passo é usar a capacidade para decidir grades, contratações e expansão.','A agenda é gerida com dados de ocupação e capacidade. O foco passa a ser equilibrar demanda, equipe e lista de espera com antecedência.'],
      exp:['A experiência do paciente depende hoje de quem atende em cada momento. Sem jornada mapeada e sem ouvir o paciente, a clínica não sabe como é percebida.','Existem cuidados com o atendimento, mas nem todos estão padronizados ou registrados. Mapear a jornada e ouvir o paciente com regularidade dá consistência à experiência.','A jornada e os processos estão padronizados e a satisfação é acompanhada. O próximo passo é transformar a opinião do paciente em melhorias com prazo e responsável.','A experiência do paciente é padronizada, medida e melhorada continuamente. O foco passa a ser manter a consistência enquanto a operação cresce.'],
      reg:['A documentação regulatória não tem controle de vencimentos. Uma pendência neste pilar pode interromper o funcionamento da clínica.','Parte dos documentos está em dia, mas sem controle centralizado de prazos. Uma pasta regulatória com vencimentos monitorados reduz o risco de autuações.','Os documentos obrigatórios estão válidos e acompanhados. O próximo passo é tratar cada renovação com antecedência, como parte da rotina da gestão.','A conformidade regulatória é controlada e revisada com antecedência. O foco passa a ser manter a segurança jurídica em expansões e novas unidades.']};

/** Faixa de nível igual à do site: <40 Inicial · <60 Em estruturação · <80 Estruturada · 80+ Orientada por dados */
export function levelOf(score) { return score < 40 ? 0 : score < 60 ? 1 : score < 80 ? 2 : 3; }
export const PILLAR_IDS = PILLARS.map((p) => p.id);
export const pillarById = (id) => PILLARS.find((p) => p.id === id);
export const ANSWER_LABELS = [...SCALE, NA].map((x) => x.t);
