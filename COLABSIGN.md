# ColabSign

Fork do [SignuDoc](https://github.com/NYLLON-SOFTWARE/signudoc) (MIT) para
rodar nas VPS do Colaboratório, em Docker, fora da Vercel. Criado em
27/11/2026.

Regra do fork: **nada do código do upstream foi alterado.** Tudo o que é
nosso fica em arquivos novos (`colab/`, este arquivo e um workflow), e a
marca (nome, logo, cor) é feita pelas configurações do próprio app. Assim a
atualização do upstream não tem conflito.

## Arquivos do fork

| Arquivo                                    | Para quê                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `COLABSIGN.md`                             | Este guia.                                                                                                 |
| `colab/Dockerfile`                         | Imagem Node 24: `npm ci`, `next build`, só dependências de produção no final.                              |
| `colab/Dockerfile.dockerignore`            | O que fica fora da imagem (BuildKit lê este arquivo para o Dockerfile acima).                              |
| `colab/docker-entrypoint.sh`               | `start` aplica as migrations (`node db/migrate.mjs`) e sobe o Next; `scheduler` roda o agendador.          |
| `colab/scheduler.mjs`                      | Substitui os crons do `vercel.json`: limpeza diária e fila de webhooks.                                    |
| `colab/compose.yml`                        | App + Postgres 17 + agendador, app só em `127.0.0.1`.                                                      |
| `colab/.env.example`                       | Variáveis do compose.                                                                                      |
| `colab/brand/colabsign-logo.png`           | Logo (marca do ColabOS + "ColabSign") para subir em Settings › Organization.                               |
| `colab/docs/webhook-payloads-exemplo.json` | Entregas reais de webhook do teste (para a T6).                                                            |
| `colab/test/*`                             | Teste na vps-wp-old: compose extra (Dex, receptor de webhooks, e-mail capturado) e roteiros do Playwright. |
| `colab/i18n/*`                             | Tradução para português do Brasil, aplicada no build da imagem (seção "Português").                         |
| `.github/workflows/colab-image.yml`        | Constrói a imagem no PR e publica em `ghcr.io/alexandrelt44/colabsign` na main.                            |

## Rodar em Docker

```sh
cp colab/.env.example colab/.env      # preencha; segredos com openssl rand -hex 32
docker compose -f colab/compose.yml --env-file colab/.env up -d --build
```

- **Banco:** Postgres 17 no serviço `db`, volume `db`. O app aplica as
  migrations novas a cada start (`npm run db:migrate`).
- **Arquivos:** PDFs, cópias seladas e certificados em disco, no volume
  `data` (`STORAGE_LOCAL_DIR=/data/storage`).
- **Endereço:** `APP_URL` é o endereço público em HTTPS. O app escuta em
  `127.0.0.1:${APP_PORT}`; o proxy da VPS (Caddy/Nginx) faz o HTTPS e manda
  `X-Forwarded-For`.
- **Segredos:** `BETTER_AUTH_SECRET` (sessões e a chave que cifra a chave do
  selo e os segredos dos webhooks: não pode mudar depois),
  `RETENTION_JOB_SECRET` (fecha `/api/internal/*`), `SETUP_TOKEN` (pedido no
  `/setup` do primeiro acesso), `POSTGRES_PASSWORD`.
- **Agendador** (serviço `scheduler`, mesma imagem): chama
  `/api/internal/retention` uma vez por dia (`RETENTION_AT_UTC`, padrão
  09:00 UTC, como no `vercel.json`) e `/api/internal/webhooks` a cada
  `WEBHOOKS_EVERY_MINUTES` (padrão 5), com o segredo. O backup diário do
  upstream (`/api/internal/backup`) só existe para Vercel Blob, então não é
  chamado: veja Backup.
- **Memória:** o app usou ~125 MB parado; o build pede até ~2,5 GB.

### Backup

Dois itens: o banco e o volume de arquivos. Exemplo diário na VPS:

```sh
docker compose -p colabsign exec -T db pg_dump -U colabsign -Fc colabsign > colabsign-$(date +%F).dump
docker run --rm -v colabsign_data:/data -v "$PWD":/b alpine tar czf /b/colabsign-data-$(date +%F).tgz -C /data storage
```

## Login pelo ColabAuth (WorkOS) via OIDC

O SignuDoc já tem SSO OIDC (`src/lib/auth/sso.ts`); basta configurar.

**No WorkOS de produção: já criado (27/11/2026, T1b).** App OAuth de
primeira parte "ColabSign (produção)" (`connect_app_01M8F6CT2REFDE3YA9K32MW3WK`),
igual ao do ColabTasks, com redirect
`https://sign.colaborato.rio/api/auth/callback/sso` (o comentário em
`sso.ts` fala em `/oauth2/callback/sso`, mas o caminho real é este). As
`SSO_*` prontas para o `.env` estão no Mac em
`~/.config/colabsign/workos-prod.env` (permissão 600). O AuthKit já aceita o
client e o redirect (o início do login responde 302 para a tela do
ColabAuth); o login completo só dá para provar com o DNS no ar.

**No `.env` do ColabSign:**

```sh
SSO_ISSUER=https://<domínio do AuthKit>   # o mesmo issuer do ColabTasks/ColabCRM
SSO_CLIENT_ID=...
SSO_CLIENT_SECRET=...
SSO_NAME=ColabAuth                        # o botão diz "Continue with ColabAuth"
# Depois que funcionar, desligar a senha (menos 1 ou 2 e-mails de emergência):
PASSWORD_SIGN_IN=off
PASSWORD_SIGN_IN_ALLOWED_EMAILS=<e-mail do admin>
```

Como funciona: quem entra pela primeira vez ganha conta conforme a regra de
cadastro (Settings › Organization › Who can create an account). **Só
membros:** o SignuDoc não tem convite de usuários, então a regra é
"domínios" com `colaborato.rio` e `desenro.la` (quem tem conta no WorkOS
de produção e e-mail desses domínios). Quem já tem conta com o mesmo e-mail entra nela,
**desde que o WorkOS mande `email_verified: true` no ID token** (o app exige;
conferir no primeiro login em produção). O SSO não passa pela verificação em
duas etapas do app: a do WorkOS vale. O issuer precisa ser `https://`
(só `127.0.0.1`/`localhost` podem ser `http`).

**Prova local:** na vps-wp-old usei o Dex como provedor OIDC de teste
(`colab/test/dex.yml`). A administradora criada com senha entrou pelo
botão "Continue with ColabAuth (teste)", voltou por
`/api/auth/callback/sso`, e a conta `sso` ficou ligada à conta existente
(`emailVerified: true`). Nada foi criado no WorkOS.

## E-mail

O SignuDoc manda e-mail só pelo Resend (`src/lib/services/email.ts`), ou
grava em disco com `EMAIL_DRIVER=capture` (só aceito quando `APP_URL` é
`127.0.0.1`/`localhost`). Convites, lembretes e a cópia final (com o PDF
selado e o certificado anexos) dependem disso.

| Opção                                                                 | O que precisa                                                                                                                                                                                                                    | Esforço                                                                                                               | Fork                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Resend com domínio colaborato.rio** (recomendada)                   | Conta Resend, chave com permissão total, "Send email from" = `assinaturas@sign.colaborato.rio` em Settings › Organization. O app mostra e confere os registros DNS (SPF/DKIM) para pôr no Cloudflare. `RESEND_REGION=sa-east-1`. | ~30 min + propagação do DNS. Grátis até 100/dia e 3.000/mês (≈20 envelopes de 2 signatários por dia); Pro US$ 20/mês. | Sem mudança.                                                            |
| **Driver SMTP no fork** (serve Brevo, SES, Google Workspace, Mailpit) | `nodemailer`, um driver novo em `email.ts`, um estado novo em `email-status.ts` e na tela `organization-settings.tsx` (que hoje só conhece Resend), remetente sem a verificação automática de domínio, testes.                   | ~1 dia.                                                                                                               | Mexe em 3–4 arquivos centrais do upstream: conflito a cada atualização. |
| **Brevo**                                                             | Via SMTP (depende do driver acima) ou driver HTTP próprio (mesmo esforço, ainda mais específico). Domínio verificado no Brevo.                                                                                                   | ~1 dia + DNS. Grátis até 300/dia.                                                                                     | Igual ao SMTP.                                                          |

**Pronto para o Resend (T1b):** o compose passa `RESEND_FROM_EMAIL`
(remetente, padrão no `.env.example`: `ColabSign <assinar@colaborato.rio>`)
e `SUPPORT_EMAIL` (para onde vão as respostas; confirmar a caixa). Quando a
conta existir: criar a chave "Full access", verificar o domínio
`colaborato.rio` no Resend (registros SPF/DKIM no Cloudflare), pôr
`RESEND_API_KEY` no `.env`, subir e usar "Send test email" em Settings ›
Organization. Os textos dos e-mails já saem em português.

Decisão da T1: **não implementei o driver SMTP**, porque ele não fica
pequeno nem isolado (toca a tela e o estado do e-mail, não só o envio). O
Mailpit da vps-infra não entrega para fora, então não serve para produção.
Recomendo o Resend com o domínio colaborato.rio, que não muda o fork.

## API e webhooks

A API (`/api/v1`, chaves `sdk_…` em Settings › Organization › API keys) e
os webhooks (Settings › Organization › Webhooks, padrão Standard Webhooks,
segredo `whsec_…`) estão em `docs/api.md`. Pontos que importam para a T6:

- A chave age como a administradora que a criou. Para o Backoffice, criar
  uma conta de administrador própria ("Backoffice") e a chave nela.
- `POST /api/v1/envelopes` (multipart: `file` + `data` JSON) cria e envia
  numa chamada; `metadata` (até 2 KB) volta em todo evento: use o id da
  proposta. `Idempotency-Key` evita envelope duplicado.
- Eventos: `envelope.sent`, `signer.viewed`, `signer.signed`,
  `envelope.completed`, `envelope.declined`, `envelope.voided`,
  `envelope.expired`.
- Corpo: `{ type, timestamp, data: { envelope, owner, signer? } }`.
  `data.envelope` é o mesmo objeto da API. Em `envelope.completed`,
  `data.envelope.files.signed` e `.certificate` são caminhos da API para
  baixar o PDF selado e o certificado (com a chave).
- Cabeçalhos: `webhook-id` (`msg_…`, igual em toda nova tentativa: use para
  não processar duas vezes), `webhook-timestamp`, `webhook-signature`
  (`v1,<base64 HMAC-SHA256 de "{id}.{timestamp}.{corpo}">` com a chave em
  base64 depois de `whsec_`). Responder 2xx em até 10 s.
- Novas tentativas: 1 min, 5 min, 30 min, 2 h, 8 h, 24 h, 24 h; aqui elas
  saem pelo agendador. O que se perdeu pode ser relido em
  `GET /api/v1/webhook-deliveries?since=…`.
- A URL do webhook precisa ser `https://` e pública. Para o Backoffice na
  mesma VPS por rede interna (`http://backoffice:3000/...`) seria preciso
  `WEBHOOK_ALLOW_PRIVATE_URLS=1`; prefira o endereço HTTPS público.

Exemplos reais de cada evento: `colab/docs/webhook-payloads-exemplo.json`.

## Marca

Feita só pelas configurações (Settings › Organization), sem tocar o código
de marca do upstream:

- Organization name: `ColabSign`.
- Logo: `colab/brand/colabsign-logo.png` (marca do ColabOS, quadrado rosa
  `#EC4899` com a grade 2×2, e "ColabSign" em Outfit 700).
- Brand color: `#BE185D` (cor das ações principais no protótipo do ColabOS).

O rodapé continua com "Powered by SignuDoc" e a tela "Check for updates"
aponta para o SignuDoc: é a licença/atribuição do upstream e ajuda a saber
quando atualizar.

## Pontos de atenção

- **Idioma:** a imagem sai em português (seção abaixo). Ainda em inglês:
  as telas de Settings (organização, segurança, webhooks, chaves de API,
  pessoas, equipes, atualizações), a documentação da API e as páginas
  /terms e /privacy do serviço hospedado (não usadas aqui).
- **Selo:** sem `SEAL_P12_BASE64`, o app cria um certificado autoassinado
  ("ColabSign document seal"). O PDF selado valida (`pdfsig`: "Signature is
  Valid"), mas leitores mostram "emissor desconhecido". Para selo confiável,
  um certificado de uma AC em `.p12` e, se quiser carimbo do tempo,
  `SEAL_TIMESTAMP_URL`.
- `BETTER_AUTH_SECRET` não pode mudar depois do primeiro uso.

## Teste na vps-wp-old (27/11/2026)

Tudo em `127.0.0.1`, dados fictícios, derrubado no fim:

```sh
docker compose -f colab/compose.yml -f colab/test/compose.test.yml \
  --env-file colab/test/test.env up -d --build
# navegador: contêiner mcr.microsoft.com/playwright:v1.49.1-noble em ws://127.0.0.1:3200
node colab/test/e2e/01-setup.mjs            # /setup: organização ColabSign + admin
node colab/test/e2e/02-marca.mjs            # logo + cor em Settings › Organization
node colab/test/e2e/03-sso.mjs              # login OIDC pelo Dex
node colab/test/e2e/04-chave-e-webhook.mjs  # chave de API + endpoint de webhook
node colab/test/e2e/05-pdf.mjs && colab/test/e2e/06-enviar-pela-api.sh
node colab/test/e2e/08-assinar.mjs bruno.ficticio@example.com contratante
ASSINAR_EM=390 node colab/test/e2e/08-assinar.mjs carla.ficticia@example.com contratada
colab/test/e2e/09-baixar-pela-api.sh        # PDF selado, certificado, eventos
node colab/test/e2e/11-telas.mjs            # capturas do painel e da tela de envio
```

(Os roteiros esperam o `playwright-core` 1.49 em `node_modules` ao lado e
o outbox do e-mail capturado em `/root/colabsign-test/outbox`.)

## Plano de deploy (quando o Alexandre aprovar)

1. Merge do PR na main: o workflow publica
   `ghcr.io/alexandrelt44/colabsign:<sha>`.
2. Na VPS de produção: pasta `/opt/colabsign` com `colab/compose.yml` e o
   `.env` (segredos novos, `APP_URL=https://sign.colaborato.rio`,
   `COLABSIGN_IMAGE=ghcr.io/alexandrelt44/colabsign:<sha>`, `SETUP_TOKEN`).
3. DNS `sign.colaborato.rio` + bloco no proxy da VPS para `127.0.0.1:3000`.
4. `docker compose up -d`; abrir `/setup` com o `SETUP_TOKEN`, criar a
   organização e o admin; aplicar a marca (seção Marca).
5. E-mail: Resend com o domínio (seção E-mail) e "Send test email".
6. WorkOS: o app já existe; copiar as `SSO_*` de
   `~/.config/colabsign/workos-prod.env` para o `.env`, testar o login,
   depois `PASSWORD_SIGN_IN=off`.
7. Conta "Backoffice" (admin), chave de API e webhook para o Backoffice (T6).
8. Backup diário (seção Backup).

## Português (pt-BR)

O SignuDoc não tem estrutura de idiomas. Para não alterar o upstream (e não
ter conflito a cada atualização), a tradução é aplicada **na hora do build
da imagem**, numa cópia do código: `colab/Dockerfile` roda
`node colab/i18n/aplicar.mjs` antes do `next build`. Nada muda no git.

- `colab/i18n/pt-BR/*.json`: glossário inglês → português. `por-arquivo.json`
  tem entradas que valem só num arquivo (palavras curtas que em outro lugar
  podem ser valores de código; uma entrada igual ao original impede a
  tradução naquele arquivo).
- `colab/i18n/trocas.mjs`: trocas exatas de trechos de código (datas em
  pt-BR no fuso `America/Sao_Paulo`, "(horário de Brasília)" no
  certificado, rótulos montados a partir de códigos internos, versão do
  aviso de documentos eletrônicos `2026-11-13-pt-BR`).
- `colab/i18n/escopo.json`: arquivos que o glossário percorre.
- `colab/i18n/ignorar.json`: textos em inglês que não aparecem para
  ninguém (logs, SQL, cabeçalhos de API).

O script lê cada arquivo com o parser do TypeScript e só troca texto de
tela: texto de JSX, atributos como title/label/placeholder e textos entre
aspas. Nunca troca texto usado em comparação (`===`, `case`, `.includes`),
chaves de objeto, tipos ou atributos técnicos; se algum texto do glossário
for comparado em qualquer lugar de `src/`, o build para. O build também
para se uma troca de `trocas.mjs` não for achada (o upstream mudou o
trecho), e a checagem de tipos do `next build` pega rótulos que viraram
tipos literais.

```sh
node colab/i18n/aplicar.mjs --check --faltando   # lista o que falta traduzir
node colab/i18n/aplicar.mjs --check --estrito    # falha se faltar (CI)
docker build -f colab/Dockerfile --build-arg COLAB_LANG=en .   # SignuDoc em inglês
```

A imagem também define `TZ=America/Sao_Paulo`. Inglês continua disponível
como imagem separada (`COLAB_LANG=en`); não dá para trocar de idioma por
usuário, porque o upstream não tem essa estrutura.

**Custo de manter:** a cada release do upstream, o CI (`colab-image.yml`)
roda a checagem estrita e o build. Frase nova ou alterada aparece na lista
do `--faltando`; acrescente no glossário (minutos por release, conforme o
tamanho da mudança). Nenhum arquivo do upstream foi tocado; a tradução
alcança 91 arquivos na cópia do build.

**Páginas legais do signatário** (aviso de privacidade, "Assinaturas
eletrônicas"): traduzidas com as referências ao GDPR trocadas pelas da LGPD
e a lista de provedores ajustada (servidor próprio + Resend). Precisam de
revisão jurídica; o ideal é pôr a política do Colaboratório em Settings ›
Organization (Privacy URL).

## Atualizar do upstream

O upstream traz `.github/workflows/update-signudoc.yml`, que toda segunda
abre um PR com a release nova. Como o fork não muda arquivos do upstream, o
merge deve entrar limpo. Antes do merge: o check "ColabSign image" verde
(o Dockerfile ainda constrói) e uma subida rápida na vps-wp-old.
