#!/usr/bin/env node
// ColabSign: tradução para português do Brasil na hora do build.
//
// O SignuDoc não tem estrutura de idiomas. Em vez de mexer nos arquivos do
// upstream no git (o que daria conflito a cada atualização), este script
// traduz a cópia que vai ser compilada, dentro do Docker, antes do
// `next build`. Nada é gravado no repositório.
//
// Como funciona:
// 1. trocas.mjs: trocas exatas de trechos de código (formatos de data, fuso
//    horário, frases quebradas em pedaços). Cada trecho precisa ser achado o
//    número de vezes indicado; se não for, o build para.
// 2. Glossário (pt-BR/*.json, inglês -> português): o script lê cada arquivo
//    do escopo com o parser do TypeScript e troca só o que é texto de tela:
//    texto de JSX, atributos como title/label/placeholder e textos entre
//    aspas. Nunca troca textos usados em comparações (===, case), chaves de
//    objeto, tipos, imports ou atributos técnicos (className, href, id...).
//    Textos com ${...} precisam manter as mesmas expressões na tradução.
// 3. Relatório: lista os textos em inglês do escopo que ainda não têm
//    tradução nem estão em ignorar.json. Com --estrito, isso também é erro
//    (use no CI para pegar frases novas do upstream).
//
// Uso:
//   node colab/i18n/aplicar.mjs                 # traduz no lugar (só no Docker!)
//   node colab/i18n/aplicar.mjs --check         # confere sem gravar
//   node colab/i18n/aplicar.mjs --check --faltando   # lista o que falta
//   node colab/i18n/aplicar.mjs --check --estrito    # falha se faltar algo
//   --root DIR   outra raiz (padrão: a raiz do repo)
// O TypeScript vem do node_modules do repo; COLAB_TS_PATH aponta outro.

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const estrito = args.includes("--estrito");
const mostrarFaltando = args.includes("--faltando") || estrito;
const rootIndex = args.indexOf("--root");
const root =
  rootIndex >= 0 ? path.resolve(args[rootIndex + 1]) : path.resolve(here, "../..");

const require = createRequire(path.join(root, "package.json"));
const ts = require(process.env.COLAB_TS_PATH || "typescript");

const erros = [];

// ---------------------------------------------------------------- dados

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

// Glossário geral (vale em todo o escopo) e, por arquivo, entradas que só
// valem ali: { "src/lib/x.ts": { "sign": "assinar" } }. Palavras curtas que
// também podem ser valores de código ficam sempre por arquivo.
const glossario = new Map();
const porArquivo = new Map();
const glossDir = path.join(here, "pt-BR");
function addEntry(map, en, pt, name) {
  const key = collapse(en);
  if (typeof pt !== "string") {
    erros.push(`glossário: "${key}" sem tradução em texto (${name})`);
    return;
  }
  if (map.has(key) && map.get(key) !== pt) {
    erros.push(`glossário: "${key}" tem duas traduções (${name})`);
  }
  map.set(key, pt);
}
for (const name of (await readdir(glossDir)).filter((n) => n.endsWith(".json")).sort()) {
  const data = await readJson(path.join(glossDir, name));
  for (const [en, pt] of Object.entries(data)) {
    if (en.startsWith("_")) continue; // comentário
    if (pt && typeof pt === "object") {
      const map = porArquivo.get(en) ?? new Map();
      for (const [en2, pt2] of Object.entries(pt)) addEntry(map, en2, pt2, name);
      porArquivo.set(en, map);
    } else {
      addEntry(glossario, en, pt, name);
    }
  }
}

const ignorar = new Set((await readJson(path.join(here, "ignorar.json"))).map(collapse));
const escopo = await readJson(path.join(here, "escopo.json"));
const { default: trocas } = await import(pathToFileURL(path.join(here, "trocas.mjs")).href);

// ---------------------------------------------------------------- utilidades

