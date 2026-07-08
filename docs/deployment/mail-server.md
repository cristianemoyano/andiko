# Servidor de email (docker-mailserver en Docker Swarm)

Correo `@andiko.cloud` para el equipo Andiko y envío transaccional del ERP (facturas, pedidos, presupuestos). El servicio corre en el **mismo VPS** que la app, como servicio Swarm `mailserver`.

**Relación con el ERP:** Andiko ya envía email vía Nodemailer y la config sys-admin en `/sys-admin/email`. Este setup provee el **backend SMTP/IMAP**; no hay que cambiar el módulo de comunicaciones salvo apuntar host/puerto/credenciales.

Runbook general del VPS: [production.md](production.md)

---

## 1. Arquitectura

```
Internet ──MX──► mail.andiko.cloud (:25/:587/:465/:993, host mode)
                      │
                      ▼
              docker-mailserver (Swarm: andiko_mailserver)
                      │
         ┌────────────┼────────────┐
         ▼            ▼            ▼
   /var/lib/andiko/mail/data   state   config
         │
         └──► Let's Encrypt certs (shared with nginx)

app (Swarm) ──overlay internal──► mailserver:587 (SMTP auth)
nginx (:443) ──► app (:3000)
```

| Servicio Swarm | Puertos (host) | Rol |
|----------------|----------------|-----|
| `andiko_mailserver` | 25, 587, 465, 993 | Postfix + Dovecot + OpenDKIM + Rspamd |
| `andiko_app` | — (interno) | Cliente SMTP → `mailserver:587` |
| `andiko_nginx` | 80, 443 | HTTPS app (certs compartidos) |

Imagen: `ghcr.io/docker-mailserver/docker-mailserver:latest`  
Config: [`infra/mail/docker-mailserver.env.example`](../../infra/mail/docker-mailserver.env.example)

---

## 2. Glosario

| Término | Qué es |
|---------|--------|
| **SPF** | Registro DNS que indica qué servidores pueden enviar mail por `@andiko.cloud` |
| **DKIM** | Firma criptográfica en cada email saliente; clave pública en DNS |
| **DMARC** | Política ante fallos SPF/DKIM; envía reportes a `postmaster@` |
| **PTR / rDNS** | El IP `187.77.235.70` debe resolver a `mail.andiko.cloud` |
| **postmaster@** | Buzón administrativo (reportes DMARC, rebotes del sistema) |
| **erp@** | Cuenta de servicio que usa el ERP para enviar documentos |
| **mailserver:587** | Host SMTP **interno** (desde el contenedor `app`) |
| **mail.andiko.cloud** | Host **externo** (Thunderbird, clientes IMAP) |

---

## 3. Prerequisitos

- VPS Hostinger KVM 4 (4 vCPU, 16 GB RAM) con Docker Swarm activo
- Stack `andiko` desplegado ([production.md](production.md))
- Dominio `andiko.cloud` con acceso al panel DNS
- Repo en el VPS: `/root/andiko`, branch `develop`
- `infra/.env.production` configurado

**Checklist Hostinger (manual — soporte / panel):**

1. **Desbloquear puerto 25** — solicitar a soporte si emails entrantes/salientes fallan
2. **PTR/rDNS** — `187.77.235.70` → `mail.andiko.cloud`
3. **Firewall cloud** — permitir TCP 25, 587, 465, 993 además de 22, 80, 443

Verificar desde laptop o VPS:

```bash
make prod-mail-check
# o: bash infra/scripts/prereq-mail-check.sh
```

---

## 4. DNS (paso a paso)

Configurar en el panel DNS de `andiko.cloud`:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | `mail` | `187.77.235.70` |
| MX | `@` | `10 mail.andiko.cloud` |
| TXT | `@` | `v=spf1 mx a:mail.andiko.cloud ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@andiko.cloud` |
| TXT | `mail._domainkey` | *(después del deploy — ver sección 8)* |

**Verificación:**

```bash
dig +short A mail.andiko.cloud
dig +short MX andiko.cloud
dig +short TXT andiko.cloud
dig +short TXT _dmarc.andiko.cloud
dig +short -x 187.77.235.70    # PTR
```

Propagación: minutos a 48 h. Re-ejecutar `make prod-mail-check` hasta que pase.

---

## 5. TLS / certificados

El mailserver reutiliza el certificado Let's Encrypt de nginx. Hay que incluir `mail.andiko.cloud` como SAN.

**Una vez** (VPS, con stack nginx corriendo):

```bash
ssh root@187.77.235.70
cd /root/andiko
bash infra/scripts/expand-ssl-mail.sh
# o: make prod-expand-ssl-mail
```

Rutas dentro del contenedor mail (config en `docker-mailserver.env`):

```
/etc/letsencrypt/live/andiko.cloud/fullchain.pem
/etc/letsencrypt/live/andiko.cloud/privkey.pem
```

**Renovación:** el cron existente ejecuta `make prod-renew-certs` → [`infra/certbot/renew.sh`](../../infra/certbot/renew.sh) recarga nginx **y** reinicia `andiko_mailserver`.

