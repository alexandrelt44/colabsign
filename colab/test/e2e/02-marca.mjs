// Marca pelas configurações do próprio app (Settings › Organization):
// logo do ColabOS com o nome ColabSign e a cor de ação do ColabOS (#BE185D).
import { copyFileSync } from "node:fs";
import {
  OUT,
  SITE,
  connect,
  newPage,
  shot,
  signInWithPassword,
} from "./lib.mjs";

const COLOR = "#BE185D";
const browser = await connect();

// 1) O logo: a marca do ColabOS (quadrado rosa com a grade 2x2) + "ColabSign".
{
  const { page } = await newPage(browser, 900, 300, { deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@700&display=swap" rel="stylesheet">
<style>body{margin:0;background:transparent}#logo{display:inline-flex;align-items:center;gap:12px;padding:4px}
.mark{width:40px;height:40px;border-radius:11px;background:#EC4899;display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:9px;box-sizing:border-box}
.mark span{background:#fff;border-radius:3px}.mark span.f{opacity:.6}
.name{font-family:Outfit,sans-serif;font-weight:700;font-size:27px;letter-spacing:-.3px;color:#1C1A17}</style></head>
<body><div id="logo"><div class="mark"><span></span><span class="f"></span><span class="f"></span><span></span></div><span class="name">ColabSign</span></div></body></html>`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator("#logo")
    .screenshot({ path: `${OUT}/colabsign-logo.png`, omitBackground: true });
  console.log("[logo] gerado");
  await page.context().close();
}

// 2) Configurações da organização.
const { page } = await newPage(browser);
await signInWithPassword(page);
await page.goto(`${SITE}/settings`);
await page.waitForLoadState("networkidle");
await page.setInputFiles(
  'input[aria-label="Logo image"]',
  `${OUT}/colabsign-logo.png`,
);
await page.waitForTimeout(4000);
await page.fill('[name="brand-color"]', COLOR);
await page.locator("button", { hasText: "Save organization settings" }).click();
await page.waitForTimeout(4000);
const feedback = await page
  .locator('[role="status"], [role="alert"]')
  .allInnerTexts();
console.log("feedback", feedback.filter(Boolean).slice(0, 5));
await page.reload();
await page.waitForLoadState("networkidle");
await shot(page, "02-configuracoes-organizacao");
await page.goto(`${SITE}/dashboard`);
await page.waitForLoadState("networkidle");
await shot(page, "02-painel-com-marca", false);
await browser.close();