function collapse(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Espaços no trecho casam com qualquer sequência de espaços/quebras. */
function toPattern(text) {
  return new RegExp(
    text
      .split(/(\s+)/)
      .map((part) => (/^\s+$/.test(part) ? "\\s+" : escapeRegExp(part)))
      .join(""),
    "g",
  );
}


const CSS_WORDS = new Set(("flex grid block hidden inline relative absolute fixed sticky truncate italic " +
  "underline uppercase lowercase capitalize border rounded shadow container antialiased contents table " +
  "transition grow shrink static invisible visible outline ring resize select-none prose group peer " +
  "notice btn card shell").split(" "));

/** "flex items-center gap-2" e afins. */
function isCssClasses(text) {
  const tokens = text.split(/\s+/);
  if (!tokens.every((t) => /^[!a-z0-9:[\]/.()%#,_-]+$/.test(t))) return false;
  const techy = tokens.filter((t) => /[-:[\]/]/.test(t) || CSS_WORDS.has(t)).length;
  return techy === tokens.length || (techy >= tokens.length / 2 && tokens.length > 1 && !tokens.some((t) => /^(the|a|an|to|of|and|or|is|in|on|for|with|by|from|your|you)$/.test(t)));
}

/** Parece texto para pessoas (e não um identificador, classe CSS ou caminho)? */
function looksHuman(raw) {
  if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\s/i.test(raw.trim())) return false; // SQL
  const text = raw.replace(/\$\{[^}]*\}/g, "").replace(/<[^>]*>?/g, " ").replace(/^[^<]*>/, " ").trim();
  if (/[áàâãéêíóôõúç]/i.test(text)) return false; // já está em português (trocas.mjs)
  if (!/[A-Za-z]{2,}/.test(text)) return false;
  if (/\(--|\b(bg|text|border|rounded|ring|shadow|fill|stroke)-\[|\bhover:|\bfocus(-within|-visible)?:|\bsm:|\bmd:|\blg:/.test(text)) return false; // Tailwind
  if (/^[a-z0-9_.:/#@?=&%+-]+$/.test(text)) return false; // id, rota, kebab
  if (isCssClasses(text)) return false;
  if (/^(https?:|mailto:|\/|\.\/|data:|application\/|image\/|text\/)/.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false; // CONSTANTE
  if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\s/i.test(text)) return false; // SQL
  if (/^\[[a-z:-]+\]/.test(text)) return false; // prefixo de log
  if (/^[A-Z][A-Za-z]+Error$/.test(text)) return false; // nome de classe de erro
  if (/^use (client|server)$/.test(text)) return false; // diretiva
  if (/^[a-z]+[A-Z][A-Za-z0-9]*$/.test(text)) return false; // camelCase
  return /[A-Z]/.test(text[0]) || /\s/.test(text);
}

const SKIP_ATTRS = new Set([
  "className", "href", "id", "key", "type", "name", "variant", "size", "role",
  "method", "action", "autoComplete", "inputMode", "src", "target", "rel",
  "htmlFor", "form", "value", "defaultValue", "accept", "pattern", "lang",
  "dir", "align", "side", "orientation", "as", "mode", "encType", "sizes",
  "tone", "status", "icon", "fill", "stroke", "viewBox", "d", "xmlns",
  "strokeWidth", "strokeLinecap", "strokeLinejoin", "fillRule", "clipRule",
  "spellCheck", "enterKeyHint", "capture", "referrerPolicy", "sandbox", "allow",
  "loading", "decoding", "crossOrigin", "media", "charSet", "httpEquiv",
]);

const COMPARE = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.InKeyword,
]);

const CLASS_CALLS = /^(cn|clsx|cva|twMerge|classNames)$/;

/** Algum ancestor faz deste literal um valor técnico (classe, estilo)? */
function hasCodeAncestor(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isJsxAttribute(p)) {
      const attr = p.name.getText();
      return attr === "className" || attr === "style" || attr.endsWith("ClassName");
    }
    if (ts.isCallExpression(p) && CLASS_CALLS.test(p.expression.getText())) return true;
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isBlock(p) || ts.isSourceFile(p)) return false;
  }
  return false;
}

/** Este literal é usado como valor de código (e não como texto de tela)? */
function isCodePosition(node) {
  if (hasCodeAncestor(node)) return true;
  const parent = node.parent;
  if (!parent) return true;
  switch (parent.kind) {
    case ts.SyntaxKind.ImportDeclaration:
    case ts.SyntaxKind.ExportDeclaration:
    case ts.SyntaxKind.ExternalModuleReference:
    case ts.SyntaxKind.LiteralType:
    case ts.SyntaxKind.CaseClause:
    case ts.SyntaxKind.ElementAccessExpression:
    case ts.SyntaxKind.ImportType:
      return true;
    case ts.SyntaxKind.PropertyAssignment:
    case ts.SyntaxKind.PropertySignature:
    case ts.SyntaxKind.PropertyDeclaration:
    case ts.SyntaxKind.MethodDeclaration:
    case ts.SyntaxKind.EnumMember:
      return parent.name === node;
    case ts.SyntaxKind.BinaryExpression:
      return COMPARE.has(parent.operatorToken.kind);
    case ts.SyntaxKind.JsxAttribute: {
      const attr = parent.name.getText();
      return SKIP_ATTRS.has(attr) || attr.startsWith("data-");
    }
    case ts.SyntaxKind.CallExpression: {
      const callee = parent.expression.getText();
      return /^(console\.|require$|import$|.*\.(get|set|has|delete|append|getAll|startsWith|endsWith|includes|split|replace|replaceAll|indexOf|querySelector|querySelectorAll|getElementById|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|headers\.set|cookies\.(get|set)|test|match|matchAll|localeCompare|padStart|padEnd)$)/.test(callee);
    }
    default:
      return false;
  }
}

function quoteLiteral(text, quote, where) {
  if (quote === "`") {
    return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "`";
  }
  return quote + text.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), "\\" + quote).replace(/\n/g, "\\n") + quote;
}

