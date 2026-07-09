# AWS S3 file storage

Andiko stores ERP attachments (supplier invoices, receipts, product files, etc.) in **AWS S3** using presigned URLs. Bytes never pass through the VPS — the browser uploads directly to S3.

Infrastructure is managed with Terraform: [`infra/terraform/aws-storage/`](../../infra/terraform/aws-storage/).

## Architecture

```
Browser (andiko.cloud)
  → POST /api/v1/files          (initiate — app returns presigned PUT URL)
  → PUT  https://bucket.s3...   (direct upload to S3)
  → POST /api/v1/files/:id/complete

App (S3StorageAdapter)
  → presign PutObject / GetObject / HeadObject / DeleteObject
```

Object keys are human-readable paths, e.g.:

`{orgSlug}/suc-001/compras/facturas-proveedor/2026/07/08/FAC-001__abc123__factura.pdf`

See `src/modules/storage/storage-path.service.ts`.

## Prerequisites

| Step | Where |
|------|--------|
| AWS account (free tier OK) | [aws.amazon.com](https://aws.amazon.com) |
| Terraform >= 1.9 + AWS CLI | Local machine |
| Billing alerts enabled | AWS Console → Billing → Billing preferences |
| Local tfstate | `terraform.tfstate` gitignored (IAM secret; GitHub push protection) |

| AWS CLI profile `andiko-prod` | `aws configure --profile andiko-prod` (default in `providers.tf`) |

Default budget alert email: **cristianmoyano.mza@gmail.com** (override in `terraform.tfvars`).

Verify profile (no export needed for Terraform):

```bash
aws sts get-caller-identity --profile andiko-prod --no-cli-pager
```

## Provision infrastructure

```bash
cd infra/terraform/aws-storage
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
aws_region  = "sa-east-1"
bucket_name = "andiko-erp-cloud-files-prod"   # prefix; full name adds -{account}-{region}-an
alert_email = "cristianmoyano.mza@gmail.com"
budget_limit_usd = "5"
cors_allowed_origins = ["https://andiko.cloud"]
```

The bucket uses **account-regional namespace** (AWS, March 2026): the name is reserved for your account in `sa-east-1` — no global collision with other AWS accounts. Full name example: `andiko-erp-cloud-files-prod-074395401221-sa-east-1-an`.

Apply (from repo root):

```bash
make aws-storage-plan    # terraform plan -out=tfplan
make aws-storage-apply   # terraform apply tfplan (exact saved plan)
make aws-storage-outputs # bucket/region/keys for sys-admin
```

Or from `infra/terraform/aws-storage/`:

```bash
./scripts/deploy.sh plan
./scripts/deploy.sh apply
```

Manual:

```bash
terraform init -upgrade
terraform plan -out=tfplan
terraform apply tfplan
```

`tfplan` is gitignored. Profile `andiko-prod` is set in `providers.tf` — no `export AWS_PROFILE` needed.

Commit `.terraform.lock.hcl` after provider upgrades. Keep `terraform.tfstate` local (gitignored).

## Configure the ERP

1. Open **https://andiko.cloud/sys-admin/storage** (sys-admin role).
2. Enable storage, provider **S3**.
3. Paste outputs from `terraform output` (bucket, region, access key, secret).
4. Leave **Endpoint** empty for native AWS S3.
5. Save.

Credentials are encrypted at rest in `platform_settings` (`s3_secret_access_key_encrypted`).

## Smoke test

1. In **Compras → Factura proveedor**, attach a PDF.
2. In AWS Console → S3 → bucket → verify object under `{orgSlug}/...`.
3. Download or preview the file in the ERP.
4. Confirm bucket is not public: anonymous GET to object URL returns 403.

## Billing and costs

| Item | Cost |
|------|------|
| AWS Budget (email alerts, no actions) | $0 |
| S3 storage (free tier) | 5 GB / month (new accounts, year 1) |
| S3 requests | 20k GET, 2k PUT / month (free tier) |
| Budget alert at $5 | Email when account spend exceeds threshold |

S3 usage grows with real attachments — not with Terraform state (state is local in git).

## CORS

Required because uploads use browser `fetch(PUT)` to the presigned S3 URL. Default origin: `https://andiko.cloud`.

If uploads fail with a CORS error:

1. Check DevTools → Network on the failed PUT.
2. Add missing origin to `cors_allowed_origins` in `terraform.tfvars`.
3. `terraform apply`.

If uploads fail with **HTTP 403** (not CORS):

1. Confirm bucket name in sys-admin matches Terraform output (`make aws-storage-outputs`) — includes `-{account}-{region}-an` suffix.
2. Confirm IAM user `andiko-storage` access key + secret (not root credentials).
3. The app disables SDK default checksum signing on presigned URLs (`requestChecksumCalculation: WHEN_REQUIRED` in `s3.adapter.ts`). If you run an old image without that fix, upgrade the app release.

## Sys-admin storage test

`/sys-admin/storage` → **Ejecutar prueba de almacenamiento** uploads via server-side `PutObject` (not browser CORS). A 403 here usually means wrong bucket/credentials or an outdated app image with broken presigned PUT signing.

## IAM permissions

The `andiko-storage` IAM user can only:

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject`
- On `arn:aws:s3:::BUCKET_NAME/*` only

No `ListBucket`, no other AWS services.

## Rotate access key

If the secret is compromised or you need rotation:

```bash
cd infra/terraform/aws-storage
terraform taint aws_iam_access_key.storage
terraform apply
terraform output -raw secret_access_key
```

Update `/sys-admin/storage` with the new secret. Re-run `make aws-storage-outputs`.

## Related

- Terraform module: [`infra/terraform/aws-storage/README.md`](../../infra/terraform/aws-storage/README.md)
- App adapter: `src/lib/storage/s3.adapter.ts`
- Sys-admin UI: `src/app/(erp)/sys-admin/storage/`
