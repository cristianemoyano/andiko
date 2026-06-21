import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// env.ts validates process.env at import time; satisfy it before dynamic imports.
process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db'
process.env.AUTH_SECRET ??= 'test-secret-at-least-32-characters-long'

vi.mock('@/lib/db', () => ({ default: { transaction: vi.fn((cb) => cb({})) } }))
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }))
vi.mock('./afip-credential.model', () => ({
  default: { create: vi.fn(), update: vi.fn(), findOne: vi.fn(), findAll: vi.fn() },
}))

// Self-signed test certificate + its matching private key, plus an unrelated key.
const CERT = `-----BEGIN CERTIFICATE-----
MIIDNTCCAh2gAwIBAgIUPCaNFY3wkZG5Ng2FCj+xUekMRtkwDQYJKoZIhvcNAQEL
BQAwKjENMAsGA1UEAwwEVGVzdDEZMBcGA1UEBRMQQ1VJVCAzMDExMTExMTExODAe
Fw0yNjA2MjAyMTM5MzFaFw0zNjA2MTcyMTM5MzFaMCoxDTALBgNVBAMMBFRlc3Qx
GTAXBgNVBAUTEENVSVQgMzAxMTExMTExMTgwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQDF7IulsMbSbZmtCHyksMxU34O/8oNqdd83RnRz9SGdKsmwrh/6
29GQ7evmZ06ocq1XpC1W4qM8HIefCwlSpcvWBuqQv3Grs9cacsiCBczYHk8o6yBk
HqwVPSRlkIuYxy7Eyyhm/ZxR6SS3fLp0q1/z/DqXAH6J3T9ENLxH4RHcQc7eiHEv
LMOe6ZYCmE3UHDCds9dd31kfh1xlDuFr5XEHqW6sLxTtVsfKEyXP5HO0rvpDdjjC
+UqZwDFHVnest+CUPtYAdTOzR/SoXAfKnzmw6oe29QxnqJKb3j9xlFa1U4nbA8Pz
qMA3r/7W7qQ8irUUHqfcegKRHPEk49Bpis/hAgMBAAGjUzBRMB0GA1UdDgQWBBT9
Q4t3gNZOnPb/d5kKWa72yN/CzjAfBgNVHSMEGDAWgBT9Q4t3gNZOnPb/d5kKWa72
yN/CzjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAUPpzvpRPK
zgAE8Ih+IU01iFUHJ1fOAB1j0UuDLm7cP0MfEuQIpUdM6It791mLMBl8iOBFZ2Nn
Kfin9+Mbi9vhXbj6sJL6arL+oIUG2djER7g9DUz6U1CwpqfoljsY9+RkMnHpdb7s
Hj+v1XOjWjRSW5G38sfv591SohmUvPxgmojp0VYUYKp5SGj8ZDHnyx0MO/KDt5nh
BNPTfQSYsCnZ+7AEPQjpqZW07DD8oH0awoze+k2mIJ3lBtlvnPNMxqObwBiB5lvK
xkUSUtsas9FNm6uGryUrhiDG6sJ3U7fluifbchFICuN8tfxU4hU10ITPEDdMf3Zm
EmB4qoOqF3v/
-----END CERTIFICATE-----`

