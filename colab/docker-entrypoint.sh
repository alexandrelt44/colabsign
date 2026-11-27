#!/bin/sh
# ColabSign: entrada da imagem.
#   start      aplica as migrations novas (npm run db:migrate) e sobe o app
#   scheduler  agenda a limpeza diária e a fila de webhooks (sem a Vercel)
#   outro      executa o comando dado (ex.: sh)
set -e
cd /app

case "${1:-start}" in
  start)
    node db/migrate.mjs
    exec node node_modules/next/dist/bin/next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
    ;;
  scheduler)
    exec node colab/scheduler.mjs
    ;;
  *)
    exec "$@"
    ;;
esac