/** Textos candidatos de um arquivo: { start, end, key, render(pt) }. */
function candidates(file, source) {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const out = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const raw = source.slice(node.pos, node.end);
      const core = raw.trim();
      if (core && /[A-Za-z]/.test(core)) {
        const start = node.pos + raw.indexOf(core);
        out.push({
          start,
          end: start + core.length,
          key: collapse(core),
          jsxAttr: false,
          render: (pt) => pt,
        });
      }
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isCodePosition(node)) {
        const quote = source[node.getStart(sf)];
        const inJsxAttr = node.parent && ts.isJsxAttribute(node.parent);
        const lead = node.text.match(/^\s*/)[0];
        const trail = node.text.match(/\s*$/)[0];
        out.push({
          start: node.getStart(sf),
          end: node.end,
          key: collapse(node.text),
          jsxAttr: inJsxAttr,
          render: (ptRaw, where) => {
            const pt = node.text.trim() ? lead + ptRaw.trim() + trail : ptRaw;
            if (inJsxAttr) {
              if (pt.includes(quote)) erros.push(`${where}: tradução tem ${quote} num atributo JSX`);
              return quote + pt + quote;
            }
            return quoteLiteral(pt, quote, where);
          },
        });
      }
    } else if (ts.isTemplateExpression(node)) {
      if (!isCodePosition(node)) {
        // Chave: o texto do template com cada ${...} normalizado. As
        // expressões guardam a posição original, para a troca reaproveitar
        // o código delas (já traduzido por dentro, se for o caso).
        const exprs = node.templateSpans.map((span) => ({
          key: collapse(span.expression.getText(sf)),
          start: span.expression.getStart(sf),
          end: span.expression.end,
        }));
        const key = collapse(
          node.head.rawText +
            node.templateSpans
              .map((span, i) => "${" + exprs[i].key + "}" + span.literal.rawText)
              .join(""),
        );
        out.push({
          start: node.getStart(sf),
          end: node.end,
          key,
          template: true,
          exprs,
          lead: node.head.rawText.match(/^\s*/)[0],
          trail: (node.templateSpans.at(-1)?.literal.rawText ?? "").match(/\s*$/)[0],
        });
      }
      // Os pedaços de dentro de ${...} podem ter textos também.
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}

// ---------------------------------------------------------------- escopo

