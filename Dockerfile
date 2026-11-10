FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run lint && npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY LICENSE /usr/share/licenses/watchboard/LICENSE
ENV API_UPSTREAM=http://api:8080 \
    NGINX_ENVSUBST_OUTPUT_DIR=/tmp \
    NGINX_ENVSUBST_FILTER=API_UPSTREAM
LABEL org.opencontainers.image.title="Watchboard Web" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.source="https://github.com/David-H-Afonso/Watchboard.Front" \
    org.opencontainers.image.licenses="MIT"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
