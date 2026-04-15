# Configuracion de Nginx

WhyNot utiliza un unico archivo de configuracion de Nginx para servir tres nombres de host:

| Nombre de host | Upstream | Puerto |
|----------------|----------|--------|
| `whynot.skrum.io` | Frontend SPA | 5183 |
| `admin.whynot.skrum.io` | Admin Frontend SPA | 5184 |
| `superadmin.whynot.skrum.io` | Admin Frontend SPA (espacio superadmin) | 5184 |

`superadmin.whynot.skrum.io` es un alias de nombre de host que redirige al mismo upstream de admin-frontend. La SPA detecta el nombre de host y restringe la interfaz a las secciones de superadmin unicamente.

## Requisitos previos

- DNS: Los registros A/AAAA para los tres nombres de host deben apuntar al servidor.
- Nginx instalado en el servidor host.
- Certbot instalado para el aprovisionamiento de certificados TLS.

## Instalacion

El archivo de configuracion se encuentra en el repositorio en `docker/nginx/whynot.skrum.io`. Use un enlace simbolico para que los cambios futuros se propaguen automaticamente:

```bash
# Eliminar la configuracion antigua no versionada si existe
sudo rm -f /etc/nginx/sites-available/whynot
sudo rm -f /etc/nginx/sites-enabled/whynot

# Enlace simbolico desde el repositorio
sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
            /etc/nginx/sites-available/whynot.skrum.io
sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
            /etc/nginx/sites-enabled/whynot.skrum.io

# Probar y recargar
sudo nginx -t && sudo systemctl reload nginx
```

## TLS con Certbot

Ejecute Certbot con los tres nombres de host:

```bash
sudo certbot --nginx \
  -d whynot.skrum.io \
  -d admin.whynot.skrum.io \
  -d superadmin.whynot.skrum.io
```

Certbot agrega automaticamente los bloques `listen 443 ssl` y las directivas `ssl_*`. La renovacion cubre los tres nombres de host.

## Sincronizacion manual (alternativa)

Si prefiere copiar en lugar de crear un enlace simbolico:

```bash
sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
        /etc/nginx/sites-available/whynot.skrum.io
sudo nginx -t && sudo systemctl reload nginx
```

Nota: con este enfoque, debe volver a copiar despues de cada cambio.

## Verificacion

```bash
# Probar la sintaxis de la configuracion
sudo nginx -t

# Verificar que los tres nombres de host responden
curl -I https://whynot.skrum.io
curl -I https://admin.whynot.skrum.io
curl -I https://superadmin.whynot.skrum.io
```

## Stripe Webhooks

El endpoint `/api/webhooks/stripe` es accesible a traves de los tres nombres de host. Fije la URL del webhook en `https://whynot.skrum.io/api/webhooks/stripe` en el panel de Stripe para evitar discrepancias de firma.

## Limitacion de tasa

Se configuran dos zonas de limitacion de tasa:

- `whynot_api_limit`: 30 req/s con rafaga de 50 para las rutas `/api/`.
- `whynot_auth_limit`: 5 req/s con rafaga de 10 para los endpoints de autenticacion.

Ambas zonas se aplican de forma identica en los tres nombres de host.