const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDF7IulsMbSbZmt
CHyksMxU34O/8oNqdd83RnRz9SGdKsmwrh/629GQ7evmZ06ocq1XpC1W4qM8HIef
CwlSpcvWBuqQv3Grs9cacsiCBczYHk8o6yBkHqwVPSRlkIuYxy7Eyyhm/ZxR6SS3
fLp0q1/z/DqXAH6J3T9ENLxH4RHcQc7eiHEvLMOe6ZYCmE3UHDCds9dd31kfh1xl
DuFr5XEHqW6sLxTtVsfKEyXP5HO0rvpDdjjC+UqZwDFHVnest+CUPtYAdTOzR/So
XAfKnzmw6oe29QxnqJKb3j9xlFa1U4nbA8PzqMA3r/7W7qQ8irUUHqfcegKRHPEk
49Bpis/hAgMBAAECggEAExQqCSiRBQgwAyAvtUeebfDQNQWK9qbMHWDuQtGpxT1M
DRSL3DuqTnhdmZ6/VB+FAOjAWIEnHD+uMLEr233d60PmNcCU+k8vEf6a82WpvFkX
mlzBiSuOI2UuB/62zJBbiSubbNCC0nNRHCeqzypIT2Jl9D5fWqmRuq2dF9sYEXO4
td2DozYsjSCZp4A000ntnfLBVn6XrEWNYr5af6JJyhcUC89fj2vj3sTSvvPOnNmv
O6cIZV5pE6nI37h/tpxI+C/DfNauoJTfgNPm77rwa/mttsKAuPq7HtiMkEpYo7Fy
MhmP9hlCuScu0K+GIGLKP+bDVieH3p6sgwPIHxCfXQKBgQDl14+ky8s85r3yXFvX
zGajxRzd231x/ZS+hZyo4RkzOjpixmuul+RizTjJKjTwoBgfbR0U/YNSAzCAyj1c
ResBdCSmj54+1dTJR/6x6hcUMyw0k8E2X+LmT+lk59gI/0QkZUwoUEm/gy0mMMYP
PwVcrQMNoUuPUWvIPRcVNOF+vwKBgQDccw3G66zw6O4BJ/jfJqmbmfd019UBdjwK
wyngo+PjwuD7yDBVukhBRLJL1MZ1I2BQy1CvRpdV+XWQDtHj+lYj12YMqfInIqKB
ReL7VMf43NSmOWyz4/Ss+Gc/7MsrlMNSrPGT40AsBg4oVKlACJAO4+0e/OUWHNxa
GtrcNKv5XwKBgQDIQo+n2OFWSP3Lg+mKF1B+9Sn3rFyay4Wkkyoygx6/4cYpdhUw
5Ktb4s/Nhvblibg6+YlTVqfq91h1fsED+u+OLrIYZh5NRWbHkfE692nwcb3cebjp
NZavcYU8JD25aSDoTVKT9ZCsSxE1q12GvzRe0WhNofICB8FPkNrh4VdwZQKBgQDB
62upGlPtL9l9pt3j3qzANfZaECpNuOYkSX2jIEgtaJZkpbrvDojU8UsuLaPOEyp8
p/z30k750BE8gezccLApoycf6Lcc+fidYw7CK9gk8I0XE9itfc8UAQdCUlh+o8QW
DBAOGY+vqjv1+lNQArhGgPVrlucmRokHsivoHWVSXQKBgBEpLehdUsGyUWI5t13J
VFjtcOiySHoJkXWikScWAxpXIMkqtiFk1Kno7d0RFi2w9eFugdRj4Br9vNUnuX6n
YXg0I7veQlgcVb0iyr2gUpCgVlsufqV9dbqWkBA5/VOvA+f4Ssr2auZ3fzz6jrS3
p/FVnGGx32uIgC0K5vaoT2oj
-----END PRIVATE KEY-----`

const OTHER_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDFCL6EDENEXkNf
C0HonlYU1/5BFXSTRsiUCjrRSvqZ0J71c1X/X0DX6zE18FxO2QAWTDSEwBgKzRSL
DChVb7geURfQIgrhYFKSaLlVT2OKgXcnZ0IPS0e7R3jIwXRhp8SNDlzcCrRkmY6o
o4JaWVChr+Pp3eVWba/Nhn2JoiMJrIg+jzvJgutyBdWvBSg/cybTVwxiDufjo5ML
ou3uFBE4T4G608w6Wc+wbSbxuNaxUdXESMnVrwOSXsngLEqjquKyGX4xMwwSv4YI
tbA11X63pZ79nIjq7pV1PVHY/vjIElcDPESVnmKeWu2zmMB1RXzhfDzPNHL0ZIuh
iG09CWenAgMBAAECggEAECYw00rcApEFTZdzHflITeoMJVJ4XQ/apcOW4YuXMZ83
QB/lZwpsGqZkwKqELlQ73Rf+3/iMn+oCKoljDumauiVkYcNAiAtoiSZ7NkJNAs+s
r/aXJADEDtYDUNUGUHC7O+J2+vQHqA0r86d/Kh+S68WqVQNCZkyUMbC5vlujKoos
R56N00PkAniMjkF6Xic2Wf7jT15lNnvRddOsiD/Lj3S+Pg+lsRzhS5HR3ZmKUPzR
4HVsY6hVhNamyQO79rWw3EOfd9yltfmLBfoXRReKET9M2vdyIKysCdrOPFMskZJn
V98wcEf/kFilzQ4CDeh2xHRZqL5wxhwTKbi20EjsJQKBgQDlU8w5SvdqPNpcMlvY
JVcMsgiL7Qws89w9nccWnQY4PI1ONb1iqWCNpYwK2L9MXSqCZLHaLGaX8H8UF4ys
w+Kz2d1VP5hT1vvf0mB0KKg5nX8CJZHwMYCPShZtRwPH3zI5fXm71YGFNmFiH3Zg
bPPyngJNo6bjbV2osiR2GO32HQKBgQDb82t2gTo1lF2iYzvVnL02gEeNhvfiSOxX
8rm5V8Imgzb0yUTYDRkTH+pPnuafrbjb1N0rOygBAtPutFHi0MMUg+c+lOb4crPy
G6+n2OdxJjDm8Nt7MaKbB61hz8yV71WldNz+chMBwOVzMQNFwKmU5TmjDeeEHFl9
gLVdfRlZkwKBgQDZQGeqpzB4vqmGylZkEAvFhSu/k5QDSgqNfNlMvPlVcVfUjeia
fSdxSTHAXNHtgB1zZf1vWLzgl/9rg1vLl88+3thlmFewpWv8AAtMP/AOlPvrhrgY
umy2UlOotqwIP5QPDqWyonOPRZNAJ9o3Q0Bfyf0YnD7QGZ2u4QTVtIxKqQKBgQCe
e7j0/Ixqyurk9UfJ1VRpDul/yr6WKCFUBatZJyjYAzf4DYYzfsyQgTCeCkr2x4Ap
tile2xMqF1WJ7BgMrIvEHn7jEvuSDWQnkVdyQ9IQL4qQ/P/Itq0Js/B0R/yMFJXL
0HbkSGH1o34xECHhgr8ucDSljoFBKgQ5cCI+qMM5TQKBgFEtFS5j2H2zw8rp1Hlp
elMPzkBk3t6lTo3raubp+zeysCmWxpptGPti7VlVCID0JlcvqSnuyxF0gTjXn+04
Osr5Tv2tlnl5dxTglu7LLKuTlbd0mzKORcowTFgti5hag1KH8A6iyiNb8BDKYBGg
Ob/EvnY6pSp0L3mEiFt9/sg7
-----END PRIVATE KEY-----`

