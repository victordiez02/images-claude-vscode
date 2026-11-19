# claude-vscode-images

Mod de Claude Code que pinta imágenes dentro del chat de la extensión de VS Code. El mod se llama `images-claude-vscode`.

- **Cada imagen que Claude lee** (herramienta `Read` de un png, jpg, gif, webp, heic, tiff o bmp) aparece debajo de su fila en el chat, también dentro de los grupos «Read N files».
- **`ShowImage`**: una herramienta con la que Claude te enseña una imagen del disco. La usa cuando se lo pides; si no se lo has pedido, la enseña directamente cuando es claramente útil (por ejemplo, el resultado visual de lo que acaba de hacer) y, cuando solo cree que puede ayudar, te ofrece enseñarte las imágenes a partir de ese momento.
- Un botón discreto **⤢** en la esquina de cada imagen la abre a tamaño completo en una pestaña de VS Code.

Claude no ve lo que pinta el mod: la imagen es solo para ti.

## Requisitos

- **macOS**: el mod reduce las imágenes con `sips`, que viene con el sistema.
- **Claude Code 2.1.327 o posterior**, la versión que entiende los mods. La extensión de VS Code trae la suya; el `claude` de la terminal puede ser más antiguo. Compruébalo con:

  ```sh
  claude --version
  ```

  Si sale una versión anterior, actualízalo con `claude update`, o usa en los comandos de abajo el binario de la extensión en lugar de `claude`:

  ```sh
  ~/.vscode/extensions/anthropic.claude-code-*-darwin-arm64/resources/native-binary/claude
  ```

- **Acceso al repositorio**: es privado, así que tu cuenta de GitHub tiene que poder leerlo y tu máquina necesita una credencial de git para github.com (la instalación no la pide). Con la CLI de GitHub, en una terminal:

  ```sh
  gh auth login
  gh auth setup-git
  ```

## Instalación

En una terminal, desde cualquier carpeta:

```sh
claude plugin install images-claude-vscode --marketplace victordiez02/claude-vscode-images
```

Se instala con alcance de usuario (`user`), así que vale para todos tus proyectos. La primera vez añade el marketplace `claude-vscode-images` a tu configuración.

Si ya tienes abierta una sesión de Claude Code en la terminal, también puedes escribir en ella:

```text
/plugin install images-claude-vscode --marketplace victordiez02/claude-vscode-images
```

Responde `y` para añadir el marketplace y elige el alcance de usuario con Enter.

Después, abre una conversación nueva en el chat de Claude Code de VS Code (o recarga la ventana con «Developer: Reload Window») para que cargue el mod.

## Uso

- Pídele a Claude que lea una imagen («mira `captura.png`») y la verás debajo de la fila `Read`.
- Pídele que te la enseñe («enséñame el gráfico que has generado») y la pintará con `ShowImage`.
- Pulsa **⤢** en la esquina de la imagen para verla a tamaño completo en una pestaña. Usa el comando `code`; si no lo tienes en el PATH, instálalo desde VS Code con «Shell Command: Install 'code' command in PATH».

Las imágenes se muestran pequeñas, como mucho a 320×240 px, convertidas a JPEG de hasta 640 px de lado para que se vean nítidas (menos si no caben en el límite de 128 KB de un SVG del chat). Solo se pintan en el chat de VS Code; en la terminal y en otras superficies el mod no hace nada.

## Dónde se guardan las imágenes

El mod no guarda nada fuera de la conversación:

- **`Read`**: Claude Code ya guarda en la conversación la imagen que lee; el mod la reduce desde ahí cada vez que pinta la fila.
- **`ShowImage`**: guarda una versión reducida (menos de 60 KB) en el resultado de la herramienta, en un campo que Claude no lee.

Para reducir usa una carpeta temporal que borra en el momento, y la copia que mantiene en memoria desaparece al cerrar la sesión. Si vuelves a abrir una conversación, las imágenes se pintan de nuevo desde ella, aunque el archivo original ya no exista; cuando Claude Code borra la conversación (por defecto, a los 30 días), se van con ella. El botón **⤢** sí abre el archivo original, así que solo funciona mientras exista.

## Actualizar y desinstalar

En una terminal:

```sh
claude plugin marketplace update claude-vscode-images
claude plugin update images-claude-vscode@claude-vscode-images
```

```sh
claude plugin uninstall images-claude-vscode@claude-vscode-images
```

Tras actualizar, abre una conversación nueva en VS Code.

## Desarrollo

El mod está en [plugins/images-claude-vscode/](plugins/images-claude-vscode/); el código, en [hooks/register.tsx](plugins/images-claude-vscode/hooks/register.tsx). Desde la raíz del repositorio:

```sh
claude plugin validate .
claude --plugin-dir plugins/images-claude-vscode
```

El primero comprueba el marketplace y el mod; el segundo abre una sesión con el mod cargado desde la carpeta.

## Licencia

[MIT](LICENSE)
