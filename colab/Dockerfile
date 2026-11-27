# ColabSign: imagem para rodar o SignuDoc fora da Vercel (Node 24 + Postgres
# próprio + arquivos em disco). Segue "Self-hosting somewhere else" em
# docs/self-hosting.md. Construir a partir da raiz do repo:
#
#   docker build -f colab/Dockerfile -t colabsign:<tag> .
#
# Arquivo só do fork: o upstream não tem Dockerfile.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# A VPS de teste tem 4 GB; o build do Next cabe com este teto.
ENV NODE_OPTIONS=--max-old-space-size=2560
RUN npm run build \
  && npm prune --omit=dev --no-audit --no-fund \
  && rm -rf .next/cache

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_LOCAL_DIR=/data/storage
# O app lê em runtime os fontes de src/assets/fonts, o next.config.ts (que
# importa src/lib/types/domain.ts) e as migrations em db/. Por isso a árvore
# inteira vai junto, já sem as dependências de desenvolvimento.
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["/app/colab/docker-entrypoint.sh"]
CMD ["start"]
