/* =====================================================================
   PORTAL ELOGA · E-mail do diagnóstico de posicionamento
   Script EXCLUSIVO do portal. Não tem relação com o site nem com o
   formulário de autodiagnóstico (que continuam com o script deles).

   O que faz: recebe do portal (edge function "enviar-posicionamento") o PDF
   do diagnóstico de posicionamento e envia SOMENTE para o e-mail da ELOGA.
   O cliente nunca recebe este relatório.

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
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'erro_interno' });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