**Troubleshooting TLS:**

- Cert sin SAN `mail.andiko.cloud` → re-ejecutar `expand-ssl-mail.sh`
- Cliente IMAP rechaza cert → confirmar que Thunderbird usa `mail.andiko.cloud`, no el IP

---

## 6. Bootstrap inicial (primera vez)

```bash
ssh root@187.77.235.70
cd /root/andiko
git pull origin develop

make prod-init-mail
```

Esto crea:

| Path en VPS | Uso |
|-------------|-----|
| `/var/lib/andiko/mail/data` | Buzones Maildir |
| `/var/lib/andiko/mail/state` | Estado Postfix/Dovecot |
| `/var/lib/andiko/mail/config` | Cuentas, DKIM, overrides |
| `infra/mail/docker-mailserver.env` | Variables DMS (desde `.example`) |

Revisar/editar `infra/mail/docker-mailserver.env` si hace falta. Variables clave:

| Variable | Valor prod |
|----------|------------|
| `OVERRIDE_HOSTNAME` | `mail.andiko.cloud` |
| `SSL_TYPE` | `manual` |
| `SSL_CERT_PATH` / `SSL_KEY_PATH` | certs Let's Encrypt de `andiko.cloud` |
| `PERMIT_DOCKER` | `none` (auth obligatoria) |
| `ENABLE_CLAMAV` | `0` (ahorra RAM) |

Asegurar en `infra/.env.production`:

```bash
MAIL_DATA_DIR=/var/lib/andiko/mail/data
MAIL_STATE_DIR=/var/lib/andiko/mail/state
MAIL_CONFIG_DIR=/var/lib/andiko/mail/config
MAIL_ENV_FILE=/root/andiko/infra/mail/docker-mailserver.env
```

**UFW** (si no estaba abierto):

```bash
ufw allow 25/tcp
ufw allow 587/tcp
ufw allow 465/tcp
ufw allow 993/tcp
```

(`bootstrap-vps.sh` ya incluye estos puertos en hosts nuevos.)

---

## 7. Deploy del servicio mail

El servicio está definido en [`infra/docker-stack.yml`](../../infra/docker-stack.yml). Se despliega con el stack completo:

```bash
make prod-deploy TAG=v0.35.0
# o release completo: make prod-release
```

**Verificar:**

```bash
docker service ps andiko_mailserver
make prod-mail-logs          # Ctrl+C para salir
docker service ls | grep mail
```

**Health checks manuales (desde VPS):**

```bash
openssl s_client -connect mail.andiko.cloud:993 -brief </dev/null 2>/dev/null | head -5
openssl s_client -starttls smtp -connect mail.andiko.cloud:587 -brief </dev/null 2>/dev/null | head -5
```

---

## 8. Alta de cuentas y DKIM

### Cuentas obligatorias

Generar contraseñas seguras (`openssl rand -base64 24`):

```bash
make prod-mail-add-user EMAIL=postmaster@andiko.cloud PASSWORD='...'
make prod-mail-add-user EMAIL=erp@andiko.cloud PASSWORD='...'
make prod-mail-add-user EMAIL=cristian@andiko.cloud PASSWORD='...'
```

Listar buzones:

```bash
bash infra/scripts/mail-setup.sh list-users
```

Cambiar contraseña:

```bash
EMAIL=user@andiko.cloud PASSWORD='...' bash infra/scripts/mail-setup.sh update-password
```

Eliminar buzón:

```bash
EMAIL=user@andiko.cloud bash infra/scripts/mail-setup.sh delete-user
```

### DKIM

Tras el primer arranque del mailserver:

```bash
make prod-mail-dkim
```

Copiar el TXT mostrado y publicarlo en DNS:

```
mail._domainkey.andiko.cloud  TXT  "v=DKIM1; ..."
```

Verificar:

```bash
dig +short TXT mail._domainkey.andiko.cloud
```

---

## 9. Integración con Andiko ERP

1. Ingresar como sys-admin → **Sys-admin → Email (SMTP)**
2. Clic en **Servidor Andiko** (preset) o completar manualmente:

| Campo | Valor |
|-------|-------|
| Habilitado | Sí |
| Host | `mailserver` |
| Puerto | `587` |
| SSL/TLS | No (STARTTLS) |
| Usuario | `erp@andiko.cloud` |
| Contraseña | la de `prod-mail-add-user` |
| Nombre remitente | `Andiko` |
| Email remitente | `erp@andiko.cloud` |

3. **Guardar**
4. Enviar email de prueba desde la misma pantalla
5. Enviar una factura/pedido desde el ERP → verificar en **Configuración → Emails enviados**

**Staging (Vercel):** no tiene acceso a `mailserver` interno; seguir usando Gmail u otro SMTP externo, o el transport `log` en dev.

---

## 10. Cliente de email (equipo)

Configuración para Thunderbird / Apple Mail / Outlook:

