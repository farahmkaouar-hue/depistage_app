# ==========================================
# Étape 1 : build React/Vite
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers npm
COPY package.json package-lock.json ./

# Installer exactement les dépendances du lockfile
RUN npm install

# Copier le reste du frontend
COPY . .

# Construire l'application
RUN npm run build


# ==========================================
# Étape 2 : serveur Nginx
# ==========================================
FROM nginx:alpine

# Supprimer la page par défaut de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copier le build React
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]