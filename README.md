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

1. Sube `version` en `manifest.json`, por ejemplo `1.1.0` → `1.1.1`. Haz commit y push a `main`.
2. Empaqueta la extensión:
   ```bash
   mkdir -p dist && rm -f dist/whatsblock-profile-images.xpi && zip -r dist/whatsblock-profile-images.xpi manifest.json background.js content.js content.css avatar.svg icons
   ```
3. En el Developer Hub de Mozilla, sube una versión nueva eligiendo **"On your own"** (unlisted) y descarga el `.xpi` firmado.
4. Crea y sube la etiqueta con el mismo número:
   ```bash
   git tag v1.1.1
   git push origin v1.1.1
   ```
5. En GitHub, crea una Release a partir de esa etiqueta, adjunta el `.xpi` firmado y publícala.

Al publicar la Release, la acción [`release.yml`](.github/workflows/release.yml):

- comprueba que el `.xpi` está firmado por Mozilla y que su versión coincide con la etiqueta,
- actualiza `updates.json` en `main` con el enlace y el hash del `.xpi`.

## Comprobar el código

```bash
npx web-ext lint --self-hosted --ignore-files dist README.md updates.json
```

`--self-hosted` es necesario porque el manifest lleva `update_url`. Esa clave solo está prohibida en las extensiones publicadas en la tienda.
