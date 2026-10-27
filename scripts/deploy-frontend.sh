#!/usr/bin/env bash
# Build the React app against the deployed API, upload it to S3, refresh CloudFront.
set -euo pipefail

STACK="${STACK:-task-manager-day01}"
REGION="${AWS_REGION:-ap-south-1}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

API_URL=$(output ApiUrl)
BUCKET=$(output SiteBucketName)
DIST_ID=$(output DistributionId)

( cd frontend && npm ci && VITE_API_URL="$API_URL" npm run build )

# Hashed assets can be cached for a year; index.html must always be revalidated.
aws s3 sync frontend/dist/assets "s3://$BUCKET/assets" --delete \
  --cache-control "public,max-age=31536000,immutable" --region "$REGION"
aws s3 cp frontend/dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-cache" --content-type "text/html" --region "$REGION"

aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/index.html" >/dev/null

echo "Live at: $(output SiteUrl)"
