// Apoio dos roteiros de teste (vps-wp-old): navegador do Playwright em
// ws://127.0.0.1:3200 (contêiner na rede do host), app em 127.0.0.1:3000.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

export const SITE = process.env.SITE || "http://127.0.0.1:3000";
export const OUT = process.env.OUT || "/root/colabsign-test/out";
export const OUTBOX = process.env.OUTBOX || "/root/colabsign-test/outbox";
export const STATE = `${OUT}/state.json`;
mkdirSync(OUT, { recursive: true });

export const ADMIN = {
  email: "ana.ficticia@example.com",
  name: "Ana Fictícia",
  password: "Teste-ColabSign-2026-local",
};

export function loadState() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return {};
  }
}

export function saveState(patch) {
  const next = { ...loadState(), ...patch };
  writeFileSync(STATE, JSON.stringify(next, null, 2));
  return next;
}

export async function connect() {
  return chromium.connect("ws://127.0.0.1:3200/");
}

export async function newPage(browser, width = 1440, height = 900, opts = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    ...opts,
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`[pageerror] ${e.message}`));
  return { context, page };
}

export async function shot(page, name, fullPage = true) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage });
  console.log(`[shot] ${path}`);
}

/** Mensagens capturadas pelo driver de captura, mais novas por último. */
export function outbox() {
  return readdirSync(OUTBOX)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({
      file: f,
      ...JSON.parse(readFileSync(`${OUTBOX}/${f}`, "utf8")),
    }));
}

export function linksIn(text) {
  return [...String(text).matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]);
}

export async function signInWithPassword(page) {
  await page.goto(`${SITE}/login`);
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), {
      timeout: 30000,
    }),
    page.locator('button[type="submit"]').first().click(),
  ]);
}
