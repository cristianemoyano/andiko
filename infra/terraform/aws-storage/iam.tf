resource "aws_iam_user" "storage" {
  name = var.iam_user_name
  path = "/"
}

resource "aws_iam_user_policy" "storage" {
  name = "${var.iam_user_name}-s3-policy"
  user = aws_iam_user.storage.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AndikoStorageObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject",
        ]
        Resource = "${aws_s3_bucket.files.arn}/*"
      },
    ]
  })
}

resource "aws_iam_access_key" "storage" {
  user = aws_iam_user.storage.name
}
