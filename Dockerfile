# Backend (Express + Socket.io + node-cron) container.
# Works on Railway (auto-detects this root Dockerfile, injects $PORT) and on any Docker host
# (Hugging Face Docker Spaces default to 7860, hence the default). No secrets are baked in:
# configure everything via the host's environment variables.
FROM node:20-slim
ENV NODE_ENV=production PORT=7860 UPLOAD_DIR=/app/uploads TZ=Asia/Kolkata
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund
COPY server/ ./
# uploads are ephemeral (lost on redeploy/restart); run as non-root uid 1000
RUN rm -f .env && mkdir -p /app/uploads && chown -R 1000:1000 /app/uploads
USER 1000
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
