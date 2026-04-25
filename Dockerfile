# syntax=docker/dockerfile:1.6

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src

# VITE_REPORT_URL is baked in at build time. Leave empty to use SAMPLE_DATA,
# or pass a blob URL / reverse-proxied path (e.g. /weekly_report.json).
ARG VITE_REPORT_URL="data/weekly_report.json"
ENV VITE_REPORT_URL=$VITE_REPORT_URL

RUN npm run build


# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx data/weekly_report.json /usr/share/nginx/data/weekly_report.json

# Azure Container Apps ingress defaults to port 80, but 8080 is friendlier
# for non-root nginx and common ACA examples. We stay on 8080.
EXPOSE 8080

# nginx:alpine runs as root by default; we drop to the built-in 'nginx' user.
# The default config writes pid to /var/run; override to a user-writable path.
RUN touch /var/run/nginx.pid \
  && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /usr/share/nginx/html

USER nginx

CMD ["nginx", "-g", "daemon off;"]
