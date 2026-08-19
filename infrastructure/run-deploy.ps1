# Reads credentials from .env.local and runs deploy.mjs
$envFile = Join-Path $PSScriptRoot ".." ".env.local"
Get-Content $envFile | Where-Object { $_ -match "^[A-Z]" } | ForEach-Object {
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
}
$env:SES_FROM_EMAIL = "tp6382@srmist.edu.in"
Write-Host "Using account: $(aws sts get-caller-identity --query Account --output text)"
node (Join-Path $PSScriptRoot "deploy.mjs")
