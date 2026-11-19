# images-claude-vscode

Mod de Claude Code que muestra imágenes dentro del chat de la extensión de VS Code.

- Las imágenes que Claude lee aparecen debajo de su fila en el chat.
- Claude puede enseñarte una imagen del disco cuando se lo pides, o cuando le parece útil.

## Requisitos

- macOS.
- Claude Code 2.1.327 o posterior (`claude --version`; si es anterior, `claude update`).

## Instalación

En una terminal, sin clonar el repositorio:

```sh
bash <(curl -fsSL https://raw.githubusercontent.com/victordiez02/images-claude-vscode/main/scripts/instalar.sh)
```

O, con el repositorio clonado, desde su carpeta:

```sh
make instalar
```

Un menú te deja elegir dónde usarlo:

- **Solo en esta carpeta** (por defecto): se activa solo en la carpeta desde la que lo ejecutas, y solo para ti.
- **Todos mis proyectos**: se activa en cualquier proyecto que abras.

Si ya lo tenías instalado, te avisa. Después, abre una conversación nueva en el chat de Claude Code de VS Code.
