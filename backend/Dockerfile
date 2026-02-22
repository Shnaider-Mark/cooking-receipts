FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY scripts ./scripts

RUN npm run build

EXPOSE 4000

CMD sh -c "npm run migrate && npm run start"