async function listFiles() {
  const files = new Set();
  async function walk(rel) {
    const full = path.join(root, rel);
    let info;
    try {
      info = await stat(full);
    } catch {
      erros.push(`escopo: ${rel} não existe mais`);
      return;
    }
    if (info.isDirectory()) {
      for (const name of await readdir(full)) await walk(path.posix.join(rel, name));
    } else if (/\.(tsx?|mjs)$/.test(rel) && !/\.(test|dbtest)\.ts$/.test(rel) && !/test-support/.test(rel)) {
      files.add(rel);
    }
  }
  for (const rel of escopo) await walk(rel);
  for (const rel of Object.keys(trocas)) files.add(rel);
  return [...files].sort();
}

// ---------------------------------------------------------------- proteção

/**
 * Textos que o código compara em algum lugar de src/ (=== "...", case "...",
 * .includes("...")): traduzir o lugar que cria o texto quebraria a
 * comparação. Se algum estiver no glossário, o build para.
 */
async function comparedTexts() {
  const found = new Map();
  async function walk(rel) {
    for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (/\.tsx?$/.test(child) && !/\.(test|dbtest)\.ts$/.test(child)) {
        const source = await readFile(path.join(root, child), "utf8");
        const sf = ts.createSourceFile(child, source, ts.ScriptTarget.Latest, true,
          child.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        (function visit(node) {
          if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
            const p = node.parent;
            const compared =
              (ts.isBinaryExpression(p) && COMPARE.has(p.operatorToken.kind)) ||
              ts.isCaseClause(p) ||
              (ts.isCallExpression(p) && /\.(includes|startsWith|endsWith|indexOf|has)$/.test(p.expression.getText()));
            if (compared && looksHuman(collapse(node.text))) {
              const list = found.get(collapse(node.text)) ?? [];
              list.push({ file: child, line: source.slice(0, node.pos).split("\n").length });
              found.set(collapse(node.text), list);
            }
          }
          ts.forEachChild(node, visit);
        })(sf);
      }
    }
  }
  await walk("src");
  return found;
}

for (const [key, places] of await comparedTexts()) {
  const where = places.map((p) => `${p.file}:${p.line}`).join(", ");
  if (glossario.has(key)) {
    erros.push(`glossário: "${key}" é comparado no código (${where}); não pode ser traduzido (use uma entrada por arquivo, se for seguro)`);
  }
  for (const p of places) {
    if (porArquivo.get(p.file)?.has(key)) {
      erros.push(`glossário de ${p.file}: "${key}" é comparado nesse mesmo arquivo (linha ${p.line})`);
    }
  }
}

// ---------------------------------------------------------------- execução

const files = await listFiles();
const usadas = new Set();
const faltando = new Map(); // key -> [arquivo:linha]
let arquivos = 0;
let total = 0;

