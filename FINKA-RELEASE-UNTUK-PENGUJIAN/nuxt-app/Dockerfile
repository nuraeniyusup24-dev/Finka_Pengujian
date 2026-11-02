 # Frontend Finka (Nuxt 4 + Vue 3 compatibility mode)
FROM node:24-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    NUXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN NODE_ENV=development npm ci
COPY . .
RUN npm run build
EXPOSE 3000
# Set NUXT_PUBLIC_API_BASE_URL saat deployment untuk memilih backend runtime.
CMD ["npm", "start"]
