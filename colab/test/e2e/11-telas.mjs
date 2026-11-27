// Capturas do painel: lista, envelope concluído e a tela de envio (revisão)
// de um rascunho criado pela API, em 1440 e 390.
import { readFileSync } from "node:fs";
import {
  OUT,
  SITE,
  connect,
  newPage,
  shot,
  signInWithPassword,
} from "./lib.mjs";

const key = readFileSync(`${process.env.TESTE_DIR || "/root/colabsign-test"}/secrets/api-key`, "utf8").trim();
const done = JSON.parse(
  readFileSync(`${OUT}/api-envelope-criado.json`, "utf8"),
);
const form = new FormData();
form.append(
  "file",
  new Blob([readFileSync(`${OUT}/contrato-teste.pdf`)], {
    type: "application/pdf",
  }),
  "contrato-teste.pdf",
);
form.append(
  "data",
  JSON.stringify({
    title: "Contrato de teste ColabSign (rascunho)",
    signers: [
      {
        ref: "contratante",
        name: "Bruno Fictício",
        email: "bruno.ficticio@example.com",
      },
      {
        ref: "contratada",
        name: "Carla Fictícia",
        email: "carla.ficticia@example.com",
      },
    ],
    fields: [
      {
        signer: "contratante",
        type: "signature",
        page: 1,
        x: 0.08,
        y: 0.62,
        width: 0.36,
        height: 0.06,
      },
      {
        signer: "contratante",
        type: "date",
        page: 1,
        x: 0.08,
        y: 0.69,
        width: 0.2,
        height: 0.025,
      },
      {
        signer: "contratada",
        type: "signature",
        page: 1,
        x: 0.55,
        y: 0.62,
        width: 0.36,
        height: 0.06,
      },
      {
        signer: "contratada",
        type: "date",
        page: 1,
        x: 0.55,
        y: 0.69,
        width: 0.2,
        height: 0.025,
      },
    ],
  }),
);
const draft = await (
  await fetch(`${SITE}/api/v1/envelopes`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  })
).json();
console.log("rascunho", draft.id, draft.status);

const browser = await connect();
for (const width of [1440, 390]) {
  const mobile =
    width === 390
      ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
      : {};
  const { page, context } = await newPage(
    browser,
    width,
    width === 390 ? 844 : 900,
    mobile,
  );
  await signInWithPassword(page);
  for (const [name, path] of [
    ["envio-revisao", `/envelopes/${draft.id}/review`],
    ["envelope-concluido", `/envelopes/${done.id}`],
    ["painel", "/dashboard"],
  ]) {
    await page.goto(`${SITE}${path}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);
    await shot(page, `11-${name}-${width}`, width === 1440);
  }
  await context.close();
}
await browser.close();