for (const file of files) {
  const full = path.join(root, file);
  let source;
  try {
    source = await readFile(full, "utf8");
  } catch {
    erros.push(`${file}: arquivo não existe mais`);
    continue;
  }
  const original = source;

  // 1. trocas exatas
  const textosDasTrocas = [];
  for (const [index, entry] of (trocas[file] ?? []).entries()) {
    const [de, para, vezes = 1] = Array.isArray(entry) ? entry : [entry.de, entry.para, entry.vezes];
    const pattern = toPattern(de);
    const found = source.match(pattern)?.length ?? 0;
    if (found !== vezes) {
      erros.push(`${file}: troca #${index + 1} achada ${found}× (esperado ${vezes}): ${JSON.stringify(de).slice(0, 100)}`);
      continue;
    }
    source = source.replace(pattern, () => para);
    textosDasTrocas.push(para);
    total += found;
  }

  // 2. glossário
  if (escopo.some((rel) => file === rel || file.startsWith(rel.replace(/\/?$/, "/")))) {
    const edits = [];
    const local = porArquivo.get(file) ?? new Map();
    for (const c of candidates(file, source)) {
      const line = source.slice(0, c.start).split("\n").length;
      const where = `${file}:${line}`;
      if (local.has(c.key) || glossario.has(c.key)) {
        const pt = local.has(c.key) ? local.get(c.key) : glossario.get(c.key);
        if (c.template) {
          usadas.add(local.has(c.key) ? `${file}::${c.key}` : c.key);
          edits.push({ ...c, pt });
          continue;
        }
        usadas.add(local.has(c.key) ? `${file}::${c.key}` : c.key);
        edits.push({ ...c, text: c.render(pt, where) });
      } else if (
        looksHuman(c.key) &&
        !ignorar.has(c.key) &&
        !textosDasTrocas.some((t) => t.includes(source.slice(c.start, c.end)))
      ) {
        const list = faltando.get(c.key) ?? [];
        list.push(where);
        faltando.set(c.key, list);
      }
    }
    // Do fim para o começo; um template é trocado depois dos textos que
    // estão dentro das expressões dele, e reaproveita o código já trocado.
    edits.sort((a, b) => b.start - a.start || a.end - b.end);
    const applied = []; // { start, end, delta } em posições originais
    const shift = (pos, from) =>
      pos + applied.filter((a) => a.start >= from && a.end <= pos).reduce((n, a) => n + a.delta, 0);
    for (const e of edits) {
      const overlapping = applied.filter((a) => a.start < e.end && a.end > e.start);
      if (overlapping.some((a) => a.start < e.start || a.end > e.end)) {
        erros.push(`${file}: traduções sobrepostas em "${e.key.slice(0, 60)}"`);
        continue;
      }
      let text = e.text;
      if (e.template) {
        const marks = [];
        let body = e.lead + e.pt.trim() + e.trail;
        [...e.exprs]
          .sort((a, b) => b.key.length - a.key.length)
          .forEach((x) => {
            const mark = `\u0000${marks.length}\u0000`;
            const current = source.slice(shift(x.start, e.start), shift(x.end, e.start));
            body = body.split("${" + x.key + "}").join(mark);
            marks.push("${" + current + "}");
          });
        if (body.includes("${")) {
          erros.push(`${file}: a tradução de "${e.key.slice(0, 60)}" tem \${...} que não existe no original`);
          continue;
        }
        text = "`" + body.replace(/`/g, "\\`").replace(/\u0000(\d+)\u0000/g, (_, i) => marks[Number(i)]) + "`";
      }
      const newEnd = shift(e.end, e.start);
      source = source.slice(0, e.start) + text + source.slice(newEnd);
      applied.push({ start: e.start, end: e.end, delta: text.length - (newEnd - e.start) });
      total += 1;
    }
  }

  if (source !== original) {
    arquivos += 1;
    if (!check) await writeFile(full, source);
  }
}

if (mostrarFaltando && faltando.size > 0) {
  console.log(`i18n: ${faltando.size} texto(s) sem tradução no escopo:`);
  for (const [key, where] of [...faltando].sort((a, b) => a[1][0].localeCompare(b[1][0]))) {
    console.log(`  ${where[0]}${where.length > 1 ? ` (+${where.length - 1})` : ""}  ${JSON.stringify(key)}`);
  }
}
if (args.includes("--sobras")) {
  const sobras = [
    ...[...glossario.keys()].filter((k) => !usadas.has(k)),
    ...[...porArquivo].flatMap(([f, m]) => [...m.keys()].map((k) => `${f}::${k}`)).filter((k) => !usadas.has(k)),
  ];
  console.log(`i18n: ${sobras.length} entrada(s) do glossário sem uso:`);
  for (const k of sobras) console.log(`  ${JSON.stringify(k)}`);
}
if (estrito && faltando.size > 0) {
  erros.push(`${faltando.size} texto(s) sem tradução (rode com --faltando)`);
}

if (erros.length > 0) {
  console.error(`i18n: ${erros.length} problema(s); o upstream mudou ou o dicionário está errado:`);
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

console.log(
  `i18n: pt-BR ${check ? "conferido" : "aplicado"}: ${total} trocas em ${arquivos} arquivos; ${faltando.size} texto(s) do escopo ainda em inglês.`,
);
