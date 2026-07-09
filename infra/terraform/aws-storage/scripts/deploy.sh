#!/usr/bin/env bash
# Deploy Andiko AWS S3 storage (Terraform).
# Usage: ./scripts/deploy.sh [plan|apply|outputs]
# AWS profile: andiko-prod (in providers.tf; override via aws_profile in terraform.tfvars)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ACTION="${1:-plan}"
PLAN_FILE="tfplan"

# Keep CLI and Terraform aligned (provider also sets profile = andiko-prod)
export AWS_PROFILE="${AWS_PROFILE:-andiko-prod}"
export AWS_PAGER=""

if [[ ! -f terraform.tfvars ]]; then
  echo "Missing terraform.tfvars — copy from terraform.tfvars.example and edit bucket_name."
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "terraform not found. Install: brew install hashicorp/tap/terraform"
  exit 1
fi

if ! aws sts get-caller-identity --profile "$AWS_PROFILE" --no-cli-pager >/dev/null 2>&1; then
  echo "AWS profile '$AWS_PROFILE' not configured. Run:"
  echo "  aws configure --profile andiko-prod"
  echo "  aws sts get-caller-identity --profile andiko-prod --no-cli-pager"
  exit 1
fi

echo "==> AWS profile: $AWS_PROFILE"
aws sts get-caller-identity --profile "$AWS_PROFILE" --no-cli-pager

echo "==> terraform init -upgrade"
terraform init -upgrade

echo "==> terraform fmt -check"
terraform fmt -check -recursive || { terraform fmt -recursive; echo "Formatted .tf files — review and re-run."; exit 1; }

echo "==> terraform validate"
terraform validate

case "$ACTION" in
  plan)
    echo "==> terraform plan -out=$PLAN_FILE"
    terraform plan -out="$PLAN_FILE"
    echo ""
    echo "Plan saved to $PLAN_FILE — apply the exact plan with:"
    echo "  make aws-storage-apply"
    echo "  # or: ./scripts/deploy.sh apply"
    ;;
  apply)
    if [[ ! -f "$PLAN_FILE" ]]; then
      echo "Missing $PLAN_FILE — run plan first:"
      echo "  make aws-storage-plan"
      exit 1
    fi
    echo "==> Applying saved plan ($PLAN_FILE)"
    terraform show -no-color "$PLAN_FILE" | tail -20
    echo ""
    read -r -p "Apply this plan? [y/N] " confirm
    if [[ "$confirm" =~ ^[yY]$ ]]; then
      terraform apply "$PLAN_FILE"
      rm -f "$PLAN_FILE"
      echo ""
      echo "Outputs (configure /sys-admin/storage if keys changed):"
      terraform output bucket_name
      terraform output aws_region
      terraform output access_key_id
      echo "Secret: make aws-storage-outputs  # or: ./scripts/deploy.sh outputs"
    else
      echo "Aborted. Plan kept at $PLAN_FILE"
    fi
    ;;
  outputs)
    if [[ ! -f terraform.tfstate ]]; then
      echo "No terraform.tfstate — run make aws-storage-apply first."
      exit 1
    fi
    echo "==> Terraform outputs (paste into /sys-admin/storage)"
    echo ""
    echo "bucket_name  = $(terraform output -raw bucket_name)"
    echo "aws_region   = $(terraform output -raw aws_region)"
    echo "access_key_id = $(terraform output -raw access_key_id)"
    echo "s3_endpoint  = (empty)"
    echo ""
    echo "secret_access_key = $(terraform output -raw secret_access_key)"
    ;;
  *)
    echo "Usage: $0 [plan|apply|outputs]"
    exit 1
    ;;
esac
