# Instala el mod images-claude-vscode en la carpeta actual o para todos tus proyectos, con un menú en la terminal (Windows).
# Va dentro de un bloque para que, lanzado con `irm … | iex`, no deje funciones en la sesión y `return` no cierre la ventana.
& {
  $Mod = 'images-claude-vscode'
  $Id = "$Mod@claude-vscode-images"
  $Fuente = if ($env:MARKETPLACE) { $env:MARKETPLACE } else { 'victordiez02/images-claude-vscode' }
  $VersionMinima = [version]'2.1.327'
  $InstaladorMacos = 'bash <(curl -fsSL https://raw.githubusercontent.com/victordiez02/images-claude-vscode/main/scripts/instalar.sh)'

  function Mostrar-Detalle([string]$texto) {
    if ($texto) { Write-Host "    $texto" -ForegroundColor DarkGray }
  }

  function Mostrar-Resultado([string]$marca, [ConsoleColor]$color, [string]$texto, [string]$detalle) {
    Write-Host ''
    Write-Host "  $marca " -ForegroundColor $color -NoNewline
    Write-Host $texto
    Mostrar-Detalle $detalle
    Write-Host ''
  }

  # El primer Claude Code que entiende mods: el del PATH o, si es antiguo, el de la extensión de VS Code.
  function Buscar-Claude {
    $candidatos = @()
    $enPath = Get-Command claude -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($enPath) { $candidatos += $enPath.Path }
    $candidatos += Get-ChildItem "$env:USERPROFILE\.vscode\extensions\anthropic.claude-code-*\resources\native-binary\claude.exe" -ErrorAction SilentlyContinue |
      Sort-Object Name -Descending | ForEach-Object { $_.FullName }
    foreach ($candidato in $candidatos) {
      $version = (& $candidato --version 2>$null | Out-String).Trim()
      if ($version -match '^(\d+\.\d+\.\d+)' -and [version]$Matches[1] -ge $VersionMinima) { return $candidato }
    }
  }

  # Menú de flechas: cada opción es «título|descripción»; devuelve el índice elegido.
  function Elegir([string[]]$opciones) {
    $actual = 0
    [Console]::CursorVisible = $false
    while ($true) {
      for ($i = 0; $i -lt $opciones.Count; $i++) {
        $titulo, $descripcion = $opciones[$i] -split '\|', 2
        if ($i -eq $actual) { Write-Host "  ❯ $titulo" -ForegroundColor Cyan } else { Write-Host "    $titulo" }
        Write-Host "    $descripcion" -ForegroundColor DarkGray
      }
      $tecla = [Console]::ReadKey($true).Key
      if ($tecla -eq 'Enter') { break }
      if ($tecla -eq 'UpArrow' -and $actual -gt 0) { $actual-- }
      if ($tecla -eq 'DownArrow' -and $actual -lt $opciones.Count - 1) { $actual++ }
      [Console]::SetCursorPosition(0, [Console]::CursorTop - $opciones.Count * 2)
    }
    [Console]::CursorVisible = $true
    return $actual
  }

  function Leer-Instalaciones {
    $json = (& $Claude plugin list --json 2>$null | Out-String).Trim()
    if (-not $json) { return }
    $json | ConvertFrom-Json | ForEach-Object { $_ } | Where-Object { $_.id -eq $Id }
  }

  # Deja que Claude Code escriba su propia salida y devuelve si la instalación salió bien.
  function Instalar([string]$alcance) {
    Write-Host ''
    Write-Host '  Instalando…' -ForegroundColor DarkGray
    '' | & $Claude plugin install $Mod --marketplace $Fuente --scope $alcance 2>&1 | Out-Host
    return $LASTEXITCODE -eq 0
  }

  # Sin una consola real (una tarea automática), cambiar la codificación o el cursor lanza un error: se intenta y se sigue.
  $codificacionAnterior = [Console]::OutputEncoding
  try { [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false) } catch {}
  try {
    Write-Host ''
    Write-Host '  images-claude-vscode' -NoNewline
    Write-Host ' · instalador' -ForegroundColor DarkGray

    if ($env:OS -ne 'Windows_NT') {
      Mostrar-Resultado '✖' Red 'Este instalador es para Windows.' "En macOS usa: $InstaladorMacos"
      return
    }
    $Claude = Buscar-Claude
    if (-not $Claude) {
      Mostrar-Resultado '✖' Red "No encuentro Claude Code $VersionMinima o posterior." 'Actualízalo con «claude update» o instala la extensión de Claude Code para VS Code.'
      return
    }

    $carpeta = (Get-Location).ProviderPath
    $nombre = Split-Path $carpeta -Leaf
    switch ($env:ALCANCE) {
      'local' { $eleccion = 0 }
      'global' { $eleccion = 1 }
      { -not $_ } {
        if ([Console]::IsInputRedirected) {
          Mostrar-Resultado '✖' Red 'Sin terminal para el menú.' 'Elige con $env:ALCANCE = ''global'' o ''local'' antes del comando.'
          return
        }
        Write-Host ''
        Write-Host '  ¿Dónde quieres usarlo?'
        Write-Host ''
        $eleccion = Elegir @("Solo en $nombre|Local: solo en esta carpeta, y solo para ti", 'Todos mis proyectos|Global: se activa en cualquier proyecto que abras')
      }
      default {
        Mostrar-Resultado '✖' Red 'ALCANCE debe ser «global» o «local».'
        return
      }
    }

    $instalaciones = @(Leer-Instalaciones)
    $enGlobal = $instalaciones | Where-Object { $_.scope -eq 'user' }

    if ($eleccion -eq 1) {
      if ($enGlobal) {
        Mostrar-Resultado '●' Yellow 'Ya lo tienes instalado para todos tus proyectos.' "Para traer la última versión: claude plugin update $Id"
      } elseif (Instalar 'user') {
        Mostrar-Resultado '✔' Green 'Instalado para todos tus proyectos.' 'Abre una conversación nueva en el chat de Claude de VS Code para que cargue.'
      } else {
        Mostrar-Resultado '✖' Red 'No se pudo instalar.'
      }
      return
    }

    $enCarpeta = $instalaciones | Where-Object { ($_.scope -eq 'local' -or $_.scope -eq 'project') -and $_.projectPath -eq $carpeta }
    if ($enGlobal) {
      Mostrar-Resultado '●' Yellow "Ya lo tienes instalado para todos tus proyectos, así que en $nombre ya funciona." 'No hace falta instalarlo también aquí.'
    } elseif ($enCarpeta) {
      Mostrar-Resultado '●' Yellow "Ya lo tienes instalado en $nombre." $carpeta
    } elseif (Instalar 'local') {
      Mostrar-Resultado '✔' Green "Instalado solo en $nombre." 'Abre en VS Code una conversación nueva de ese proyecto para que cargue.'
    } else {
      Mostrar-Resultado '✖' Red 'No se pudo instalar.'
    }
  } finally {
    try { [Console]::OutputEncoding = $codificacionAnterior } catch {}
    try { [Console]::CursorVisible = $true } catch {}
  }
}
