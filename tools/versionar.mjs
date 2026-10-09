// Versiona os arquivos do portal para o navegador sempre baixar a versão publicada.
// O GitHub Pages não permite controlar o cache; por isso cada script e estilo recebe "?v=<hash do conteúdo>".
// Os módulos importados entre si (inclusive os carregados sob demanda) são redirecionados por um
// import map; a política de segurança (CSP) recebe o hash desse bloco para autorizá-lo.
// Uso: node tools/versionar.mjs        (atualiza index.html)
//      node tools/versionar.mjs --check (só confere; sai com erro se estiver desatualizado)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const hash = (arq) => crypto.createHash('sha256').update(fs.readFileSync(path.join(RAIZ, arq))).digest('hex').slice(0, 10);
const listar = (dir) => fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? listar(path.join(dir, d.name)) : d.name.endsWith('.js') ? [path.join(dir, d.name).split(path.sep).join('/')] : []));

// Páginas carregadas em quadro (iframe) também levam versão: o módulo versao.js guarda o hash delas.
export function gerarVersaoJs() {
  return `// Gerado por tools/versionar.mjs — não editar à mão.\nexport const VERSAO_PAINEL = '${hash('assets/painel/painel-mestre.html')}';\n`;
}

export function gerarIndex(html) {
  const modulos = listar('assets/js').sort();
  const mapa = { imports: Object.fromEntries(modulos.map((m) => ['./' + m, './' + m + '?v=' + hash(m)])) };
  const bloco = JSON.stringify(mapa);
  const sha = crypto.createHash('sha256').update(bloco).digest('base64');
  let novo = html
    .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
    .replace(/(<script src="assets\/vendor\/supabase\/supabase\.js[^"]*"><\/script>)/, `<script type="importmap">${bloco}</script>\n$1`)
    .replace(/script-src 'self'( 'sha256-[^']+')?/, `script-src 'self' 'sha256-${sha}'`)
    .replace(/(href|src)="(assets\/(?:css\/[\w-]+\.css|js\/app\.js|vendor\/supabase\/supabase\.js))(\?v=[\w]+)?"/g,
      (_, attr, arq) => `${attr}="${arq}?v=${hash(arq)}"`);
  return novo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const arqVersao = path.join(RAIZ, 'assets/js/core/versao.js');
  const versaoAtual = fs.existsSync(arqVersao) ? fs.readFileSync(arqVersao, 'utf8') : '';
  if (versaoAtual !== gerarVersaoJs()) {
    if (process.argv.includes('--check')) { console.error('versao.js desatualizado: rode "node tools/versionar.mjs".'); process.exit(1); }
    fs.writeFileSync(arqVersao, gerarVersaoJs());
  }
  const arq = path.join(RAIZ, 'index.html');
  const atual = fs.readFileSync(arq, 'utf8');
  const novo = gerarIndex(atual);
  if (process.argv.includes('--check')) {
    if (novo !== atual) { console.error('index.html desatualizado: rode "node tools/versionar.mjs".'); process.exit(1); }
    console.log('index.html em dia.');
  } else { fs.writeFileSync(arq, novo); console.log(novo === atual ? 'Nada mudou.' : 'index.html atualizado.'); }
}