let svc: typeof import('./afip-credentials.service')
let crypto: typeof import('@/lib/crypto')
let Model: { create: Mock; update: Mock; findOne: Mock; findAll: Mock }

beforeAll(async () => {
  svc = await import('./afip-credentials.service')
  crypto = await import('@/lib/crypto')
  Model = (await import('./afip-credential.model')).default as unknown as typeof Model
})
beforeEach(() => vi.clearAllMocks())

const ctx = { orgId: 'org-1', userId: 'u-1', defaultBranchId: null, allowedBranchIds: [] }

describe('uploadCredentials', () => {
  it('encrypts the key, deactivates the prior credential and stores the new one', async () => {
    Model.update.mockResolvedValue([1])
    Model.create.mockImplementation(async (vals: Record<string, unknown>) => vals)

    const status = await svc.uploadCredentials('org-1', { environment: 'homologacion', cuit: '30111111118', cert: CERT, key: KEY }, 'u-1')

    expect(Model.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_active: false }),
      expect.objectContaining({ where: expect.objectContaining({ org_id: 'org-1', environment: 'homologacion', is_active: true }) }),
    )
    const created = Model.create.mock.calls[0][0]
    expect(created.cert_pem).toBe(CERT)
    expect(created.key_encrypted).not.toContain('PRIVATE KEY')
    expect(crypto.decryptSecret(created.key_encrypted)).toBe(KEY)
    expect(created.expires_at).toBeInstanceOf(Date)
    expect(status).toMatchObject({ environment: 'homologacion', cuit: '30111111118', is_active: true })
    expect(status).not.toHaveProperty('key_encrypted')
    expect(status).not.toHaveProperty('cert_pem')
  })

  it('rejects a private key that does not match the certificate', async () => {
    await expect(svc.uploadCredentials('org-1', { environment: 'homologacion', cuit: '30111111118', cert: CERT, key: OTHER_KEY }, 'u-1')).rejects.toThrow('AFIP_KEY_MISMATCH')
  })

  it('rejects an invalid certificate', async () => {
    await expect(svc.uploadCredentials('org-1', { environment: 'homologacion', cuit: '30111111118', cert: 'not a cert', key: KEY }, 'u-1')).rejects.toThrow('AFIP_INVALID_CERT')
  })

  it('rejects an invalid private key', async () => {
    await expect(svc.uploadCredentials('org-1', { environment: 'homologacion', cuit: '30111111118', cert: CERT, key: 'not a key' }, 'u-1')).rejects.toThrow('AFIP_INVALID_KEY')
  })
})

describe('getCredentialStatus', () => {
  it('returns redacted metadata without cert or key', async () => {
    Model.findAll.mockResolvedValue([
      { environment: 'produccion', cuit: '30111111118', label: 'prod', expires_at: null, is_active: true, cert_pem: 'SECRET', key_encrypted: 'SECRET' },
    ])
    const status = await svc.getCredentialStatus(ctx)
    expect(status).toEqual([{ environment: 'produccion', cuit: '30111111118', label: 'prod', expires_at: null, is_active: true }])
    expect(JSON.stringify(status)).not.toContain('SECRET')
  })
})

describe('getResolvedCredentials', () => {
  it('decrypts the key and flags production for the produccion environment', async () => {
    Model.findOne.mockResolvedValue({ cuit: '30111111118', cert_pem: CERT, key_encrypted: crypto.encryptSecret(KEY), environment: 'produccion' })
    const resolved = await svc.getResolvedCredentials('org-1', 'produccion')
    expect(resolved).toEqual({ cuit: '30111111118', cert: CERT, key: KEY, production: true })
  })

  it('returns null when no active credential exists', async () => {
    Model.findOne.mockResolvedValue(null)
    expect(await svc.getResolvedCredentials('org-1', 'homologacion')).toBeNull()
  })
})

describe('deleteCredentials', () => {
  it('throws when no credential exists', async () => {
    Model.findOne.mockResolvedValue(null)
    await expect(svc.deleteCredentials('org-1', 'homologacion', 'u-1')).rejects.toThrow('AFIP_CREDENTIAL_NOT_FOUND')
  })
})
