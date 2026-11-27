#!/bin/bash
# Baixa pela API o PDF assinado e o certificado do envelope do teste, e a
# lista de eventos. A chave vai por -H @arquivo (fora da linha de comando).
set -euo pipefail
OUT=${TESTE_DIR:-/root/colabsign-test}/out
H=$(mktemp); chmod 600 "$H"; trap 'rm -f "$H"' EXIT
printf 'Authorization: Bearer %s\n' "$(cat ${TESTE_DIR:-/root/colabsign-test}/secrets/api-key)" > "$H"
API=http://127.0.0.1:3000/api/v1
ID=$(/opt/node22/bin/node -p 'require(process.argv[1]).id' "$OUT/api-envelope-criado.json")
curl -s "$API/envelopes/$ID" -H @"$H" > "$OUT/api-envelope-final.json"
curl -s "$API/envelopes/$ID/events" -H @"$H" > "$OUT/api-envelope-eventos.json"
for f in signed certificate; do
  curl -s -o "$OUT/$f.pdf" -w "$f: %{http_code} %{content_type} %{size_download} bytes\n" "$API/envelopes/$ID/files/$f" -H @"$H"
done
curl -s "$API/webhook-deliveries?since=2026-11-27T00:00:00Z" -H @"$H" > "$OUT/api-webhook-deliveries.json"
