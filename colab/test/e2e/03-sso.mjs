// Login pelo provedor OIDC de teste (Dex, no papel do ColabAuth/WorkOS).
import { ADMIN, SITE, connect, newPage, shot } from "./lib.mjs";

const browser = await connect();
const { page } = await newPage(browser);
const navs = [];
page.on(
  "framenavigated",
  (f) =>
    f === page.mainFrame() &&
    navs.push(f.url().replace(/(code|state)=[^&]+/g, "$1=…")),
);
const callbacks = [];
page.on(
  "request",
  (r) =>
    r.url().includes("/callback") && callbacks.push(new URL(r.url()).pathname),
);
await page.goto(`${SITE}/login`);
await page.waitForLoadState("networkidle");
await shot(page, "03-login-com-sso", false);
await page
  .getByRole("button", { name: /ColabAuth/ })
  .first()
  .click();
await page.waitForURL(/127\.0\.0\.1:5556/, { timeout: 20000 });
await page.waitForLoadState("networkidle");
await shot(page, "03-dex-login", false);
await page.fill('input[name="login"]', ADMIN.email);
await page.fill('input[name="password"]', "colabsign-teste");
await Promise.all([
  page.waitForURL(
    (u) => u.host === "127.0.0.1:3000" && !u.pathname.startsWith("/login"),
    { timeout: 30000 },
  ),
  page.locator('button[type="submit"]').click(),
]);
await page.waitForLoadState("networkidle");
console.log("retorno OIDC:", [...new Set(callbacks)].join(", "));
console.log("caminho:", navs.join("\n  -> "));
const session = await page.request.get(`${SITE}/api/auth/get-session`);
const body = await session.json();
console.log(
  "sessao:",
  JSON.stringify({
    email: body?.user?.email,
    name: body?.user?.name,
    emailVerified: body?.user?.emailVerified,
  }),
);
await shot(page, "03-depois-do-sso", false);
await browser.close();
