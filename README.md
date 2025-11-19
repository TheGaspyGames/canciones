# Musica Generada con IA

Coleccion de canciones generadas con IA, publicadas en GitHub Pages.

## Subir canciones desde la web (sin scripts)
1. Ajusta `assets/config.js` con tus valores reales (Discord y GitHub).
2. Abre la pagina desplegada e inicia sesion con la cuenta de Discord autorizada.
3. En el panel privado elige el archivo de audio y opcionalmente la portada, titulo, genero y modelo.
4. Introduce un token personal de GitHub con permiso `public_repo` o `repo`. El token solo se usa durante la subida y no se guarda.
5. Envia el formulario. Los archivos se subiran a `music/` y `assets/covers/`, y la metadata a `music-metadata/` + `music-metadata/index.json`. La pagina se actualiza sola, sin depender de `songs.json` ni de scripts locales.

## Carga manual / legado (opcional)
El script `generate_songs_json.py` genera un `songs.json` a partir de la carpeta `music/`. Ya no es necesario para que la pagina se actualice, pero lo puedes usar si quieres un listado local rapido o para migrar datos.

## Estructura del proyecto
```
/
├── music/               # Archivos de audio
├── assets/
│   └── covers/          # Portadas
├── music-metadata/      # Metadata por cancion + index.json
├── index.html           # Pagina principal
├── music-styles.css     # Estilos
├── music-player.js      # Logica del reproductor y subidas
└── generate_songs_json.py (opcional/legado)
```
