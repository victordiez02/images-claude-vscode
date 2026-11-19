# Prueba scripts/instalar.ps1 contra el marketplace de esta copia del repositorio: en local, repetido, en global y con lo global ya puesto.
# Solo ASCII: Windows PowerShell 5.1 lee como ANSI los scripts UTF-8 sin BOM.
$ErrorActionPreference = 'Stop'
$repo = (Get-Location).ProviderPath
$instalador = Get-Content -Raw -Encoding UTF8 (Join-Path $repo 'scripts\instalar.ps1')
$env:MARKETPLACE = $repo

# Lanza el instalador como `irm | iex` desde una carpeta y devuelve lo que escribe.
function Ejecutar([string]$alcance, [string]$carpeta) {
  $env:ALCANCE = $alcance
  Push-Location $carpeta
  try { Invoke-Expression $instalador 6>&1 | Out-String } finally { Pop-Location }
}

function Esperar([string]$salida, [string]$texto) {
  Write-Host $salida
  if ($salida -notmatch [regex]::Escape($texto)) { throw "Se esperaba: $texto" }
  Write-Host "OK $texto"
}

function Instalaciones {
  claude plugin list --json | Out-String | ConvertFrom-Json | ForEach-Object { $_ } | Where-Object { $_.id -eq 'images-claude-vscode@claude-vscode-images' }
}

$proyecto = (New-Item -ItemType Directory -Force (Join-Path $env:RUNNER_TEMP 'mi-proyecto')).FullName
$otro = (New-Item -ItemType Directory -Force (Join-Path $env:RUNNER_TEMP 'otro-proyecto')).FullName

Esperar (Ejecutar 'local' $proyecto) 'Instalado solo en mi-proyecto'
$local = Instalaciones | Where-Object { $_.scope -eq 'local' }
if ($local.projectPath -ne $proyecto) { throw "Claude Code guarda la carpeta como '$($local.projectPath)', no '$proyecto'" }
Esperar (Ejecutar 'local' $proyecto) 'Ya lo tienes instalado en mi-proyecto'

Esperar (Ejecutar 'global' $proyecto) 'Instalado para todos tus proyectos'
Esperar (Ejecutar 'global' $proyecto) 'Ya lo tienes instalado para todos tus proyectos'
Esperar (Ejecutar 'local' $otro) 'otro-proyecto ya funciona'
