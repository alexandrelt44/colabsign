// Assina pelo link capturado no e-mail: node 08-assinar.mjs <email> <ref>
// Capturas em 1440 e 390 (a 390 só olha; quem assina é a de 1440, ou a de
// 390 quando ASSINAR_EM=390).
import { connect, newPage, shot } from "./lib.mjs";
import { signingLinkFor } from "./lib-sign.mjs";

const [email, ref] = process.argv.slice(2);
const signAt = Number(process.env.ASSINAR_EM || 1440);
const link = signingLinkFor(email);
const browser = await connect();

async function consent(page) {
  const agree = page.locator("button", { hasText: /Agree and continue|Concordar e continuar/ });
  if (!(await agree.count())) return;
  for (const b of await page.locator('[role="dialog"] [role="checkbox"]').all())
    await b.click();
  await page.locator("button", { hasText: /Agree and continue|Concordar e continuar/ }).click();
  await page.waitForTimeout(1200);
}

for (const width of [1440, 390]) {
  const { page, context } = await newPage(
    browser,
    width,
    width === 390 ? 844 : 900,
    width === 390
      ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : {},
  );
  await page.goto(link);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await shot(page, `08-${ref}-${width}-consentimento`, false);
  await consent(page);
  await shot(page, `08-${ref}-${width}-documento`, false);
  if (width === signAt) {
    await page
      .locator("button", { hasText: /^(Sign|Assinar)$/ })
      .first()
      .click();
    await page.locator("button", { hasText: /Apply signature|Usar assinatura/ }).click();
    await page.waitForTimeout(1200);
    await shot(page, `08-${ref}-${width}-assinado-antes-de-concluir`, false);
    await page
      .locator("button", { hasText: /^(Finish|Concluir)$/ })
      .first()
      .click();
    await page.waitForTimeout(2000);
    const confirm = page.locator('[role="dialog"] button', {
      hasText: /Finish|Sign|Confirm|Submit|Concluir|Assinar/,
    });
    if (await confirm.count()) {
      console.log("confirmação:", await confirm.allInnerTexts());
      await confirm.last().click();
    }
    await page.waitForTimeout(5000);
    await shot(page, `08-${ref}-${width}-concluido`, false);
    console.log(
      `[${ref}] depois de concluir:`,
      (await page.locator("body").innerText())
        .slice(0, 400)
        .replace(/\n+/g, " | "),
    );
  }
  await context.close();
}
await browser.close();
