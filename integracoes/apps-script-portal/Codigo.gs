/* =====================================================================
   PORTAL ELOGA · Integração do portal (e-mail do posicionamento e planilhas no Drive)
   Script EXCLUSIVO do portal. Não tem relação com o site nem com o
   formulário de autodiagnóstico (que continuam com o script deles).

   O que faz:
   1) recebe do portal (edge function "enviar-posicionamento") o PDF do
      diagnóstico de posicionamento e envia SOMENTE para o e-mail da ELOGA.
      O cliente nunca recebe este relatório.
   2) recebe do portal (edge function "planilha-drive") a planilha preenchida
      por um cliente e salva uma cópia no Drive da ELOGA, na pasta
      "Portal ELOGA · Planilhas / <Clínica>" (uma Planilha Google por material
      e por clínica, atualizada a cada novo envio).
   Ao implantar, o Google pede autorização para Gmail, Drive e Planilhas: aceite.

   Configuração (uma única vez):
   1. script.google.com > Novo projeto > cole este código > Salvar.
   2. Configurações do projeto > Propriedades do script > adicionar:
        PORTAL_TOKEN = (uma senha longa e aleatória; a mesma vai no Supabase
                        como segredo APPS_SCRIPT_TOKEN)
   3. Implantar > Nova implantação > Tipo: App da Web
        Executar como: Eu · Quem pode acessar: Qualquer pessoa
      Copie a URL gerada: ela vai no Supabase como segredo APPS_SCRIPT_URL.
   ===================================================================== */
const ELOGA_EMAIL = 'eloga.contato@gmail.com';
const LIMITE_PDF_BASE64 = 6000000; // ~4,5 MB

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const esperado = PropertiesService.getScriptProperties().getProperty('PORTAL_TOKEN');
    if (!esperado || String(p.token || '') !== esperado) return json_({ ok: false, error: 'nao_autorizado' });
    if (p.stage === 'planilha') return salvarPlanilha_(p);
    return enviarPosicionamento_(p);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'erro_interno' });
  }
}

// ---------------------------------------------------------------- posicionamento (e-mail só para a ELOGA)
function enviarPosicionamento_(p) {
  if (!p.pdf_base64 || p.pdf_base64.length > LIMITE_PDF_BASE64) return json_({ ok: false, error: 'pdf_invalido' });
  const nomeArquivo = String(p.pdf_filename || 'ELOGA_Posicionamento.pdf').replace(/[^\w.\-]/g, '_').slice(0, 120);
  const pdf = Utilities.newBlob(Utilities.base64Decode(p.pdf_base64), 'application/pdf', nomeArquivo);
  const quando = p.submitted_at ? Utilities.formatDate(new Date(p.submitted_at), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm') : '';
  GmailApp.sendEmail(ELOGA_EMAIL,
    '[Portal] Diagnóstico de posicionamento enviado — ' + (p.clinic_name || 'Cliente'),
    'Um cliente concluiu a ficha de posicionamento no Portal ELOGA.\n\n' +
    'Clínica: ' + (p.clinic_name || '') + '\n' +
    'Segmento: ' + (p.segment || '') + '\n' +
    'Cidade: ' + (p.city || '') + '\n' +
    'Login no portal: ' + (p.portal_email || '') + '\n' +
    'Enviado em: ' + quando + '\n\n' +
    'O relatório segue em anexo. O cliente NÃO recebeu este relatório.',
    { name: 'Portal ELOGA', attachments: [pdf] });
  return json_({ ok: true });
}

// ---------------------------------------------------------------- planilhas preenchidas pelos clientes
// Cria (ou atualiza) uma Planilha Google por material e por clínica, na pasta
// "Portal ELOGA · Planilhas / <Clínica>". O arquivo fica só no Drive da ELOGA.
const PASTA_PLANILHAS = 'Portal ELOGA · Planilhas';

function salvarPlanilha_(p) {
  const chave = String(p.chave || '');
  if (!/^[0-9a-f-]{36}:[0-9a-f-]{36}$/i.test(chave)) return json_({ ok: false, error: 'chave_invalida' });
  if (!p.abas || p.abas.length > 2000000) return json_({ ok: false, error: 'planilha_invalida' });
  const abas = JSON.parse(p.abas);
  if (!Array.isArray(abas) || !abas.length || abas.length > 10) return json_({ ok: false, error: 'planilha_invalida' });

  const props = PropertiesService.getScriptProperties();
  const titulo = String(p.titulo || 'Planilha').slice(0, 180);
  let planilha = null;
  const idSalvo = props.getProperty('planilha:' + chave);
  if (idSalvo) { try { planilha = SpreadsheetApp.openById(idSalvo); } catch (e) { planilha = null; } }
  if (!planilha) {
    planilha = SpreadsheetApp.create(titulo);
    const arquivo = DriveApp.getFileById(planilha.getId());
    arquivo.moveTo(pastaDaClinica_(String(p.cliente || 'Clínica')));
    props.setProperty('planilha:' + chave, planilha.getId());
  } else {
    planilha.rename(titulo);
  }

  // Reescreve todas as abas com a versão mais recente enviada pelo portal
  const temporaria = planilha.insertSheet('_portal_' + Date.now());
  planilha.getSheets().forEach(function (s) { if (s.getSheetId() !== temporaria.getSheetId()) planilha.deleteSheet(s); });
  const usados = {};
  abas.forEach(function (aba, i) {
    let nome = String(aba.nome || ('Aba ' + (i + 1))).replace(/[\[\]\*\?\/\\:]/g, ' ').trim().slice(0, 90) || ('Aba ' + (i + 1));
    while (usados[nome]) nome = nome.slice(0, 85) + ' (' + (i + 1) + ')';
    usados[nome] = true;
    const sh = planilha.insertSheet(nome, i);
    const linhas = (aba.linhas || []).slice(0, 500);
    const cols = Math.max(1, ...linhas.map(function (l) { return (l || []).length; }));
    if (linhas.length) {
      const grade = linhas.map(function (l) { const r = []; for (let j = 0; j < cols; j++) r.push(String((l || [])[j] || '').slice(0, 2000)); return r; });
      sh.getRange(1, 1, grade.length, cols).setNumberFormat('@').setValues(grade);
      sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#0B2032').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, cols);
    }
  });
  planilha.deleteSheet(temporaria);
  return json_({ ok: true, url: planilha.getUrl() });
}

function pastaDaClinica_(cliente) {
  const raiz = buscarOuCriarPasta_(DriveApp.getRootFolder(), PASTA_PLANILHAS);
  return buscarOuCriarPasta_(raiz, cliente.replace(/[\/\\]/g, '-').slice(0, 120));
}

function buscarOuCriarPasta_(pai, nome) {
  const it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : pai.createFolder(nome);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
