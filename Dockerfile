FROM node:22-alpine

WORKDIR /app
COPY . .

CMD ["node", "src/cli.mjs", "run"]
