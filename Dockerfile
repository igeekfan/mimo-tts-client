FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder

ARG NPM_VERSION=11.12.1
RUN npm install --global npm@${NPM_VERSION}

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

FROM --platform=$BUILDPLATFORM golang:1.25.13-alpine AS backend-builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
ARG APP_VERSION=0.0.0
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} GOFLAGS="-mod=readonly" \
    go build -tags web -ldflags "-s -w -X main.version=${APP_VERSION}" -o /app/tts-server .

FROM alpine:3.24

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S tts \
    && adduser -S -G tts -h /app tts \
    && mkdir -p /app /data \
    && chown -R tts:tts /app /data \
    && rm -rf /var/cache/apk/* /tmp/*

WORKDIR /app
COPY --chown=tts:tts --from=backend-builder /app/tts-server ./
COPY --chown=tts:tts --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8080

ENV TTS_WEB_ADDR=:8080
ENV XDG_CONFIG_HOME=/data

VOLUME ["/data"]
USER tts
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

CMD ["./tts-server"]
