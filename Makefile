# Abre el instalador del mod para tu sistema: PowerShell en Windows y bash en macOS.
# En Windows lee el script como UTF-8 y lo ejecuta como `irm … | iex`, sin depender de la política de ejecución.
instalar:
ifeq ($(OS),Windows_NT)
	@powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 scripts/instalar.ps1 | Invoke-Expression"
else
	@bash scripts/instalar.sh
endif

.PHONY: instalar
