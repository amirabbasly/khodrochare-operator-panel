# ---------- API (Express + PostgreSQL) ----------
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# نصب فقط وابستگی‌های بک‌اند از ریشه‌ی workspace
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --omit=dev --workspace backend --include-workspace-root \
    && npm cache clean --force

COPY backend ./backend

WORKDIR /app/backend
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
