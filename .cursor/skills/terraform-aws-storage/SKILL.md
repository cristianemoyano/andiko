---
name: terraform-aws-storage
description: >-
  Deploy and maintain Andiko AWS S3 storage infrastructure via Terraform
  (infra/terraform/aws-storage). Use when applying Terraform changes, updating
  the S3 bucket/IAM/budgets, rotating IAM keys, upgrading providers, or when
  the user mentions terraform apply, AWS storage infra, or S3 bucket deploy.
---

# Terraform AWS Storage (Andiko)

## Scope

Module path: `infra/terraform/aws-storage/`

Manages: private S3 bucket (`sa-east-1`), IAM user `andiko-storage`, CORS for presigned uploads, AWS Budget email alerts.

Does **not** manage: VPS, app deploy, or `/sys-admin/storage` credentials (configured manually after apply).

## Version policy

**Always use the latest stable versions** when touching this module:

1. Check [Terraform releases](https://github.com/hashicorp/terraform/releases) and [AWS provider releases](https://github.com/hashicorp/terraform-provider-aws/releases).
2. Bump `required_version` and `required_providers.aws.version` in `versions.tf` if newer majors/minors exist.
3. Run `terraform init -upgrade` to refresh `.terraform.lock.hcl` and commit the lock file.

Current pins (update when newer stable exists):

- Terraform: `>= 1.9.0` (use latest installed, e.g. `terraform version`)
- AWS provider: `~> 6.53`

## Defaults (project)

| Setting | Value |
|---------|-------|
| Region | `sa-east-1` |
| Budget alert email | `cristianmoyano.mza@gmail.com` |
| Budget limit | `$5 USD/month` |
| CORS origin | `https://andiko.cloud` |
| State | Local `terraform.tfstate` (gitignored — contains IAM secret) |
| AWS CLI profile | `andiko-prod` (default in `providers.tf` + Makefile) |
| Plan file | `tfplan` (gitignored; `plan -out` then `apply tfplan`) |

## Deploy workflow

Copy this checklist and track progress:

```
- [ ] 1. Prereqs: terraform, aws cli, profile andiko-prod
- [ ] 2. Billing alerts enabled (console, one-time)
- [ ] 3. terraform.tfvars present (from .example)
- [ ] 4. terraform init -upgrade
- [ ] 5. terraform fmt -check
- [ ] 6. terraform validate
- [ ] 7. terraform plan (review)
- [ ] 8. terraform apply
- [ ] 9. Commit `.terraform.lock.hcl` if provider changed
- [ ] 10. Update /sys-admin/storage if IAM keys changed
- [ ] 11. Smoke test upload in ERP
```

### Commands

```bash
cd infra/terraform/aws-storage

# Verify profile (optional)
aws sts get-caller-identity --profile andiko-prod --no-cli-pager

# From repo root (recommended):
make aws-storage-plan    # saves tfplan
make aws-storage-apply   # applies tfplan
make aws-storage-outputs # print credentials for sys-admin

# Or via script (profile andiko-prod is default in providers.tf):
cp terraform.tfvars.example terraform.tfvars
./scripts/deploy.sh plan
./scripts/deploy.sh apply

# After apply — only if keys rotated or first deploy
terraform output access_key_id
terraform output -raw secret_access_key
```

### Post-apply: ERP config

https://andiko.cloud/sys-admin/storage

- Enable storage, provider S3
- Bucket + region from `terraform output`
- Access key + secret from outputs
- Endpoint: **empty**

### Smoke test

Compras → Factura proveedor → attach PDF → verify object in S3 console under `{orgSlug}/...`.

## When to re-apply

| Change | Action |
|--------|--------|
| CORS origin added | Edit `cors_allowed_origins` in tfvars → `terraform apply` |
| Budget threshold | Edit `budget_limit_usd` → apply |
| IAM key rotation | `terraform taint aws_iam_access_key.storage` → apply → update sys-admin |
| Provider version bump | Edit `versions.tf` → `init -upgrade` → plan → apply |

## IAM key rotation

```bash
cd infra/terraform/aws-storage
terraform taint aws_iam_access_key.storage
terraform apply
terraform output -raw secret_access_key
# Update /sys-admin/storage; make aws-storage-outputs
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Browser upload CORS error | Add origin to `cors_allowed_origins`, apply |
| Budget alerts not received | Enable Receive Billing Alerts in AWS Billing preferences |
| Bucket name / length | Account-regional namespace; shorten `bucket_name` prefix if full name exceeds 63 chars |
| `NoCredentials` | `aws configure --profile andiko-prod` then `aws sts get-caller-identity --profile andiko-prod` |

## Docs

- Module README: [infra/terraform/aws-storage/README.md](../../infra/terraform/aws-storage/README.md)
- Runbook: [docs/deployment/aws-storage.md](../../docs/deployment/aws-storage.md)

## Do not

- Gitignore `terraform.tfstate` (contains IAM secret; GitHub blocks pushes with AWS keys)
- Use root AWS credentials in the app — only the `andiko-storage` IAM user
- Enable S3 public access or website hosting
- Run `terraform apply` without reviewing `terraform plan` first
