# images-claude-vscode

Mod de Claude Code que muestra imágenes dentro del chat de la extensión de VS Code.

- Las imágenes que Claude lee aparecen debajo de su fila en el chat.
- Claude puede enseñarte una imagen del disco cuando se lo pides, o cuando le parece útil.

## Requisitos

- macOS.
- Claude Code 2.1.327 o posterior (`claude --version`; si es anterior, `claude update`).
- Acceso a este repositorio privado y git autenticado con GitHub (`gh auth login` y `gh auth setup-git`).

## Instalación

En una terminal:

```sh
claude plugin install images-claude-vscode --marketplace victordiez02/images-claude-vscode
```

Después, abre una conversación nueva en el chat de Claude Code de VS Code.
