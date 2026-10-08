// Material comercial da ELOGA (portfólio de programas, frentes e bônus) gerado a partir de
// "Programas e preços". Sai no mesmo papel timbrado dos relatórios (logo em todas as páginas).
import { html } from '../core/dom.js';
import { CONFIG } from '../config.js';
import { FRONT_KEYS, COBRANCA_FORMATO } from '../admin/operacional-modelo.js';
import { capa } from './documentos-operacionais.js';

const brl = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const hoje = () => new Date().toLocaleDateString('pt-BR');

const PILARES = [
  ['Pessoas', 'Equipe treinada, com papéis claros, scripts e rotinas que não dependem de uma única pessoa.'],
  ['Processos', 'Fluxos padronizados, POPs e indicadores que mostram o que acontece na operação todos os dias.'],
  ['Modelo de negócio', 'Precificação, margem e mix de receitas que sustentam o crescimento com previsibilidade.'],
];
const JORNADA = [
  ['Autodiagnóstico', 'Formulário gratuito que mede a maturidade da gestão em seis pilares.'],
  ['Sessão de diagnóstico', 'Conversa de 45 minutos para entender a operação, as dores e os dados disponíveis.'],
  ['Relatório', 'Leitura técnica por pilar, capacidade de atendimento, achados e recomendações imediatas.'],
  ['Proposta sob medida', 'Formato, frentes e investimento ajustados ao momento da clínica.'],
  ['Implantação', 'Linha de base, plano de ação, implantação e acompanhamento com indicadores.'],
];

function precoFormato(f, cat) {
  if (f.cobranca === 'soma_frentes') {
    const min = Math.min(...FRONT_KEYS.map((k) => +cat.fronts[k]?.monthly || 0).filter(Boolean));
    return html`a partir de ${brl(min)} <small>/mês por frente</small>`;
  }
  if (f.price == null || f.price === '') return '';
  return html`${brl(f.price)} <small>${f.cobranca === 'unico' ? 'pagamento único' : f.cobranca === 'por_frente' ? 'por frente' : '/mês'}</small>`;
}

