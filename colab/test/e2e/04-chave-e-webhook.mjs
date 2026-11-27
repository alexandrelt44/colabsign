// Settings › Organization: cria a chave de API (Read and write) e o endpoint
// de webhook apontando para o receptor de teste. Os segredos mostrados uma
// vez vão direto para arquivos 600, sem passar pelo log.
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { SITE, connect, newPage, shot, signInWithPassword } from "./lib.mjs";

const SECRETS = `${process.env.TESTE_DIR || "/root/colabsign-test"}/secrets`;
const WHSEC = `${process.env.TESTE_DIR || "/root/colabsign-test"}/src/colab/test/out/whsec`;
mkdirSync(SECRETS, { recursive: true, mode: 0o700 });

function keep(path, value) {
  writeFileSync(path, value.trim(), { mode: 0o600 });
  chmodSync(path, 0o600);
}

const browser = await connect();
const { page } = await newPage(browser);
await signInWithPassword(page);
await page.goto(`${SITE}/settings`);
await page.waitForLoadState("networkidle");

// Chave de API
await page.fill('[name="api-key-name"]', "Backoffice (teste)");
await page.selectOption('[name="api-key-scope"]', "write");
await page.selectOption('[name="api-key-expiry"]', "30");
await page.locator("button", { hasText: "Create key" }).click();
const keyBox = page.locator('[data-testid="new-api-key"] code');
await keyBox.waitFor({ timeout: 15000 });
keep(`${SECRETS}/api-key`, await keyBox.innerText());
console.log("[chave] criada e guardada (600)");
await keyBox.evaluate(
  (el) => (el.textContent = "sdk_•••••••••••• (omitida na captura)"),
);
await page
  .locator('[data-testid="new-api-key"]')
  .screenshot({ path: `${process.env.TESTE_DIR || "/root/colabsign-test"}/out/04-chave-criada.png` });
await page
  .locator('[data-testid="new-api-key"] button', { hasText: "Done" })
  .click()
  .catch(() => {});

// Webhook
await page.fill('[name="webhook-url"]', "http://127.0.0.1:4000/colabsign");
await page.fill(
  '[name="webhook-description"]',
  "Receptor de teste (vps-wp-old)",
);
for (const box of await page.locator('input[name^="webhook-event-"]').all()) {
  if (!(await box.isChecked())) await box.check();
}
await page.locator("button", { hasText: "Add endpoint" }).click();
const secretBox = page.locator('[data-testid="new-webhook-secret"] code');
await secretBox.waitFor({ timeout: 15000 });
keep(WHSEC, await secretBox.innerText());
console.log("[webhook] criado; segredo guardado para o receptor (600)");
await secretBox.evaluate(
  (el) => (el.textContent = "whsec_•••••••••••• (omitido na captura)"),
);
await page
  .locator('[data-testid="new-webhook-secret"] button', { hasText: "Done" })
  .click()
  .catch(() => {});
await page.waitForTimeout(1000);

// "Send test" manda um webhook.test na hora.
const sendTest = page.locator("button", { hasText: "Send test" }).first();
if (await sendTest.count()) {
  await sendTest.click();
  await page.waitForTimeout(3000);
}
const panel = page
  .locator("section, div")
  .filter({ has: page.locator('ul[aria-label="Webhook endpoints"]') })
  .last();
await panel
  .screenshot({ path: `${process.env.TESTE_DIR || "/root/colabsign-test"}/out/04-webhook-endpoint.png` })
  .catch(async () => shot(page, "04-configuracoes"));
await browser.close();
