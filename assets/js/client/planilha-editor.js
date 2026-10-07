// Planilha preenchível (kits operacionais). Cada clínica preenche a SUA cópia:
// as células já preenchidas no modelo são fixas; as vazias são para o cliente.
// O salvamento é automático no portal; "Enviar para a ELOGA" grava uma cópia no Drive.
import { db, q, funcao, registrar } from '../core/api.js';
import { html, montar, $, debounce, fmtDataHora } from '../core/dom.js';
import { avisar, avisarErro, ocupado, mensagemErro } from '../core/ui.js';
import { mesclarRespostas, valores } from '../core/planilha.js';
import { csvGrade } from '../admin/exportar.js';
import { baixar, nomeArquivo } from '../core/dom.js';

/** Tabela da planilha. editavel=false mostra só os valores (conferência pela ELOGA). */
export function gradeHtml(mescladas, iAba, { editavel = true } = {}) {
  const aba = mescladas[iAba]; if (!aba) return '';
  return html`<div class="table-wrap planilha-wrap"><table class="t planilha"><thead><tr>${aba.linhas[0].map((c) => html`<th>${c.v}</th>`)}</tr></thead><tbody>
    ${aba.linhas.slice(1).map((linha, k) => html`<tr class="${linha[0]?.extra ? 'extra' : ''}">${linha.map((c, j) => html`<td>${c.fixo || !editavel
      ? html`<span class="${c.fixo ? 'fixo' : ''}">${c.v}</span>`
      : html`<input type="text" maxlength="2000" value="${c.v}" data-cel="${iAba}|${k + 1}|${j}" aria-label="${aba.linhas[0][j]?.v || 'Coluna ' + (j + 1)}, linha ${k + 1}">`}</td>`)}</tr>`)}
  </tbody></table></div>`;
}

const abasHtml = (mescladas, atual) => (mescladas.length > 1 ? html`<div class="tabs" role="tablist" style="margin-bottom:10px">${mescladas.map((a, i) => html`<button class="tab" role="tab" type="button" data-aba-planilha="${i}" aria-selected="${i === atual}">${a.nome}</button>`)}</div>` : '');

/** Editor do cliente para um material com planilha (estrutura). */
export async function abrirEditor(caixa, material, { clientId, aoFechar } = {}) {
  let linha = await q(db.from('material_respostas').select('id, dados, atualizado_em, drive_em').eq('material_id', material.id).eq('client_id', clientId).maybeSingle());
  const dados = structuredClone(linha?.dados?.abas ? linha.dados : { abas: material.estrutura.abas.map((a) => ({ linhas: a.linhas.map((l) => l.map(() => '')) })) });
  let aba = 0, salvando = false;
  const ctl = new AbortController(), o = { signal: ctl.signal };

  const desenhar = () => {
    const m = mesclarRespostas(material.estrutura, dados);
    montar(caixa, html`<div class="card planilha-card">
      <div class="row between" style="gap:12px;flex-wrap:wrap"><div><h2 style="margin:0">${material.titulo}</h2>
        <p class="small muted" style="margin:4px 0 0">Preencha os campos em branco. Os textos em cinza fazem parte do modelo. Esta cópia é só da sua clínica.</p></div>
        <div class="toolbar"><span id="flag-planilha" class="saveflag" aria-live="polite">${linha ? 'Salvo em ' + fmtDataHora(linha.atualizado_em) : 'Ainda não preenchida'}</span>
          <button class="btn sm ghost" type="button" data-fechar>Fechar</button></div></div>
      <div style="margin-top:14px">${abasHtml(m, aba)}${gradeHtml(m, aba)}</div>
      <div class="toolbar" style="margin-top:12px">
        ${material.permite_linhas !== false ? html`<button class="btn sm secondary" type="button" data-nova-linha>+ Adicionar linha</button>` : ''}
        <span class="xs muted" style="margin-right:auto">${linha?.drive_em ? 'Última cópia enviada à ELOGA em ' + fmtDataHora(linha.drive_em) + '.' : 'Quando terminar, envie para a ELOGA.'}</span>
        <button class="btn purple" type="button" data-enviar>Enviar para a ELOGA</button></div></div>`);
  };
  const flag = (t, k = '') => { const f = $('#flag-planilha', caixa); if (f) { f.textContent = t; f.className = 'saveflag ' + k; } };

  async function gravar() {
    if (salvando) return; salvando = true; flag('Salvando...');
    try {
      linha = await q(db.from('material_respostas').upsert({ material_id: material.id, client_id: clientId, dados }, { onConflict: 'material_id,client_id' })
        .select('id, dados, atualizado_em, drive_em').single());
      flag('Salvo às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 'ok');
    } catch (e) { flag('Não salvo: ' + mensagemErro(e), 'bad'); }
    finally { salvando = false; }
  }
  const salvar = debounce(gravar, 1200);

  caixa.addEventListener('input', (e) => {
    const c = e.target.dataset.cel; if (!c) return;
    const [a, i, j] = c.split('|').map(Number);
    const g = dados.abas[a] ||= { linhas: [] };
    while (g.linhas.length <= i) g.linhas.push([]);
    g.linhas[i][j] = e.target.value;
    flag('Alterações não salvas...'); salvar();
  }, o);
  caixa.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.abaPlanilha) { aba = +b.dataset.abaPlanilha; desenhar(); return; }
    if (b.hasAttribute('data-fechar')) { salvar.flush(); ctl.abort(); montar(caixa, html``); aoFechar?.(); return; }
    if (b.hasAttribute('data-nova-linha')) {
      const modelo = material.estrutura.abas[aba]; const g = dados.abas[aba] ||= { linhas: [] };
      const total = Math.max(modelo.linhas.length, g.linhas.length);
      while (g.linhas.length < total) g.linhas.push([]);
      g.linhas.push(Array.from({ length: modelo.linhas[0].length }, () => ''));
      desenhar(); salvar(); return;
    }
    if (b.hasAttribute('data-enviar')) await ocupado(b, async () => {
      try {
        await salvar.flush(); if (!linha) await gravar();
        await funcao('planilha-drive', { material_id: material.id });
        linha = await q(db.from('material_respostas').select('id, dados, atualizado_em, drive_em').eq('material_id', material.id).eq('client_id', clientId).maybeSingle());
        avisar('Planilha enviada para a ELOGA.', 'ok'); desenhar();
      } catch (err) { avisarErro(err); }
    });
  }, o);
  desenhar();
  registrar('cliente.material_aberto', { entidade: 'materials', id: material.id, detalhes: { planilha: true } });
  caixa.scrollIntoView({ behavior: 'smooth' });
  return () => { salvar.flush(); ctl.abort(); };
}

/** Conferência pela ELOGA: respostas de uma clínica, só leitura, com CSV e reenvio ao Drive. */
export function respostaHtml(material, resposta, iAba = 0) {
  const m = mesclarRespostas(material.estrutura, resposta?.dados);
  return html`${abasHtml(m, iAba)}${gradeHtml(m, iAba, { editavel: false })}`;
}

export function baixarCsvResposta(material, resposta, cliente) {
  const m = valores(mesclarRespostas(material.estrutura, resposta?.dados));
  const linhas = m.flatMap((a, i) => [...(m.length > 1 ? [[(i ? '\n' : '') + 'Aba: ' + a.nome]] : []), ...a.linhas]);
  baixar(csvGrade(linhas), `ELOGA_${nomeArquivo(material.titulo)}_${nomeArquivo(cliente)}.csv`);
}
