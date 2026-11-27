// Capturas dos e-mails capturados (driver de captura): o convite e a cópia
// final, renderizados como o leitor de e-mail mostraria, em 1440 e 390.
import { connect, newPage, outbox, shot } from "./lib.mjs";

const wanted = [
  ["convite", "signing_invitation"],
  ["concluido", "completion_notification"],
];
const browser = await connect();
for (const [name, template] of wanted) {
  const mail = outbox()
    .filter((m) => m.template === template)
    .at(-1);
  if (!mail) {
    console.log(`[email] sem ${template}`);
    continue;
  }
  console.log(`[email] ${template}: "${mail.subject}" de ${mail.from}`);
  for (const width of [1440, 390]) {
    const { page, context } = await newPage(browser, width, 900);
    await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#F4F2EE;font-family:Arial,Helvetica,sans-serif;color:#1C1A17}
.head{background:#fff;border-bottom:1px solid #E2DED6;padding:16px 20px;font-size:14px;line-height:1.6}
.head b{display:inline-block;min-width:64px;color:#5E5A52;font-weight:normal}
.mail{background:#fff;max-width:640px;margin:20px auto;padding:24px;font-size:15px;line-height:1.55;border-radius:8px}
</style></head><body>
<div class="head"><div><b>De:</b> ${mail.from.replace(/</g, "&lt;")}</div><div><b>Para:</b> ${mail.to.join(", ")}</div><div><b>Assunto:</b> ${mail.subject}</div>${
      mail.attachments?.length
        ? `<div><b>Anexos:</b> ${mail.attachments.map((a) => a.filename).join(", ")}</div>`
        : ""
    }</div>
<div class="mail">${mail.html}</div></body></html>`);
    await shot(page, `12-email-${name}-${width}`);
    await context.close();
  }
}
await browser.close();
