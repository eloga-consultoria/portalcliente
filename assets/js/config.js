// Configuração pública do portal. NÃO coloque segredos aqui (este arquivo é público).
// A chave abaixo é a chave PUBLICÁVEL do Supabase: ela só permite o que as regras
// de acesso (RLS) do banco autorizam.
export const CONFIG = Object.freeze({
  // PROJETO OFICIAL (ELOGA Portal Estratégico). O projeto de teste (qqwcjvsaiyghbnrsdjkp)
  // fica pausado e só é usado para testar mudanças antes de aplicá-las aqui.
  supabaseUrl: 'https://skatnnwkxcbzmoohexsx.supabase.co',
  supabaseKey: 'sb_publishable_rBPxk_InKeL4JRYPoEfvVw_EK5YlrXg',

  agendaUrl: 'https://calendar.app.google/opu1h9YWeJ3hd7YK9',
  contato: {
    email: 'eloga.contato@gmail.com',
    instagram: 'https://www.instagram.com/eloga.saude/',
    instagramLabel: '@eloga.saude',
    site: 'https://eloga-consultoria.github.io/site/',
    linkedin: 'https://www.linkedin.com/in/eloga-consultoria',
    whatsapp: 'https://wa.me/5511945027978',
  },

  // Termo de ciência e consentimento (LGPD). Ao mudar o texto, mude a versão:
  // todos os clientes verão o novo termo no próximo acesso.
  termoVersao: 'v1-2026-10',

  // Encerramento automático da sessão por inatividade (minutos)
  inatividadeCliente: 30,
  inatividadeAdmin: 20,

  // "Esqueci minha senha" por e-mail exige SMTP próprio configurado no Supabase
  // (o envio padrão do plano gratuito é limitado). Enquanto false, o cliente
  // é orientado a pedir nova senha à ELOGA.
  recuperacaoPorEmail: false,

  // Lembrete de backup no painel quando o último backup tiver mais de N dias
  lembreteBackupDias: 30,
});