/** Portfólio comercial. precos=false gera a versão sem valores (apresentação institucional). */
export function materialComercialHtml(cat, { precos = true } = {}) {
  const c = CONFIG.contato;
  const bonus = Object.values(cat.bonus || {}).filter((b) => b?.name);
  const wpp = (c.whatsapp || '').replace(/\D/g, '').replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
  let n = 0; const sec = () => ++n;
  return html`
  ${capa('Programas e', 'Soluções em Gestão', { name: '' }, null,
    html`<b>Consultoria &amp; Estratégias em Saúde</b><br>Gestão operacional, financeira e comercial para clínicas e profissionais de saúde<br>Material comercial · ${hoje()}`)}
  <div class="page">
    <h2><span class="num">${sec()}</span>Por que a ELOGA</h2>
    <p>A ELOGA estrutura a gestão de clínicas a partir de dados reais da operação. Não entregamos apenas recomendações: implantamos processos, ferramentas e indicadores, e acompanhamos até o resultado aparecer nos números.</p>
    <div class="kpis">${PILARES.map(([t, d]) => html`<div class="kpi"><small>${t}</small><p style="margin:6px 0 0;font-size:12.5px">${d}</p></div>`)}</div>

    <h2><span class="num">${sec()}</span>Como trabalhamos</h2>
    <div class="jornada avoid">${JORNADA.map(([t, d], i) => html`<div class="etapa"><div class="seta"><span>${i + 1}</span>${t}</div><p>${d}</p></div>`)}</div>

    <h2 class="quebra"><span class="num">${sec()}</span>Formatos de atuação</h2>
    <p>Cada clínica está em um momento. Por isso, o formato é definido pelo diagnóstico: organizar os dados, analisar uma frente ou implantar com acompanhamento.</p>
    <div class="opts">${Object.values(cat.formats || {}).filter((f) => f?.name).map((f) => html`<div class="opt avoid">
      <div class="sub">${COBRANCA_FORMATO[f.cobranca] || ''}</div><h4>${f.name}</h4><p class="sub">${f.desc || ''}</p>
      ${precos && precoFormato(f, cat) ? html`<div class="price">${precoFormato(f, cat)}</div>${f.nota ? html`<p class="sub">${f.nota}</p>` : ''}` : ''}
      <ul class="ck" style="font-size:12.5px">${(f.items || []).map((x) => html`<li>${x}</li>`)}</ul></div>`)}</div>

    <h2 class="quebra"><span class="num">${sec()}</span>Frentes de atuação</h2>
    <p>As frentes podem ser contratadas isoladamente ou combinadas. Todas partem de uma linha de base e terminam com o comparativo antes e depois.</p>
    ${FRONT_KEYS.map((k) => cat.fronts[k]).filter(Boolean).map((F) => html`<div class="avoid" style="margin-bottom:16px">
      <h3>${F.name}${precos && F.monthly ? html` <span class="hint" style="font-weight:600">· ${F.monthlyNote || 'referência ' + brl(F.monthly) + '/mês'}</span>` : ''}</h3>
      <table class="t"><thead><tr><th style="width:50%">O que é trabalhado</th><th>O que a clínica recebe</th></tr></thead><tbody>
      <tr><td><ul class="ck">${(F.modules || []).map((m) => html`<li>${m}</li>`)}</ul></td><td><ul class="ck">${(F.deliverables || []).map((m) => html`<li>${m}</li>`)}</ul>
        ${(F.kpis || []).length ? html`<p style="margin-top:8px"><b>Indicadores acompanhados:</b> ${F.kpis.join(' · ')}</p>` : ''}</td></tr></tbody></table></div>`)}

    ${cat.system?.name ? html`<h2><span class="num">${sec()}</span>${cat.system.name}</h2>
    <div class="callout avoid"><p>Configuração funcional de CRM ou sistema de agendamento, com processos e equipe preparados para usar.${precos && cat.system.price ? html` <b>Investimento: ${brl(cat.system.price)}</b>` : ''}</p></div>
    <ul class="ck">${(cat.system.items || []).map((x) => html`<li>${x}</li>`)}</ul>
    ${(cat.system.outside || []).length ? html`<p class="hint">${cat.system.outside.join(' ')}</p>` : ''}` : ''}

    ${bonus.length ? html`<h2 class="quebra"><span class="num">${sec()}</span>Bônus que aceleram a implantação</h2>
    <p>Ferramentas prontas que ficam com a clínica e podem ser incluídas nas propostas, conforme o formato contratado.</p>
    <div class="bonus-grid">${bonus.map((b) => html`<div class="bonus avoid">
      <div class="b-topo"><span class="b-selo">Bônus</span>${precos && b.valor ? html`<span class="b-valor">valor de referência <b style="color:var(--d-navy)">${brl(b.valor)}</b></span>` : ''}</div>
      <h4>${b.name}</h4>${b.chamada ? html`<p class="b-chamada">${b.chamada}</p>` : ''}${b.desc ? html`<p class="b-desc">${b.desc}</p>` : ''}
      ${(b.items || []).length ? html`<ul class="ck">${b.items.map((x) => html`<li>${x}</li>`)}</ul>` : ''}</div>`)}</div>` : ''}

    <h2><span class="num">${sec()}</span>Condições gerais</h2>
    <table class="t avoid"><tbody>
      <tr><td style="width:30%"><b>Formato</b></td><td>Encontros online, com opção de encontros presenciais em Osasco e São Paulo.</td></tr>
      <tr><td><b>Duração mínima</b></td><td>Programas de acompanhamento: ${cat.minMonths || 3} meses.</td></tr>
      <tr><td><b>Suporte</b></td><td>Resposta em até 2 dias úteis entre os encontros, por e-mail ou WhatsApp.</td></tr>
      ${precos ? html`<tr><td><b>Valores</b></td><td>Valores de referência. O investimento final é definido na proposta, após o diagnóstico.</td></tr>` : ''}
    </tbody></table>

    <div class="caminho avoid" style="margin-top:20px"><div class="cam-topo"><small>Próximo passo</small>
      <h3>Comece pelo autodiagnóstico da sua clínica</h3>
      <p>Em poucos minutos, a gestão identifica os pilares mais frágeis e recebe a leitura da ELOGA. A partir dele, agendamos a sessão de diagnóstico.</p></div>
      <div class="cam-cta"><b>Fale com a ELOGA</b><span>${[c.email, c.instagramLabel, wpp && 'WhatsApp ' + wpp, c.site && c.site.replace(/^https?:\/\//, '').replace(/\/$/, '')].filter(Boolean).join('  ·  ')}</span></div></div>
  </div>
  <div class="foot"><span>ELOGA · Consultoria &amp; Estratégias em Saúde</span><span>Material comercial · ${hoje()}</span></div>`;
}
