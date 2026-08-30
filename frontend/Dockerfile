FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expone el puerto de Vite
EXPOSE 5173

# El flag --host es obligatorio en Docker para que Vite sea accesible
CMD ["npm", "run", "dev", "--", "--host"]