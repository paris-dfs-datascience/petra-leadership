# Build the Vite dashboard and serve it with nginx.
# weekly_report.json is copied into the public/ folder so it ships
# at /weekly_report.json. Swap to blob storage later by setting
# VITE_REPORT_URL at build time.

FROM node:20-alpine AS build
WORKDIR /app

COPY src/package.json ./package.json
RUN npm install

COPY src/ ./
RUN mkdir -p public
COPY weekly_report.json ./public/weekly_report.json

ARG VITE_REPORT_URL
ENV VITE_REPORT_URL=${VITE_REPORT_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
