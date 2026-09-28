$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $PSScriptRoot
$csvPath = Join-Path $projectPath 'tmp-caixa-geral.csv'
$sourceUrl = 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_geral.csv?159567998'

try {
    Invoke-WebRequest -Uri $sourceUrl -OutFile $csvPath -UseBasicParsing
    $nodeCommand = Get-Command node -ErrorAction Stop
    & $nodeCommand.Source (Join-Path $PSScriptRoot 'sync-caixa.mjs') "--input=$csvPath"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
    Remove-Item -LiteralPath $csvPath -ErrorAction SilentlyContinue
}
