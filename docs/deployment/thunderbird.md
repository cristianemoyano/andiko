# Thunderbird — buzón @andiko.cloud

Guía para leer y enviar correo con [Thunderbird](https://www.thunderbird.net/) contra el mailserver de Andiko (`mail.andiko.cloud`).

**Prerrequisito:** buzón creado en el VPS:

```bash
make prod-mail-add-user EMAIL=tu@andiko.cloud PASSWORD='contraseña-segura'
```

---

## Datos de conexión

| | Entrante (IMAP) | Saliente (SMTP) |
|--|-----------------|-----------------|
| Servidor | `mail.andiko.cloud` | `mail.andiko.cloud` |
| Puerto | `993` | `587` (recomendado) o `465` |
| Seguridad | **SSL/TLS** | **STARTTLS** (587) o **SSL/TLS** (465) |
| Autenticación | Contraseña normal | Contraseña normal |
| Usuario | `tu@andiko.cloud` | `tu@andiko.cloud` |

El usuario es siempre el **email completo**, no solo la parte local (`cristian.moyano` sin dominio).

---

## Configuración paso a paso

### 1. Nueva cuenta

1. Abrir Thunderbird → **Cuenta** → **Configurar una cuenta de correo existente…**
2. Nombre para mostrar, dirección `tu@andiko.cloud`, contraseña del buzón.
3. Si el autodetect falla (común en dominios propios), elegir **Configurar manualmente** o **Editar**.

### 2. Servidor entrante (IMAP)

| Campo | Valor |
|-------|-------|
| Protocolo | IMAP |
| Servidor | `mail.andiko.cloud` |
| Puerto | `993` |
| Seguridad | SSL/TLS |
| Usuario | `tu@andiko.cloud` |

### 3. Servidor saliente (SMTP)

| Campo | Valor |
|-------|-------|
| Protocolo | SMTP |
| Servidor | `mail.andiko.cloud` |
| Puerto | `587` |
| Seguridad | STARTTLS |
| Usuario | `tu@andiko.cloud` |

**Alternativa:** puerto `465` con seguridad **SSL/TLS** (no dejar en Autodetectar).

### 4. Probar y terminar

1. Clic en **Probar** en la pantalla de SMTP (o IMAP).
2. Si ambos pasan → **Continuar** / **Listo**.

---

## Errores frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| Host inválido `.andiko.cloud` | Falta el prefijo `mail.` | Servidor: `mail.andiko.cloud` |
| Login fallido | Usuario sin `@andiko.cloud` | Usuario = email completo |
| Certificado / TLS | Puerto y seguridad no coinciden | 993+SSL (IMAP), 587+STARTTLS (SMTP) |
| Buzón inexistente | Cuenta no creada en el servidor | `make prod-mail-add-user` |
| No llega mail entrante | DNS MX / puerto 25 | `make prod-mail-check` |

---

## Probar end-to-end

1. **Entrante:** enviar un mail desde Gmail a `tu@andiko.cloud` → debe aparecer en Thunderbird.
2. **Saliente:** responder desde Thunderbird a una dirección externa → debe llegar al inbox (revisar spam la primera vez).

Más contexto del servidor: [mail-server.md](mail-server.md).
