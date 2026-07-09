# AWS S3 storage (Terraform)

Provisions the **private S3 bucket**, **IAM user**, **CORS** (browser presigned uploads), and **cost budget alerts** for Andiko file attachments.

The ERP app reads credentials from **sys-admin** (`/sys-admin/storage`) — this module only creates AWS resources.

## Prerequisites

1. [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9 (use latest stable — `brew install hashicorp/tap/terraform`)
2. [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) with profile **`andiko-prod`**:

```bash
aws configure --profile andiko-prod
aws sts get-caller-identity --profile andiko-prod --no-cli-pager
```

Terraform uses profile **`andiko-prod` by default** (`aws_profile` in `variables.tf` / `providers.tf`). No need to `export AWS_PROFILE` when using `make aws-storage-plan` or `./scripts/deploy.sh`.
3. IAM permissions to create S3, IAM users, and Budgets in your account
4. **One-time (console):** Billing → Billing preferences → enable **Receive Billing Alerts** and confirm your email

**Version policy:** keep `versions.tf` on the latest stable AWS provider (`~> 6.53` or newer). After bumps run `terraform init -upgrade` and commit `.terraform.lock.hcl`.

**Deploy skill:** `.cursor/skills/terraform-aws-storage/SKILL.md` — agent workflow for plan/apply.

## Quick start

```bash
cd infra/terraform/aws-storage
cp terraform.tfvars.example terraform.tfvars
# Edit bucket_name (globally unique) if needed — alert_email defaults to cristianmoyano.mza@gmail.com

./scripts/deploy.sh plan
./scripts/deploy.sh apply
```

Or manually:

After apply:

```bash
terraform output bucket_name
terraform output aws_region
terraform output access_key_id
terraform output -raw secret_access_key
```

Configure **https://andiko.cloud/sys-admin/storage**:

| Field | Value |
|-------|--------|
| Habilitar storage | On |
| Provider | S3 |
| Bucket | `terraform output bucket_name` |
| Región | `sa-east-1` |
| Access Key ID | from output |
| Secret | from output (once) |
| Endpoint | *(empty — native AWS)* |

## State

- **Local backend** — `terraform.tfstate` stays on disk (gitignored; GitHub blocks AWS keys in pushes).
- `terraform.tfvars` is gitignored (local email/bucket overrides).
- `.terraform/` provider cache is gitignored.
- `.terraform.lock.hcl` is committed.

## What gets created

| Resource | Purpose |
|----------|---------|
| S3 bucket (account-regional namespace) | ERP attachments; name reserved to your account + region |
| Public access block | Bucket fully private |
| SSE-S3 (AES256) | Encryption at rest |
| CORS | Browser `PUT` to presigned URLs from `https://andiko.cloud` |
| IAM user `andiko-storage` | App credentials (Put/Get/Delete/Head on `bucket/*` only) |
| AWS Budget | Monthly cost alert at 80% / 100% actual + 80% forecasted |

## Costs

- **AWS Budgets** (email alerts only, no actions): **$0**
- **S3**: free tier includes 5 GB storage (new accounts, first year); then pay per GB/request
- **Terraform state**: local file in git — **$0** S3 cost for state

## Troubleshooting

### Upload fails from browser (CORS)

Symptom: `La subida al almacenamiento falló` or CORS error in DevTools.

- Confirm `cors_allowed_origins` includes `https://andiko.cloud` (exact scheme + host).
- After changing CORS: `terraform apply`.
- For Vercel previews, add preview origin to `cors_allowed_origins` in `terraform.tfvars`.

### Budget alerts not received

- Enable **Receive Billing Alerts** in Billing preferences (console, one-time).
- Confirm `alert_email` matches a verified billing contact.
- Budget alerts are **free**; they do not add line items to your bill.

### Bucket name already taken

With **account-regional namespace**, names are unique per account/region — global collisions no longer apply. If `apply` fails on naming, shorten `bucket_name` prefix (full name must be ≤ 63 characters including `-{account}-{region}-an`).

### Rotate IAM access key

```bash
terraform taint aws_iam_access_key.storage
terraform apply
terraform output -raw secret_access_key
# Update /sys-admin/storage with new secret
```

## Full runbook

See [docs/deployment/aws-storage.md](../../docs/deployment/aws-storage.md).
