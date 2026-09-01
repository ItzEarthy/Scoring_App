# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app
COPY realtime/package.json ./
RUN npm install --omit=dev
COPY realtime/server.js ./

RUN addgroup --system --gid 1001 realtime \
  && adduser --system --uid 1001 realtime
USER realtime

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.js"]
