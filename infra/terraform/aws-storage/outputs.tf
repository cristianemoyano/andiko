output "bucket_name" {
  description = "Full S3 bucket name (account-regional) — paste into /sys-admin/storage."
  value       = aws_s3_bucket.files.id
}

output "bucket_name_prefix" {
  description = "Bucket name prefix before -{account}-{region}-an suffix."
  value       = var.bucket_name
}

output "aws_region" {
  description = "AWS region — paste into /sys-admin/storage."
  value       = var.aws_region
}

output "access_key_id" {
  description = "IAM access key ID — paste into /sys-admin/storage."
  value       = aws_iam_access_key.storage.id
}

output "secret_access_key" {
  description = "IAM secret access key — paste into /sys-admin/storage once; also stored in terraform.tfstate."
  value       = aws_iam_access_key.storage.secret
  sensitive   = true
}

output "s3_endpoint" {
  description = "Leave empty for native AWS S3 (non-compatible endpoints only)."
  value       = ""
}

output "iam_user_name" {
  description = "IAM user used by the ERP for presigned URLs."
  value       = aws_iam_user.storage.name
}

output "aws_account_id" {
  description = "AWS account ID (for operator reference)."
  value       = data.aws_caller_identity.current.account_id
}
