// ColabSign: o agendador que a Vercel faz pelo vercel.json ("crons"), para
// rodar fora dela. Chama as rotas internas do app com o segredo do job:
//
//   /api/internal/retention  uma vez por dia (limpeza diária, lembretes,
//                            avisos de prazo vencido; docs/self-hosting.md)
//   /api/internal/webhooks   a cada poucos minutos (novas tentativas de
//                            webhooks que falharam; docs/api.md)
//
// O backup diário do upstream (/api/internal/backup) só funciona com Vercel
// Blob; aqui o backup é do volume e do Postgres (ver COLABSIGN.md).
//
// Variáveis:
//   SCHEDULER_TARGET_URL    onde o app responde (padrão http://app:3000)
//   RETENTION_JOB_SECRET    o mesmo segredo dado ao app (obrigatório)
//   RETENTION_AT_UTC        hora da limpeza, HH:MM em UTC (padrão 09:00)
//   WEBHOOKS_EVERY_MINUTES  intervalo da fila de webhooks (padrão 5)

const target = (process.env.SCHEDULER_TARGET_URL || "http://app:3000").replace(
  /\/+$/,
  "",
);
const secret = process.env.RETENTION_JOB_SECRET?.trim();
const retentionAt = process.env.RETENTION_AT_UTC || "09:00";
const webhooksEvery = Math.max(
  1,
  Number(process.env.WEBHOOKS_EVERY_MINUTES || 5),
);

if (!secret) {
  console.error(
    "[scheduler] RETENTION_JOB_SECRET não definido: sem ele as rotas internas ficam abertas e não devolvem resumo. Defina o mesmo valor no app e aqui.",
  );
  process.exit(1);
}

const match = /^(\d{1,2}):(\d{2})$/.exec(retentionAt);
if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
  console.error(`[scheduler] RETENTION_AT_UTC inválido: "${retentionAt}"`);
  process.exit(1);
}
const [hour, minute] = [Number(match[1]), Number(match[2])];

async function call(path) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${target}${path}`, {
      headers: { authorization: `Bearer ${secret}` },
      method: "POST",
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    const body = await response.text();
    console.log(
      JSON.stringify({
        at: new Date().toISOString(),
        ms: Date.now() - startedAt,
        path,
        status: response.status,
        summary: body.slice(0, 500),
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        at: new Date().toISOString(),
        error: String(error?.message ?? error),
        path,
      }),
    );
  }
}

function msUntilNextRetention(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function scheduleRetention() {
  const wait = msUntilNextRetention();
  console.log(
    `[scheduler] próxima limpeza diária em ${new Date(Date.now() + wait).toISOString()}`,
  );
  setTimeout(async () => {
    await call("/api/internal/retention");
    scheduleRetention();
  }, wait);
}

let webhooksRunning = false;
async function drainWebhooks() {
  if (webhooksRunning) return;
  webhooksRunning = true;
  try {
    await call("/api/internal/webhooks");
  } finally {
    webhooksRunning = false;
  }
}

console.log(
  `[scheduler] alvo ${target}; limpeza às ${retentionAt} UTC; webhooks a cada ${webhooksEvery} min`,
);
scheduleRetention();
setInterval(drainWebhooks, webhooksEvery * 60 * 1000);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => process.exit(0));
}
