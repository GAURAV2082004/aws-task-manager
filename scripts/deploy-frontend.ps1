# Build the React app against the deployed API, upload it to S3, refresh CloudFront.
$ErrorActionPreference = "Stop"

$Stack = if ($env:STACK) { $env:STACK } else { "task-manager-day01" }
$Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "ap-south-1" }

function Get-StackOutput([string]$Key) {
    $val = aws cloudformation describe-stacks --stack-name $Stack --region $Region `
        --query "Stacks[0].Outputs[?OutputKey=='$Key'].OutputValue" --output text
    return $val.Trim()
}

Write-Host "Fetching stack outputs for '$Stack' ($Region)..." -ForegroundColor Cyan
$ApiUrl = Get-StackOutput "ApiUrl"
$Bucket = Get-StackOutput "SiteBucketName"
$DistId = Get-StackOutput "DistributionId"
$SiteUrl = Get-StackOutput "SiteUrl"

Write-Host "API URL: $ApiUrl"
Write-Host "S3 Bucket: $Bucket"
Write-Host "CloudFront Dist: $DistId"

# Build frontend with the deployed API URL
Write-Host "`nBuilding frontend with VITE_API_URL=$ApiUrl..." -ForegroundColor Cyan
Push-Location frontend
try {
    $env:VITE_API_URL = $ApiUrl
    npm run build
} finally {
    Remove-Item env:VITE_API_URL -ErrorAction SilentlyContinue
    Pop-Location
}

# Sync hashed assets (cached for 1 year)
Write-Host "`nSyncing assets to S3..." -ForegroundColor Cyan
aws s3 sync frontend/dist/assets "s3://$Bucket/assets" --delete `
    --cache-control "public,max-age=31536000,immutable" --region $Region

# Upload index.html (no-cache)
Write-Host "Uploading index.html to S3..." -ForegroundColor Cyan
aws s3 cp frontend/dist/index.html "s3://$Bucket/index.html" `
    --cache-control "no-cache" --content-type "text/html" --region $Region

# Invalidate CloudFront cache
Write-Host "Invalidating CloudFront cache for /index.html..." -ForegroundColor Cyan
aws cloudfront create-invalidation --distribution-id $DistId --paths "/index.html" | Out-Null

Write-Host "`nSuccess! Live at: $SiteUrl" -ForegroundColor Green
