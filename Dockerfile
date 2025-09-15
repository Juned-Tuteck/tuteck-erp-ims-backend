FROM node:20.19-alpine3.22
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
EXPOSE 7322
CMD ["npm", "run", "dev"]