| | Entrante (IMAP) | Saliente (SMTP) |
|--|-----------------|-----------------|
| Servidor | `mail.andiko.cloud` | `mail.andiko.cloud` |
| Puerto | `993` | `587` |
| Seguridad | SSL/TLS | STARTTLS |
| Usuario | `user@andiko.cloud` | `user@andiko.cloud` |
| Contraseña | la del buzón | la del buzón |

---

## 11. Pruebas de aceptación

Checklist post go-live:

| # | Prueba | Comando / acción | Esperado |
|---|--------|------------------|----------|
| 1 | Servicio activo | `docker service ps andiko_mailserver` | `Running` 1/1 |
| 2 | Prerequisites | `make prod-mail-check` | 0 failures |
| 3 | Score spam | Enviar a [mail-tester.com](https://www.mail-tester.com) | ≥ 9/10 |
| 4 | Entrante | Gmail → `user@andiko.cloud` | Llega a IMAP |
| 5 | Saliente humano | Thunderbird → Gmail externo | Entrega inbox |
| 6 | ERP test | `/sys-admin/email` → email de prueba | Recibido |
| 7 | ERP documento | Enviar factura desde detalle | Fila en `email_logs` |
| 8 | Cola vacía | `bash infra/scripts/mail-setup.sh status` | Sin cola atascada |

---

## 12. Operación diaria

| Tarea | Comando |
|-------|---------|
| Logs | `make prod-mail-logs` |
| Reiniciar | `make prod-mail-restart` |
| Estado / cola | `bash infra/scripts/mail-setup.sh status` |
| Backup mail | `make prod-backup-mail` |
| Backup DB | `make prod-backup` |
| Portainer | [portainer.andiko.cloud](https://portainer.andiko.cloud) → stack `andiko` → `mailserver` |

**Backup mail:** crea `andiko-mail-YYYYMMDD-HHMMSS.tar.gz` en `/var/lib/andiko/backups/` (data + state + config). Subir a GDrive si `rclone` está configurado.

**Restore:** detener mailserver, extraer tarball sobre `/var/lib/andiko/mail/`, reiniciar servicio.

---

## 13. Troubleshooting

| Síntoma | Causa probable | Fix |
|---------|----------------|-----|
| Emails a spam | SPF/DKIM/DMARC/PTR incompletos | `make prod-mail-check`; mail-tester.com |
| No llega mail entrante | Puerto 25 bloqueado | Solicitar desbloqueo Hostinger |
| Auth SMTP falla | Contraseña incorrecta / buzón inexistente | `list-users`, reset password |
| App: connection refused | Mailserver down o red overlay | `docker service ps`; redeploy stack |
| App: cert / altnames error (`Host: mailserver`) | Cert es para `mail.andiko.cloud`, no el DNS interno | Host `mailserver` + app ≥ v0.42 con SNI; o host `mail.andiko.cloud` |
| App: cert error (paths) | TLS manual mal configurado | Verificar paths en env + expand SSL |
| IMAP cert inválido | SAN falta `mail.andiko.cloud` | `make prod-expand-ssl-mail` |
| OOM / container restart | RAM insuficiente | ClamAV off; revisar `docker service logs` |
| Cola atascada | DNS destino / greylisting | `mail-setup.sh status`; logs |

Logs detallados:

```bash
docker service logs andiko_mailserver --tail 200
```

---

## 14. Referencia rápida

### Comandos Makefile

| Comando | Descripción |
|---------|-------------|
| `make prod-init-mail` | Bootstrap dirs + env |
| `make prod-expand-ssl-mail` | Cert SAN mail.andiko.cloud |
| `make prod-mail-add-user EMAIL=… PASSWORD=…` | Alta buzón |
| `make prod-mail-dkim` | Mostrar registro DKIM |
| `make prod-mail-logs` | Follow logs |
| `make prod-mail-restart` | Force restart |
| `make prod-mail-check` | Validar DNS/puertos |
| `make prod-backup-mail` | Backup volúmenes mail |

### Paths en VPS

| Path | Contenido |
|------|-----------|
| `/var/lib/andiko/mail/data` | Buzones |
| `/var/lib/andiko/mail/state` | Estado servicios |
| `/var/lib/andiko/mail/config` | postfix-accounts.cf, DKIM |
| `/root/andiko/infra/mail/docker-mailserver.env` | Env DMS |
| `/var/lib/andiko/certs` | Let's Encrypt |

### Links

- [docker-mailserver docs](https://docker-mailserver.github.io/docker-mailserver/latest/)
- [mail-tester.com](https://www.mail-tester.com)
- [MXToolbox](https://mxtoolbox.com/SuperTool.aspx)

---

## Orden de implementación (resumen)

1. Hostinger: puerto 25 + PTR  
2. DNS: A, MX, SPF, DMARC  
3. `make prod-init-mail`  
4. `make prod-expand-ssl-mail`  
5. `make prod-deploy TAG=…`  
6. `make prod-mail-add-user` (postmaster, erp, equipo)  
7. `make prod-mail-dkim` → DNS DKIM  
8. `make prod-mail-check` + mail-tester  
9. Configurar `/sys-admin/email`  
10. Probar IMAP + envío ERP  
