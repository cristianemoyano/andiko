variable "aws_profile" {
  description = "AWS CLI profile for Terraform provider (default: andiko-prod)."
  type        = string
  default     = "andiko-prod"
}

variable "aws_region" {
  description = "AWS region for the S3 bucket."
  type        = string
  default     = "sa-east-1"
}

variable "environment" {
  description = "Environment tag (e.g. prod)."
  type        = string
  default     = "prod"
}

variable "bucket_name" {
  description = "S3 bucket name prefix (account-regional suffix -{account_id}-{region}-an is appended automatically)."
  type        = string
}

variable "alert_email" {
  description = "Email address for AWS Budget cost alerts."
  type        = string
  default     = "cristianmoyano.mza@gmail.com"
}

variable "budget_limit_usd" {
  description = "Monthly AWS account cost budget limit in USD."
  type        = string
  default     = "5"
}

variable "cors_allowed_origins" {
  description = "Browser origins allowed for presigned PUT/GET uploads (must include production ERP URL)."
  type        = list(string)
  default     = ["https://andiko.cloud"]
}

variable "enable_versioning" {
  description = "Enable S3 object versioning (increases storage cost on overwrites)."
  type        = bool
  default     = false
}

variable "iam_user_name" {
  description = "IAM user name for Andiko storage API access."
  type        = string
  default     = "andiko-storage"
}
