'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { PageBody } from '@/components/layout'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { PasswordInput } from '@/components/primitives/PasswordInput'
import { FormField } from '@/components/primitives/FormField'
import { Switch } from '@/components/primitives/Switch'
import { Dialog } from '@/components/primitives/Dialog'
import { fetchJson, getApiErrorMessage } from '@/lib/fetch-json'
import type { PublicStorageSettings } from '@/modules/storage/storage-settings.schema'

const ENDPOINT = '/api/v1/sys-admin/storage-settings'

const DROPBOX_AUTHORIZE_URL = '/api/v1/sys-admin/storage-settings/dropbox/authorize'

export function StorageSettingsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form, setForm] = useState<PublicStorageSettings | null>(null)
  const [s3Secret, setS3Secret] = useState('')
  const [gdriveJson, setGdriveJson] = useState('')
  const [dropboxAppSecret, setDropboxAppSecret] = useState('')
  const [dropboxRefreshToken, setDropboxRefreshToken] = useState('')
  const [dropboxAccessToken, setDropboxAccessToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectingDropbox, setConnectingDropbox] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [folderIdHelpOpen, setFolderIdHelpOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deletingTest, setDeletingTest] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [lastTestFile, setLastTestFile] = useState<{
    storage_key: string
    bucket: string
    byte_size: number
    provider: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setServerError(null)
      try {
        const body = await fetchJson<PublicStorageSettings>(ENDPOINT)
        if (cancelled) return
        setForm(body)
        setS3Secret('')
        setGdriveJson('')
        setDropboxAppSecret('')
        setDropboxRefreshToken('')
        setDropboxAccessToken('')
      } catch (e) {
        if (cancelled) return
        setServerError(getApiErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    const oauth = searchParams.get('dropbox_oauth')
    if (!oauth) return
    const msg = searchParams.get('dropbox_oauth_msg')
    void Promise.resolve().then(() => {
      if (oauth === 'success') {
        setSavedMsg('Dropbox conectado — refresh token guardado.')
        setRefresh(r => r + 1)
      } else {
        setServerError(msg ?? 'No se pudo conectar Dropbox.')
      }
      router.replace('/sys-admin/storage')
    })
  }, [searchParams, router])

  function update<K extends keyof PublicStorageSettings>(key: K, value: PublicStorageSettings[K]) {
    setForm(f => (f ? { ...f, [key]: value } : f))
    setSavedMsg(null)
  }

  function validate(f: PublicStorageSettings): Record<string, string> {
    const next: Record<string, string> = {}
    if (!f.enabled) return next

    if (f.provider === 's3') {
      if (!f.s3_bucket.trim()) next.s3_bucket = 'El bucket es obligatorio'
      if (!f.s3_region.trim()) next.s3_region = 'La región es obligatoria'
      if (!f.s3_access_key_id.trim()) next.s3_access_key_id = 'El access key es obligatorio'
      if (!f.has_s3_secret && !s3Secret) next.s3_secret = 'La secret key es obligatoria'
    } else if (f.provider === 'gdrive') {
      if (!f.gdrive_folder_id.trim()) next.gdrive_folder_id = 'El ID de carpeta es obligatorio'
      if (!f.has_gdrive_credentials && !gdriveJson) {
        next.gdrive_json = 'La cuenta de servicio (JSON en base64) es obligatoria'
      }
    } else {
      if (!f.dropbox_app_key.trim()) next.dropbox_app_key = 'El App key es obligatorio'
      const hasAccess = f.has_dropbox_access_token || Boolean(dropboxAccessToken.trim())
      const hasRefresh = f.has_dropbox_refresh_token || Boolean(dropboxRefreshToken.trim())
      if (!hasAccess && !hasRefresh) {
        next.dropbox_auth = 'Necesitás un access token (consola) o un refresh token (OAuth)'
      }
      if (hasRefresh && !hasAccess && !f.has_dropbox_app_secret && !dropboxAppSecret) {
        next.dropbox_app_secret = 'El App secret es obligatorio con refresh token'
      }
      if (!f.dropbox_root_path.trim()) next.dropbox_root_path = 'La ruta raíz es obligatoria'
      if (/^\/Apps\//i.test(f.dropbox_root_path.trim())) {
        next.dropbox_root_path = 'No uses /Apps/… — la API ya apunta a esa carpeta. Usá / o /subcarpeta'
      }
    }
    return next
  }

  async function clearDropboxCredential(kind: 'refresh' | 'access') {
    if (!form) return
    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      const body = await fetchJson<PublicStorageSettings>(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          kind === 'refresh'
            ? { clear_dropbox_refresh_token: true }
            : { clear_dropbox_access_token: true },
        ),
      })
      setForm(body)
      if (kind === 'refresh') setDropboxRefreshToken('')
      else setDropboxAccessToken('')
      setSavedMsg(kind === 'refresh' ? 'Refresh token borrado.' : 'Access token borrado.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function connectDropboxOAuth() {
    if (!form) return
    setErrors({})
    setServerError(null)
    if (!form.dropbox_app_key.trim()) {
      setErrors({ dropbox_app_key: 'El App key es obligatorio' })
      return
    }
    if (!form.has_dropbox_app_secret && !dropboxAppSecret.trim()) {
      setErrors({ dropbox_app_secret: 'El App secret es obligatorio para OAuth' })
      return
    }

    setConnectingDropbox(true)
    try {
      await fetchJson<PublicStorageSettings>(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dropbox_app_key: form.dropbox_app_key.trim(),
          ...(dropboxAppSecret ? { dropbox_app_secret: dropboxAppSecret } : {}),
        }),
      })
      window.location.href = DROPBOX_AUTHORIZE_URL
    } catch (e) {
      setServerError(getApiErrorMessage(e))
      setConnectingDropbox(false)
    }
  }

  async function handleSave() {
    if (!form) return
    const v = validate(form)
    setErrors(v)
    if (Object.keys(v).length > 0) return

    setSaving(true)
    setServerError(null)
    setSavedMsg(null)
    try {
      const body = await fetchJson<PublicStorageSettings>(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: form.enabled,
          provider: form.provider,
          s3_bucket: form.s3_bucket.trim(),
          s3_region: form.s3_region.trim(),
          s3_access_key_id: form.s3_access_key_id.trim(),
          s3_endpoint: form.s3_endpoint.trim(),
          gdrive_folder_id: form.gdrive_folder_id.trim(),
          dropbox_app_key: form.dropbox_app_key.trim(),
          dropbox_root_path: form.dropbox_root_path.trim(),
          ...(s3Secret ? { s3_secret_access_key: s3Secret } : {}),
          ...(gdriveJson ? { gdrive_service_account_json: gdriveJson } : {}),
          ...(dropboxAppSecret ? { dropbox_app_secret: dropboxAppSecret } : {}),
          ...(dropboxRefreshToken ? { dropbox_refresh_token: dropboxRefreshToken } : {}),
          ...(dropboxAccessToken ? { dropbox_access_token: dropboxAccessToken } : {}),
        }),
      })
      setForm(body)
      setS3Secret('')
      setGdriveJson('')
      setDropboxAppSecret('')
      setDropboxRefreshToken('')
      setDropboxAccessToken('')
      setSavedMsg('Configuración guardada.')
      setRefresh(r => r + 1)
    } catch (e) {
      setServerError(getApiErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleStorageTest() {
    setTestError(null)
    setTestMsg(null)
    setTesting(true)
    try {
      const result = await fetchJson<{
        provider: string
        bucket: string
        storage_key: string
        byte_size: number
        checks: { upload: true; download: true; preview: true }
      }>(`${ENDPOINT}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      setLastTestFile({
        storage_key: result.storage_key,
        bucket: result.bucket,
        byte_size: result.byte_size,
        provider: result.provider,
      })
      setTestMsg(
        `Prueba OK (${result.provider}): subida, descarga y vista previa verificadas en «${result.bucket}». Podés eliminar el archivo de prueba cuando quieras.`,
      )
    } catch (e) {
      setTestError(getApiErrorMessage(e))
    } finally {
      setTesting(false)
    }
  }

  async function handleDeleteTestFile() {
    if (!lastTestFile) return
    setTestError(null)
    setTestMsg(null)
    setDeletingTest(true)
    try {
      await fetchJson<{ ok: true; storage_key: string }>(
        `${ENDPOINT}/test?storage_key=${encodeURIComponent(lastTestFile.storage_key)}`,
        { method: 'DELETE' },
      )
      setLastTestFile(null)
      setTestMsg('Archivo de prueba eliminado del backend.')
    } catch (e) {
      setTestError(getApiErrorMessage(e))
    } finally {
      setDeletingTest(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        breadcrumbs={[{ label: 'Sys-admin' }, { label: 'Almacenamiento' }]}
        actions={
          <Button type="button" onClick={handleSave} disabled={loading || saving || !form}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      />

      <PageBody padding="p-6">
        {loading ? (
          <p className="text-sm text-fg-muted">Cargando…</p>
        ) : !form ? (
          <p className="text-sm text-danger">{serverError ?? 'No se pudo cargar la configuración.'}</p>
        ) : (
          <div className="max-w-xl space-y-5">
            <p className="text-[13px] text-fg-muted">
              Backend de archivos <strong>a nivel plataforma</strong> (adjuntos, PDFs, imágenes). Los bytes se
              almacenan en S3 (producción), Dropbox o Google Drive (desarrollo). Las credenciales se guardan cifradas en
              la base de datos, igual que SMTP.
            </p>

            {serverError && <p className="text-sm text-danger">{serverError}</p>}
            {savedMsg && <p className="text-sm text-success">{savedMsg}</p>}

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-fg">Almacenamiento habilitado</p>
                  <p className="text-xs text-fg-muted">Sin esto, las subidas de archivos fallan.</p>
                </div>
                <Switch
                  checked={form.enabled}
                  onCheckedChange={v => update('enabled', v)}
                  aria-label="Habilitar almacenamiento"
                />
              </div>

              <FormField label="Proveedor" error={errors.provider}>
                <select
                  value={form.provider}
                  onChange={e => update('provider', e.target.value as PublicStorageSettings['provider'])}
                  className="h-9 w-full rounded-sm border border-border bg-surface px-3 text-sm"
                >
                  <option value="s3">Amazon S3 / compatible (MinIO, R2)</option>
                  <option value="dropbox">Dropbox (dev/staging)</option>
                  <option value="gdrive">Google Drive (requiere Workspace)</option>
                </select>
              </FormField>
            </section>

            {form.provider === 's3' && (
              <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
                <p className="text-sm font-semibold text-fg">Amazon S3</p>
                <div className="rounded-sm border border-border bg-surface-muted/50 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium text-fg">Pasos de configuración</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-fg-muted">
                    <li>Creá un bucket en AWS (o MinIO / Cloudflare R2).</li>
                    <li>
                      Generá un usuario IAM con permiso de lectura/escritura sobre ese bucket y anotá el{' '}
                      <strong className="text-fg">access key</strong> y la <strong className="text-fg">secret key</strong>.
                    </li>
                    <li>
                      En el bucket, configurá CORS para permitir <code className="text-[11px]">PUT</code> y{' '}
                      <code className="text-[11px]">GET</code> desde el origen de la app (ej.{' '}
                      <code className="text-[11px]">https://tu-dominio.com</code>).
                    </li>
                    <li>Completá los campos abajo, activá el almacenamiento y guardá.</li>
                  </ol>
                </div>
                <FormField label="Bucket" error={errors.s3_bucket}>
                  <Input value={form.s3_bucket} onChange={e => update('s3_bucket', e.target.value)} />
                </FormField>
                <FormField label="Región" error={errors.s3_region}>
                  <Input value={form.s3_region} onChange={e => update('s3_region', e.target.value)} />
                </FormField>
                <FormField label="Access key ID" error={errors.s3_access_key_id}>
                  <Input value={form.s3_access_key_id} onChange={e => update('s3_access_key_id', e.target.value)} />
                </FormField>
                <FormField label="Secret access key" error={errors.s3_secret}>
                  {form.has_s3_secret && (
                    <p className="text-xs text-fg-muted mb-1">Dejá vacío para mantener la clave actual.</p>
                  )}
                  <PasswordInput value={s3Secret} onChange={e => setS3Secret(e.target.value)} autoComplete="new-password" />
                </FormField>
                <FormField label="Endpoint (opcional)">
                  <p className="text-xs text-fg-muted mb-1">MinIO, Cloudflare R2, etc. Dejá vacío para AWS.</p>
                  <Input value={form.s3_endpoint} onChange={e => update('s3_endpoint', e.target.value)} placeholder="https://…" />
                </FormField>
              </section>
            )}

            {form.provider === 'dropbox' && (
              <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
                <p className="text-sm font-semibold text-fg">Dropbox</p>
                <div className="rounded-sm border border-border bg-surface-muted/50 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium text-fg">Pasos de configuración (dev / staging)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-fg-muted">
                    <li>
                      Creá una app en{' '}
                      <a
                        href="https://www.dropbox.com/developers/apps"
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      >
                        Dropbox App Console
                      </a>
                      . <strong className="text-fg">App folder</strong> alcanza para dev; Full Dropbox también
                      funciona.
                    </li>
                    <li>
                      En <strong className="text-fg">Permissions</strong>, activá{' '}
                      <code className="text-[11px]">files.content.read</code>,{' '}
                      <code className="text-[11px]">files.content.write</code> y guardá.
                      <strong className="text-fg"> Después</strong> generá el token — si lo generaste antes de
                      activar permisos, borralo y creá uno nuevo.
                    </li>
                    <li>
                      En la app, agregá esta <strong className="text-fg">Redirect URI</strong> (Settings → Redirect URIs):
                      <pre className="mt-1 rounded-sm bg-surface border border-border px-2 py-1 text-[10px] font-mono text-fg overflow-x-auto whitespace-pre-wrap break-all">
                        {form.dropbox_oauth_redirect_uri || '…'}
                      </pre>
                    </li>
                    <li>
                      Completá App key y App secret abajo, guardá si hace falta, y usá{' '}
                      <strong className="text-fg">Conectar con Dropbox</strong> — la UI obtiene el refresh token sola.
                    </li>
                    <li>
                      <strong className="text-fg">Alternativa rápida (dev):</strong> Generate access token en la consola y
                      pegalo abajo (expira en horas).
                    </li>
                    <li>
                      Definí la <strong className="text-fg">ruta raíz</strong> (ej.{' '}
                      <code className="text-[11px]">/andiko</code>).
                    </li>
                    <li>Activá el almacenamiento, guardá y probá una subida.</li>
                  </ol>
                  <p className="text-xs text-fg-subtle pt-1">
                    OAuth requiere que autorices en Dropbox (login en el navegador). Si hay access token y refresh token
                    guardados, Andiko usa el <strong className="text-fg">access token</strong> primero.
                  </p>
                </div>
                <FormField label="App key" error={errors.dropbox_app_key}>
                  <Input
                    value={form.dropbox_app_key}
                    onChange={e => update('dropbox_app_key', e.target.value)}
                    placeholder="xxxxxxxxxxxxxxx"
                  />
                </FormField>
                <FormField label="App secret (OAuth)" error={errors.dropbox_app_secret}>
                  {form.has_dropbox_app_secret && (
                    <p className="text-xs text-fg-muted mb-1">Dejá vacío para mantener el secret actual.</p>
                  )}
                  <PasswordInput
                    value={dropboxAppSecret}
                    onChange={e => setDropboxAppSecret(e.target.value)}
                    autoComplete="new-password"
                  />
                </FormField>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving || connectingDropbox}
                    onClick={() => void connectDropboxOAuth()}
                  >
                    {connectingDropbox ? 'Redirigiendo…' : 'Conectar con Dropbox (OAuth)'}
                  </Button>
                  {form.has_dropbox_refresh_token && (
                    <span className="text-xs text-success">Refresh token conectado</span>
                  )}
                </div>
                <FormField label="Access token (Generate, solo dev)" error={errors.dropbox_auth}>
                  {form.has_dropbox_access_token && (
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-fg-muted">Hay un access token guardado.</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={saving}
                        onClick={() => void clearDropboxCredential('access')}
                      >
                        Borrar guardado
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-fg-muted mb-1">
                    App Console → Settings → Generate access token. No requiere App secret.
                  </p>
                  <PasswordInput
                    value={dropboxAccessToken}
                    onChange={e => setDropboxAccessToken(e.target.value)}
                    autoComplete="new-password"
                  />
                </FormField>
                <FormField label="Refresh token (manual)" error={errors.dropbox_refresh_token}>
                  {form.has_dropbox_refresh_token && (
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-fg-muted">Hay un refresh token guardado.</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        disabled={saving}
                        onClick={() => void clearDropboxCredential('refresh')}
                      >
                        Borrar guardado
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-fg-muted mb-1">
                    Opcional si usaste «Conectar con Dropbox». Pegá aquí solo si generaste el token manualmente.
                  </p>
                  <PasswordInput
                    value={dropboxRefreshToken}
                    onChange={e => setDropboxRefreshToken(e.target.value)}
                    autoComplete="new-password"
                  />
                </FormField>
                <FormField label="Ruta raíz (API)" error={errors.dropbox_root_path}>
                  <p className="text-xs text-fg-muted mb-1">
                    Con <strong className="text-fg">App folder</strong>, Dropbox ya te da la carpeta{' '}
                    <code className="text-[11px]">Apps/andiko</code> en la web. En la API usá paths{' '}
                    <strong className="text-fg">relativos</strong> a esa carpeta — no pongas{' '}
                    <code className="text-[11px]">/Apps/andiko</code> acá. Usá{' '}
                    <code className="text-[11px]">/</code> para la raíz o{' '}
                    <code className="text-[11px]">/storage</code> para una subcarpeta.
                  </p>
                  <Input
                    value={form.dropbox_root_path}
                    onChange={e => update('dropbox_root_path', e.target.value)}
                    placeholder="/"
                  />
                </FormField>
              </section>
            )}

            {form.provider === 'gdrive' && (
              <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
                <p className="text-sm font-semibold text-fg">Google Drive</p>
                <div className="rounded-sm border border-border bg-surface-muted/50 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium text-fg">Pasos de configuración (dev / staging)</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-fg-muted">
                    <li>
                      En{' '}
                      <a
                        href="https://console.cloud.google.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      >
                        Google Cloud Console
                      </a>
                      , creá un proyecto (o usá uno existente).
                    </li>
                    <li>
                      Activá la{' '}
                      <a
                        href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      >
                        Google Drive API
                      </a>
                      .
                    </li>
                    <li>
                      En <strong className="text-fg">IAM → Cuentas de servicio</strong>, creá una cuenta y
                      descargá la clave JSON (<em>Agregar clave → JSON</em>).
                    </li>
                    <li>
                      Codificá el archivo en base64 y pegalo abajo:
                      <pre className="mt-1 rounded-sm bg-surface border border-border px-2 py-1 text-[11px] font-mono text-fg overflow-x-auto">
                        base64 -i service-account.json | tr -d &apos;\n&apos;
                      </pre>
                      <span className="block mt-1">
                        Anotá el email de la cuenta (termina en{' '}
                        <code className="text-[11px]">@…iam.gserviceaccount.com</code>).
                      </span>
                    </li>
                    <li>
                      En Google Drive, creá una <strong className="text-fg">Unidad compartida</strong>{' '}
                      (Shared Drive — requiere Google Workspace). Agregá la cuenta de servicio como miembro con rol{' '}
                      <strong className="text-fg">Gestor de contenido</strong> (o superior).
                    </li>
                    <li>
                      Dentro de esa unidad, creá una carpeta para Andiko (ej. <em>andiko-storage</em>).
                    </li>
                    <li>
                      Copiá el <strong className="text-fg">ID de carpeta</strong> (ver{' '}
                      <button
                        type="button"
                        className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                        onClick={() => setFolderIdHelpOpen(true)}
                      >
                        cómo obtenerlo
                      </button>
                      ).
                    </li>
                    <li>Completá los campos abajo, activá el almacenamiento, guardá y probá una subida.</li>
                  </ol>
                  <p className="text-xs text-fg-subtle pt-1">
                    Las cuentas de servicio <strong className="text-fg">no tienen cuota</strong> en «Mi unidad»:
                    compartir una carpeta personal no alcanza y Google responde 403. Usá una Unidad compartida o, en
                    local, S3/MinIO. Los archivos pasan por el servidor (solo dev/staging).
                  </p>
                </div>
                <FormField label="ID de carpeta" error={errors.gdrive_folder_id}>
                  <p className="text-xs text-fg-muted mb-1">
                    <button
                      type="button"
                      className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                      onClick={() => setFolderIdHelpOpen(true)}
                    >
                      ¿Cómo obtengo el ID de carpeta?
                    </button>
                  </p>
                  <Input
                    value={form.gdrive_folder_id}
                    onChange={e => update('gdrive_folder_id', e.target.value)}
                    placeholder="ID de carpeta dentro de la Unidad compartida"
                  />
                </FormField>
                <FormField
                  label="Cuenta de servicio (JSON en base64)"
                  error={errors.gdrive_json}
                >
                  <p className="text-xs text-fg-muted mb-1">
                    {form.has_gdrive_credentials
                      ? 'Dejá vacío para mantener las credenciales actuales.'
                      : 'Pegá aquí la salida del comando base64 (una sola línea).'}
                  </p>
                  <textarea
                    value={gdriveJson}
                    onChange={e => setGdriveJson(e.target.value)}
                    rows={4}
                    className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm font-mono"
                  />
                </FormField>
              </section>
            )}

            <section className="rounded-sm border border-border bg-surface p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-fg">Probar configuración</h2>
                <p className="mt-1 text-xs text-fg-muted">
                  Sube un archivo de prueba con la configuración <strong>guardada</strong>, verifica
                  que el backend responde y dejalo en el bucket hasta que lo elimines. No crea adjuntos en el ERP.
                  Guardá los cambios antes de probar.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleStorageTest()}
                  disabled={testing || deletingTest || saving || !form.enabled}
                >
                  {testing ? 'Probando…' : 'Ejecutar prueba de almacenamiento'}
                </Button>

                {lastTestFile ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleDeleteTestFile()}
                    disabled={testing || deletingTest || saving}
                  >
                    {deletingTest ? 'Eliminando…' : 'Eliminar archivo de prueba'}
                  </Button>
                ) : null}
              </div>

              {lastTestFile ? (
                <p className="text-xs text-fg-muted font-mono break-all">
                  Archivo: {lastTestFile.storage_key} ({lastTestFile.byte_size} bytes)
                </p>
              ) : null}

              {!form.enabled ? (
                <p className="text-xs text-fg-subtle">Activá el almacenamiento para habilitar la prueba.</p>
              ) : null}

              {testError ? <p className="text-sm text-danger">{testError}</p> : null}
              {testMsg ? <p className="text-sm text-success">{testMsg}</p> : null}
            </section>
          </div>
        )}
      </PageBody>

      <Dialog
        open={folderIdHelpOpen}
        onOpenChange={setFolderIdHelpOpen}
        title="ID de carpeta de Google Drive"
        description="Carpeta destino dentro de una Unidad compartida (Shared Drive)."
        size="md"
      >
        <p className="text-[13px] text-fg-muted mb-3">
          La carpeta debe estar <strong className="text-fg">dentro de una Unidad compartida</strong>, no en «Mi
          unidad». Las cuentas de servicio no tienen cuota propia en Drive personal.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-[13px] text-fg-muted">
          <li>
            En Drive, andá a <strong className="text-fg">Unidades compartidas</strong> y abrí la unidad donde
            agregaste la cuenta de servicio.
          </li>
          <li>Abrí (o creá) la subcarpeta donde guardará Andiko.</li>
          <li>Mirá la barra de direcciones. La URL tiene esta forma:</li>
        </ol>

        <pre className="mt-3 rounded-sm border border-border bg-surface-muted px-3 py-2 text-[11px] font-mono text-fg overflow-x-auto leading-relaxed">
          https://drive.google.com/drive/folders/
          <span className="rounded-sm bg-brand-100 px-1 text-brand-800">1a2b3c4d5e6f7g8h9i0jKLMNOP</span>
        </pre>

        <p className="mt-3 text-[13px] text-fg-muted">
          El <strong className="text-fg">ID de carpeta</strong> es el código resaltado: todo lo que va{' '}
          <strong className="text-fg">después de</strong> <code className="text-[12px]">/folders/</code>, sin
          barras ni parámetros extra.
        </p>

        <ul className="mt-4 space-y-2 text-xs text-fg-subtle list-disc list-inside">
          <li>Tiene que ser una carpeta, no un archivo (en archivos la URL usa <code>/file/d/</code>).</li>
          <li>Compartir una carpeta de «Mi unidad» con la cuenta de servicio no funciona para subir archivos.</li>
          <li>La cuenta de servicio debe ser <strong className="text-fg">miembro</strong> de la Unidad compartida.</li>
        </ul>

        <div className="mt-5 flex justify-end">
          <Button type="button" size="sm" onClick={() => setFolderIdHelpOpen(false)}>
            Entendido
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
