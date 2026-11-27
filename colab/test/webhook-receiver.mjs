// Receptor de webhooks de teste: confere a assinatura (Standard Webhooks,
// docs/api.md "Checking the signature") e grava cada entrega numa linha
// JSON, com os cabeçalhos e o corpo, para o relatório.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT || 4000);
const out = process.env.OUT || "/out/webhooks.jsonl";
const secretFile = process.env.SECRET_FILE || "/out/whsec";

function verify(headers, rawBody) {
  if (!existsSync(secretFile)) return "sem-segredo";
  const secret = readFileSync(secretFile, "utf8").trim();
  const id = headers["webhook-id"];
  const timestamp = headers["webhook-timestamp"];
  const signatures = headers["webhook-signature"];
  if (!id || !timestamp || !signatures) return "sem-cabecalhos";
  if (!(Math.abs(Date.now() / 1000 - Number(timestamp)) <= 300)) {
    return "fora-do-prazo";
  }
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = Buffer.from(
    `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64")}`,
  );
  const ok = signatures.split(" ").some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return ok ? "valida" : "invalida";
}

createServer((request, response) => {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const signature = verify(request.headers, rawBody);
    let body = null;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null; // corpo que não é JSON fica só registrado
    }
    appendFileSync(
      out,
      `${JSON.stringify({
        receivedAt: new Date().toISOString(),
        method: request.method,
        path: request.url,
        signature,
        headers: {
          "content-type": request.headers["content-type"],
          "user-agent": request.headers["user-agent"],
          "webhook-id": request.headers["webhook-id"],
          "webhook-timestamp": request.headers["webhook-timestamp"],
          "webhook-signature": request.headers["webhook-signature"]
            ? "v1,<omitida>"
            : undefined,
        },
        body,
      })}\n`,
    );
    console.log(`[receptor] ${body?.type ?? "?"} assinatura=${signature}`);
    response.writeHead(signature === "invalida" ? 401 : 200, {
      "content-type": "application/json",
    });
    response.end('{"ok":true}');
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`[receptor] ouvindo na porta ${port}`);
});
