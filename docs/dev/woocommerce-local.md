# WooCommerce local (Docker)

Stack de prueba para integrar Andiko con WooCommerce en localhost, sin depender de una tienda externa.

## Levantar

Woo **no** se levanta con `make up` (solo postgres + pgadmin). Para pruebas de integración:

```bash
make woo-up
# o manualmente (si postgres ya corre):
docker compose --profile woo up -d woo-db wordpress
docker compose --profile woo --profile woo-init run --rm woo-init
```

Servicios:

| Servicio | URL |
|----------|-----|
| Tienda WooCommerce | http://localhost:8080 |
| WP Admin | http://localhost:8080/wp-admin |
| Andiko ERP | http://localhost:3000 |

Credenciales WP por defecto: `admin` / `admin` (override con `WOO_ADMIN_*` en `.env.local`).

## Credenciales REST API

Tras el bootstrap:

```bash
make woo-credentials
# o
cat infra/docker/woocommerce/dev-output/credentials.env
```

En Andiko: **Integraciones → WooCommerce → Conectar sitio** (pestaña Conexión):

- **URL de la tienda:** `http://localhost:8080`
- **Consumer Key / Secret:** del archivo generado
- **Sucursal:** la que comparte stock en tu org de dev

## Webhooks (pedidos en tiempo real)

WordPress corre **dentro** de Docker. Si `AUTH_URL=http://localhost:3000`, WooCommerce intentará llamar a sí mismo y los webhooks fallan.

En `.env.local`:

```env
AUTH_URL=http://host.docker.internal:3000
```

Reiniciá `pnpm dev` después de cambiar `AUTH_URL`. Al crear o editar el sitio en Andiko, se registran webhooks apuntando a esa URL.

## Sync manual (sin cron)

Si no configurás `CRON_SECRET`, en desarrollo podés disparar poll + cola:

```bash
curl -X POST http://localhost:3000/api/v1/integrations/woocommerce/sync
```

Útil para probar pedidos cuando los webhooks no llegan.

## Flujo de prueba sugerido

1. `make dev` (postgres + Next.js).
2. `make woo-up` cuando necesites la tienda de prueba.
3. Org de dev con productos/variantes con **SKU** en el catálogo.
4. Conectar sitio Woo con las credenciales del bootstrap.
5. Pestaña **Productos** → **Publicar catálogo ERP → Woo** o importación inicial.
6. Crear un pedido en http://localhost:8080/shop (o backfill en **Pedidos**).
7. Ver pedido en Andiko (**Ventas**) con origen WooCommerce.

## Reset

```bash
make woo-reset
make woo-up
```

## Variables opcionales (`.env.local`)

```env
WOO_PORT=8080
WOO_STORE_URL=http://localhost:8080
WOO_ADMIN_USER=admin
WOO_ADMIN_PASSWORD=admin
```
