// Primeiro acesso: /setup cria a organização "ColabSign" e a administradora.
import { ADMIN, SITE, connect, newPage, saveState, shot } from "./lib.mjs";

const browser = await connect();
const { page } = await newPage(browser);
await page.goto(SITE);
await page.waitForLoadState("networkidle");
console.log("url", page.url());
await shot(page, "01-setup-vazio");
await page.fill('[name="setup-organization-name"]', "ColabSign");
const support = page.locator('[name="setup-support-address"]');
if (await support.count()) await support.fill("suporte@example.com");
await page.fill('[name="setup-full-name"]', ADMIN.name);
await page.fill('[name="setup-email"]', ADMIN.email);
await page.fill('[name="setup-password"]', ADMIN.password);
await shot(page, "01-setup-preenchido");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(6000);
console.log("depois", page.url());
console.log((await page.locator("body").innerText()).slice(0, 800));
await shot(page, "01-setup-depois");
saveState({ setupDone: true });
await browser.close();
