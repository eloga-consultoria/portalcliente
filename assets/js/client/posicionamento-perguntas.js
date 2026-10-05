// Perguntas do DIAGNÓSTICO DE POSICIONAMENTO (liberado individualmente pela ELOGA).
// Fonte: portal anterior (schema ELOGA_POSICIONAMENTO_V5). Mantido o mesmo id de cada pergunta
// para que respostas antigas continuem legíveis.
export const SCHEMA_POSICIONAMENTO = 'ELOGA_POSICIONAMENTO_V5';

export const SECOES = {
  '1. QUEM VOCÊ É': 'Identidade, valores e percepção da marca',
  '2. COMO VOCÊ PENSA': 'Visão, princípios e linguagem',
  '3. O QUE VOCÊ RESOLVE': 'Problema, necessidade e transformação',
  '4. COMO VOCÊ RESOLVE': 'Método, diferenciais e experiência',
  '5. POR QUE CONFIAR EM VOCÊ': 'Autoridade, reputação e prova',
  '6. REDES SOCIAIS': 'Objetivos e rotina de comunicação',
};

export const PERGUNTAS = [
 {
  "id": "p1_story",
  "section": "1. QUEM VOCÊ É",
  "theme": "História",
  "type": "text",
  "q": "Em poucas linhas, como a clínica surgiu e o que motivou sua criação?",
  "help": "Use 2 a 4 frases e foque no motivo da existência da clínica, não em toda a cronologia.",
  "aesthetic": "Ex.: nasceu para oferecer estética com naturalidade, segurança e atendimento individualizado.",
  "therapy": "Ex.: surgiu para oferecer cuidado multiprofissional integrado, acolhedor e centrado na evolução do paciente."
 },
 {
  "id": "p1_values",
  "section": "1. QUEM VOCÊ É",
  "theme": "Valores",
  "type": "multi",
  "q": "Quais valores mais representam a clínica?",
  "options": [
   "Acolhimento",
   "Ética",
   "Segurança",
   "Excelência técnica",
   "Humanização",
   "Transparência",
   "Individualização",
   "Inovação",
   "Naturalidade",
   "Família e vínculo"
  ],
  "help": "Escolha apenas os valores que realmente aparecem na experiência do paciente. Você poderá adicionar outros.",
  "aesthetic": "Ex.: segurança, naturalidade, transparência e excelência técnica.",
  "therapy": "Ex.: acolhimento, humanização, individualização e vínculo com a família."
 },
 {
  "id": "p1_personality",
  "section": "1. QUEM VOCÊ É",
  "theme": "Personalidade",
  "type": "multi",
  "q": "Como você gostaria que a clínica fosse percebida?",
  "options": [
   "Acolhedora",
   "Sofisticada",
   "Técnica",
   "Próxima",
   "Moderna",
   "Confiável",
   "Leve",
   "Exclusiva",
   "Didática",
   "Referência"
  ],
  "help": "Pense na sensação que o paciente deve ter ao ver seu perfil, falar com a recepção e chegar à clínica.",
  "aesthetic": "Ex.: sofisticada, confiável, moderna e natural.",
  "therapy": "Ex.: acolhedora, didática, próxima e referência técnica."
 },
 {
  "id": "p1_score",
  "section": "1. QUEM VOCÊ É",
  "theme": "Maturidade",
  "type": "score",
  "q": "Hoje, a identidade e os valores da marca estão claros para a equipe e para o público?",
  "help": "Avalie a clareza atual, não o que você gostaria que fosse.",
  "aesthetic": "0 = comunicação sem padrão; 4 = identidade consistente em todos os pontos de contato.",
  "therapy": "0 = equipe comunica de formas muito diferentes; 4 = linguagem, valores e experiência são consistentes."
 },
 {
  "id": "p2_belief",
  "section": "2. COMO VOCÊ PENSA",
  "theme": "Crença central",
  "type": "text",
  "q": "Qual princípio ou crença orienta a forma como vocês atendem e tomam decisões?",
  "help": "Escreva uma ideia central que a clínica defende e que pode virar conteúdo recorrente.",
  "aesthetic": "Ex.: procedimentos devem preservar características individuais e nunca seguir um padrão único.",
  "therapy": "Ex.: a evolução terapêutica depende de plano individualizado, participação familiar e acompanhamento contínuo."
 },
 {
  "id": "p2_content",
  "section": "2. COMO VOCÊ PENSA",
  "theme": "Conteúdo",
  "type": "multi",
  "q": "Quais estilos de conteúdo combinam com a visão da clínica?",
  "options": [
   "Educativo",
   "Mitos e verdades",
   "Opinião técnica",
   "Bastidores",
   "Perguntas frequentes",
   "Orientações práticas",
   "Comparações",
   "Tendências com análise técnica"
  ],
  "help": "Escolha formatos que mostrem como a clínica pensa, não apenas o que vende.",
  "aesthetic": "Ex.: opinião técnica sobre exageros, tendências, naturalidade e critérios de segurança.",
  "therapy": "Ex.: orientações sobre rotina, desenvolvimento, participação familiar e critérios terapêuticos."
 },
 {
  "id": "p2_tone",
  "section": "2. COMO VOCÊ PENSA",
  "theme": "Tom de voz",
  "type": "multi",
  "q": "Como a comunicação deve soar?",
  "options": [
   "Acolhedora",
   "Técnica",
   "Simples",
   "Sofisticada",
   "Direta",
   "Leve",
   "Didática",
   "Segura",
   "Próxima"
  ],
  "help": "Pense em como a marca deve falar nas legendas, vídeos e respostas ao paciente.",
  "aesthetic": "Ex.: sofisticada + simples + segura.",
  "therapy": "Ex.: acolhedora + didática + técnica."
 },
 {
  "id": "p2_score",
  "section": "2. COMO VOCÊ PENSA",
  "theme": "Maturidade",
  "type": "score",
  "q": "A clínica possui um ponto de vista reconhecível e consistente nas redes sociais?",
  "help": "Avalie se o público consegue entender o que vocês defendem e como pensam.",
  "aesthetic": "0 = só publica procedimentos; 4 = existe visão clara sobre estética, segurança e resultados.",
  "therapy": "0 = só publica agenda/serviços; 4 = há posicionamento claro sobre cuidado, desenvolvimento e prática clínica."
 },
 {
  "id": "p3_needs",
  "section": "3. O QUE VOCÊ RESOLVE",
  "theme": "Necessidades",
  "type": "multi",
  "q": "Quais necessidades levam o paciente a procurar a clínica?",
  "options": [
   "Melhorar autoestima",
   "Resolver incômodo estético",
   "Prevenir/cuidar da saúde",
   "Obter diagnóstico ou avaliação",
   "Desenvolver habilidades",
   "Ganhar autonomia",
   "Reduzir dificuldades funcionais",
   "Receber orientação profissional",
   "Melhorar qualidade de vida",
   "Apoiar família/cuidadores"
  ],
  "help": "Marque a necessidade do paciente, e não apenas o nome do serviço.",
  "aesthetic": "Ex.: melhorar autoestima, tratar um incômodo facial e buscar resultado natural.",
  "therapy": "Ex.: desenvolver comunicação, autonomia, habilidades funcionais e orientar a família."
 },
 {
  "id": "p3_pains",
  "section": "3. O QUE VOCÊ RESOLVE",
  "theme": "Dores e objeções",
  "type": "multi",
  "q": "Quais dores ou preocupações aparecem antes do paciente fechar?",
  "options": [
   "Medo do resultado",
   "Medo de dor/desconforto",
   "Preço",
   "Falta de tempo",
   "Dúvida se funciona",
   "Experiência ruim anterior",
   "Falta de confiança",
   "Dificuldade de agenda",
   "Incerteza sobre o profissional",
   "Dúvida sobre tempo de tratamento"
  ],
  "help": "Essas respostas serão usadas para criar conteúdo de quebra de objeção.",
  "aesthetic": "Ex.: medo de ficar artificial, insegurança com o profissional e preço.",
  "therapy": "Ex.: dúvida sobre evolução, tempo de tratamento, rotina e participação familiar."
 },
 {
  "id": "p3_results",
  "section": "3. O QUE VOCÊ RESOLVE",
  "theme": "Transformação",
  "type": "multi",
  "q": "Quais resultados o paciente mais deseja perceber?",
  "options": [
   "Mais confiança",
   "Bem-estar",
   "Naturalidade",
   "Melhora funcional",
   "Mais autonomia",
   "Melhor comunicação",
   "Mais segurança",
   "Melhor qualidade de vida",
   "Organização da rotina",
   "Evolução mensurável"
  ],
  "help": "Escolha a transformação percebida pelo paciente ou família.",
  "aesthetic": "Ex.: mais confiança, naturalidade e bem-estar com a própria imagem.",
  "therapy": "Ex.: mais autonomia, comunicação funcional e evolução mensurável no cotidiano."
 },
 {
  "id": "p3_service",
  "section": "3. O QUE VOCÊ RESOLVE",
  "theme": "Oferta prioritária",
  "type": "text",
  "q": "Qual serviço, procedimento ou linha de cuidado você mais deseja priorizar na comunicação?",
  "help": "Informe apenas o que realmente precisa ganhar visibilidade comercial agora.",
  "aesthetic": "Ex.: harmonização facial, bioestimulador ou tratamento de pele.",
  "therapy": "Ex.: avaliação neuropsicológica, terapia ocupacional, fonoaudiologia ou programa ABA."
 },
 {
  "id": "p3_score",
  "section": "3. O QUE VOCÊ RESOLVE",
  "theme": "Maturidade",
  "type": "score",
  "q": "A clínica consegue explicar de forma simples qual problema resolve e para quem?",
  "help": "Avalie se essa mensagem é entendida em poucos segundos.",
  "aesthetic": "0 = comunicação só fala nomes de procedimentos; 4 = benefício e público estão claros.",
  "therapy": "0 = lista especialidades sem mostrar a necessidade atendida; 4 = público e transformação estão claros."
 },
 {
  "id": "p4_method",
  "section": "4. COMO VOCÊ RESOLVE",
  "theme": "Método",
  "type": "text",
  "q": "Resuma em etapas como funciona a jornada do paciente do primeiro contato ao acompanhamento.",
  "help": "Use uma sequência curta. Ex.: contato → avaliação → plano → execução → acompanhamento.",
  "aesthetic": "Ex.: avaliação facial → plano individualizado → procedimento → retorno e acompanhamento.",
  "therapy": "Ex.: acolhimento → avaliação → plano terapêutico → sessões → reavaliação e orientação familiar."
 },
 {
  "id": "p4_diff",
  "section": "4. COMO VOCÊ RESOLVE",
  "theme": "Diferenciais",
  "type": "multi",
  "q": "Quais diferenciais concretos existem na entrega?",
  "options": [
   "Avaliação individualizada",
   "Equipe multiprofissional",
   "Protocolos definidos",
   "Tecnologia/equipamentos",
   "Acompanhamento pós-atendimento",
   "Plano personalizado",
   "Comunicação com família",
   "Mensuração de evolução",
   "Atendimento humanizado",
   "Integração entre profissionais"
  ],
  "help": "Marque diferenciais que podem ser demonstrados na prática.",
  "aesthetic": "Ex.: avaliação individualizada, tecnologia e acompanhamento pós-procedimento.",
  "therapy": "Ex.: equipe multiprofissional, plano individualizado, mensuração de evolução e comunicação com família."
 },
 {
  "id": "p4_experience",
  "section": "4. COMO VOCÊ RESOLVE",
  "theme": "Experiência",
  "type": "multi",
  "q": "Como o paciente deve se sentir durante a experiência?",
  "options": [
   "Acolhido",
   "Seguro",
   "Bem orientado",
   "Exclusivo",
   "Respeitado",
   "Confiante",
   "Acompanhado",
   "Com clareza sobre próximos passos"
  ],
  "help": "Essas sensações devem orientar atendimento, ambiente, scripts e conteúdo.",
  "aesthetic": "Ex.: seguro, exclusivo e bem orientado.",
  "therapy": "Ex.: acolhido, acompanhado e com clareza sobre os próximos passos."
 },
 {
  "id": "p4_score",
  "section": "4. COMO VOCÊ RESOLVE",
  "theme": "Maturidade",
  "type": "score",
  "q": "Existe um método/processo de atendimento claro e que pode ser explicado ao público?",
  "help": "Avalie se a experiência tem etapas previsíveis e comunicáveis.",
  "aesthetic": "0 = atendimento varia muito; 4 = jornada e acompanhamento estão definidos.",
  "therapy": "0 = cada profissional conduz de um jeito; 4 = fluxo assistencial, plano e acompanhamento estão estruturados."
 },
 {
  "id": "p5_proofs",
  "section": "5. POR QUE CONFIAR EM VOCÊ",
  "theme": "Provas",
  "type": "multi",
  "q": "Quais sinais de confiança a clínica já possui?",
  "options": [
   "Formações/especializações",
   "Registro profissional",
   "Tempo de experiência",
   "Avaliações online",
   "Depoimentos autorizados",
   "Cases autorizados",
   "Equipe especializada",
   "Protocolos/evidências",
   "Parcerias",
   "Indicadores de acompanhamento"
  ],
  "help": "Selecione apenas provas que vocês realmente conseguem apresentar ou comprovar.",
  "aesthetic": "Ex.: formação específica, avaliações, experiência e protocolos de segurança.",
  "therapy": "Ex.: equipe especializada, registros profissionais, indicadores de evolução e protocolos baseados em evidências."
 },
 {
  "id": "p5_reputation",
  "section": "5. POR QUE CONFIAR EM VOCÊ",
  "theme": "Reputação",
  "type": "select",
  "q": "Como a clínica acompanha hoje a opinião dos pacientes?",
  "options": [
   "Não acompanha",
   "Recebe feedback informal",
   "Usa avaliações do Google/redes sociais",
   "Aplica pesquisa de satisfação/NPS",
   "Possui rotina estruturada de feedback"
  ],
  "help": "Escolha a opção que melhor representa a prática atual.",
  "aesthetic": "Ex.: avaliações do Google + pesquisa após procedimentos.",
  "therapy": "Ex.: NPS/feedback familiar + acompanhamento de percepção ao longo do tratamento."
 },
 {
  "id": "p5_authority",
  "section": "5. POR QUE CONFIAR EM VOCÊ",
  "theme": "Autoridade",
  "type": "multi",
  "q": "Quais elementos de autoridade podem aparecer na comunicação?",
  "options": [
   "Apresentação da equipe",
   "Formação profissional",
   "Bastidores técnicos",
   "Explicação de protocolos",
   "Participação em eventos",
   "Conteúdo científico traduzido",
   "Certificações",
   "Experiência clínica",
   "Resultados/indicadores autorizados"
  ],
  "help": "Autoridade não é apenas diploma: é mostrar critérios, método, consistência e domínio do tema.",
  "aesthetic": "Ex.: critérios de indicação, bastidores técnicos e formação.",
  "therapy": "Ex.: raciocínio clínico, instrumentos de avaliação, formação e evolução monitorada."
 },
 {
  "id": "p5_score",
  "section": "5. POR QUE CONFIAR EM VOCÊ",
  "theme": "Maturidade",
  "type": "score",
  "q": "A autoridade e as provas da clínica aparecem de forma consistente nas redes sociais?",
  "help": "Avalie se o perfil reduz insegurança e ajuda o paciente a confiar antes do contato.",
  "aesthetic": "0 = quase nenhuma prova; 4 = credenciais, método e reputação aparecem com frequência.",
  "therapy": "0 = especialidades são citadas, mas autoridade não é demonstrada; 4 = equipe, método e evidências são bem apresentados."
 },
 {
  "id": "social_goal",
  "section": "6. REDES SOCIAIS",
  "theme": "Objetivo",
  "type": "multi",
  "q": "Quais são os principais objetivos da clínica nas redes sociais?",
  "options": [
   "Atrair novos pacientes",
   "Aumentar agendamentos",
   "Fortalecer autoridade",
   "Educar o público",
   "Melhorar relacionamento",
   "Divulgar serviços",
   "Fortalecer marca local",
   "Gerar indicações"
  ],
  "help": "Escolha os objetivos realmente prioritários para os próximos meses.",
  "aesthetic": "Ex.: fortalecer autoridade + aumentar agendamentos do procedimento prioritário.",
  "therapy": "Ex.: educar famílias + fortalecer autoridade + gerar avaliações/agendamentos."
 },
 {
  "id": "social_frequency",
  "section": "6. REDES SOCIAIS",
  "theme": "Frequência",
  "type": "select",
  "q": "Com que frequência a clínica publica atualmente?",
  "options": [
   "Não publica com frequência",
   "Menos de 1 vez por semana",
   "1 vez por semana",
   "2 a 3 vezes por semana",
   "4 a 5 vezes por semana",
   "Diariamente"
  ],
  "help": "Considere publicações de feed/Reels. Stories podem ter uma rotina diferente.",
  "aesthetic": "Ex.: 2 a 3 vezes por semana no feed, com Stories quase diários.",
  "therapy": "Ex.: 1 a 2 conteúdos educativos por semana + Stories de rotina."
 },
 {
  "id": "social_formats",
  "section": "6. REDES SOCIAIS",
  "theme": "Formatos",
  "type": "multi",
  "q": "Quais formatos a clínica já utiliza ou tem facilidade para produzir?",
  "options": [
   "Stories",
   "Reels falando para a câmera",
   "Reels com narração",
   "Carrossel",
   "Post estático",
   "Depoimento",
   "Bastidores",
   "Live"
  ],
  "help": "Marque o que é realisticamente sustentável para a equipe.",
  "aesthetic": "Ex.: Reels com profissional falando + Stories + carrosséis educativos.",
  "therapy": "Ex.: carrosséis educativos + Reels explicativos + bastidores da equipe sem expor pacientes."
 },
 {
  "id": "social_difficulty",
  "section": "6. REDES SOCIAIS",
  "theme": "Dificuldades",
  "type": "multi",
  "q": "O que mais dificulta manter uma comunicação consistente?",
  "options": [
   "Falta de tempo",
   "Falta de ideias",
   "Falta de planejamento",
   "Dificuldade para escrever",
   "Dificuldade para aparecer em vídeo",
   "Falta de equipe",
   "Não sabe o que priorizar",
   "Baixo retorno percebido"
  ],
  "help": "Isso ajuda a construir um plano executável, e não apenas ideal.",
  "aesthetic": "Ex.: profissional grava bem, mas falta planejamento e constância.",
  "therapy": "Ex.: equipe tem conhecimento, mas falta transformar temas técnicos em conteúdo simples."
 },
 {
  "id": "social_cta",
  "section": "6. REDES SOCIAIS",
  "theme": "Conversão",
  "type": "select",
  "q": "Qual ação você mais deseja que o público faça após consumir o conteúdo?",
  "options": [
   "Enviar mensagem no WhatsApp",
   "Agendar avaliação",
   "Solicitar orçamento",
   "Seguir o perfil",
   "Salvar/compartilhar",
   "Preencher formulário",
   "Visitar o site"
  ],
  "help": "Escolha a ação comercial mais importante. Ela orientará os CTAs dos conteúdos.",
  "aesthetic": "Ex.: solicitar avaliação ou conversar no WhatsApp.",
  "therapy": "Ex.: agendar avaliação inicial ou falar com a equipe de acolhimento."
 }
];
