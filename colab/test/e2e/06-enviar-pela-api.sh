#!/bin/bash
# Envia o PDF de teste pela API (/api/v1/envelopes) para dois signatários
# fictícios, em ordem. A chave fica em arquivo 600 e vai por -H @arquivo,
# então não aparece na linha de comando nem no log.
set -euo pipefail
OUT=${TESTE_DIR:-/root/colabsign-test}/out
H=$(mktemp); chmod 600 "$H"; trap 'rm -f "$H"' EXIT
printf 'Authorization: Bearer %s\n' "$(cat ${TESTE_DIR:-/root/colabsign-test}/secrets/api-key)" > "$H"
API=http://127.0.0.1:3000/api/v1

echo "== GET /me"; curl -s "$API/me" -H @"$H" | tee "$OUT/api-me.json"; echo

DATA='{
  "title": "Contrato de teste ColabSign",
  "signers": [
    { "ref": "contratante", "name": "Bruno Fictício", "email": "bruno.ficticio@example.com" },
    { "ref": "contratada", "name": "Carla Fictícia", "email": "carla.ficticia@example.com" }
  ],
  "fields": [
    { "signer": "contratante", "type": "signature", "page": 1, "x": 0.08, "y": 0.62, "width": 0.36, "height": 0.06 },
    { "signer": "contratante", "type": "date", "page": 1, "x": 0.08, "y": 0.69, "width": 0.2, "height": 0.025 },
    { "signer": "contratada", "type": "signature", "page": 1, "x": 0.55, "y": 0.62, "width": 0.36, "height": 0.06 },
    { "signer": "contratada", "type": "date", "page": 1, "x": 0.55, "y": 0.69, "width": 0.2, "height": 0.025 }
  ],
  "metadata": { "origem": "teste-t1", "proposta": "PR-0001" },
  "send": { "expiresInDays": 14, "permittedUseConfirmed": true }
}'
echo "== POST /envelopes"
curl -s "$API/envelopes" -H @"$H" -H "Idempotency-Key: teste-t1-$(date +%s)" \
  -F "file=@$OUT/contrato-teste.pdf;type=application/pdf" --form-string "data=$DATA" \
  | tee "$OUT/api-envelope-criado.json"; echo
