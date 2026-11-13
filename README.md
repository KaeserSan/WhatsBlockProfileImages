# WhatsBlock Profile Images

Extensión de Firefox que bloquea las fotos de perfil en WhatsApp Web y las sustituye por un avatar con las iniciales del contacto, o por una silueta gris genérica si no se conoce el nombre.

## Cómo funciona

- `background.js`: redirige las peticiones de fotos de perfil (rutas `/t61.24694-24/` en `*.whatsapp.net`) al `avatar.svg` local. La foto real no llega a descargarse.
- `content.js`: sustituye cada foto de perfil (`<img>` o `<image>` de SVG) por un SVG con iniciales y un color derivado del nombre. El nombre solo se lee de la lista de chats. En otras partes (cabecera, panel de info) se reutiliza por identificador de foto, y si no se conoce se pone la silueta genérica.
- `content.css`: oculta las imágenes hasta que se han revisado, para que no se vea ninguna foto real ni un instante.
- Botón en la barra de herramientas: activa o desactiva la extensión (muestra "OFF") y recarga WhatsApp.

## Instalación

Descarga el `.xpi` de la última [Release](https://github.com/KaeserSan/WhatsBlockProfileImages/releases/latest) y en Firefox abre `about:addons` → ⚙️ → *Instalar complemento desde archivo…*.

Las versiones las firma Mozilla como *unlisted*, así que no aparecen en la tienda. Firefox comprueba [`updates.json`](updates.json) aproximadamente una vez al día y se actualiza solo.

### Desarrollo

Para cargarla temporalmente sin firmar: `about:debugging#/runtime/this-firefox` → *Cargar complemento temporal…* → `manifest.json`.

## Publicar una versión nueva

La firma se hace a mano en addons.mozilla.org. GitHub solo guarda las versiones.

Requisitos, una sola vez: `brew install gh` e iniciar sesión con `gh auth login`.

1. Sube `version` en `manifest.json`, por ejemplo `1.1.0` → `1.1.1`. Haz commit y push a `main`.
2. Empaqueta la extensión sin firmar en `dist/whatsblock-profile-images.xpi`:
   ```bash
   ./release.sh pack
   ```
3. En el Developer Hub de Mozilla, entra en la extensión → **Upload New Version** → **"On your own"**. Sube el `.xpi` y descarga el firmado, por ejemplo en `dist_signed/`.
4. Publica la versión:
   ```bash
   ./release.sh publish dist_signed/<archivo-firmado>.xpi
   ```
   El script comprueba que el `.xpi` está firmado, que su id y su versión coinciden con `manifest.json` y que el commit actual ya está en `origin/main`. Después crea y sube la etiqueta `vX.Y.Z` y crea la Release con el `.xpi` adjunto, renombrado a `whatsblock-profile-images-X.Y.Z.xpi`.
5. Trae a tu copia local el `updates.json` actualizado:
   ```bash
   git pull
   ```

Las Releases también se pueden crear a mano en GitHub, adjuntando el `.xpi` firmado a una etiqueta `vX.Y.Z`.

Al publicar la Release, la acción [`release.yml`](.github/workflows/release.yml):

- comprueba que el `.xpi` está firmado por Mozilla y que su versión coincide con la etiqueta,
- actualiza `updates.json` en `main` con el enlace y el hash del `.xpi`.

## Comprobar el código

```bash
npx web-ext lint --self-hosted --ignore-files dist dist_signed README.md updates.json release.sh
```

`--self-hosted` es necesario porque el manifest lleva `update_url`. Esa clave solo está prohibida en las extensiones publicadas en la tienda.
