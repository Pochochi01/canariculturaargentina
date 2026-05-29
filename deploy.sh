#!/bin/bash
# Script de despliegue para VPS Hostinger KVM2
# Ejecutar como root o usuario sudo en el servidor

set -e

echo "=== Despliegue Sistema Canaricultura ==="

# 1. Actualizar paquetes
apt update && apt upgrade -y

# 2. Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Instalar MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable mongod && systemctl start mongod

# 4. Instalar PM2 y Nginx
npm install -g pm2
apt install -y nginx certbot python3-certbot-nginx

# 5. Copiar archivos del proyecto
mkdir -p /var/www/canaricultura
# Asume que los archivos están en /tmp/canaricultura
cp -r /tmp/canaricultura/backend /var/www/canaricultura/
cp -r /tmp/canaricultura/frontend /var/www/canaricultura/

# 6. Instalar dependencias del backend
cd /var/www/canaricultura/backend
npm install --production

# 7. Configurar variables de entorno
cp .env.example .env
echo "⚠️  EDITE /var/www/canaricultura/backend/.env con sus valores reales"

# 8. Ejecutar seed inicial
node src/scripts/seed.js

# 9. Build del frontend
cd /var/www/canaricultura/frontend
npm install
npm run build

# 10. Configurar Nginx
cp /tmp/canaricultura/nginx.conf /etc/nginx/sites-available/canaricultura
ln -sf /etc/nginx/sites-available/canaricultura /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 11. Iniciar API con PM2
cd /var/www/canaricultura/backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo ""
echo "=== Despliegue completado ==="
echo "Credenciales iniciales:"
echo "  DNI: 00000000  |  Contraseña: admin123"
echo ""
echo "Próximos pasos:"
echo "  1. Editar /var/www/canaricultura/backend/.env"
echo "  2. pm2 restart canaricultura-api"
echo "  3. certbot --nginx -d tudominio.com (para SSL)"
