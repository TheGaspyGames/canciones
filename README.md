# Música Generada con IA

Este es el repositorio de mi colección de música generada con IA.

## Cómo añadir nuevas canciones

1. Instala las dependencias de Python necesarias:
```bash
pip install mutagen
```

2. Coloca tus archivos de música en la carpeta `music/`
   - Formatos soportados: .mp3, .wav, .ogg
   - Los nombres de archivo serán usados como títulos si no hay metadatos

3. Opcionalmente, añade imágenes de portada en `assets/covers/`
   - Nombra las imágenes como `[ID].jpg` donde [ID] es el ID generado para la canción
   - Si no hay imagen, se usará una portada por defecto

4. Ejecuta el script para generar el JSON:
```bash
python generate_songs_json.py
```

5. Sube los cambios a GitHub:
```bash
git add .
git commit -m "Añadidas nuevas canciones"
git push
```

## Estructura del proyecto

```
/
├── music/              # Carpeta para archivos de música
├── assets/
│   └── covers/        # Imágenes de portada
├── songs.json         # Lista de canciones (generado automáticamente)
├── index.html         # Página principal
├── music-styles.css   # Estilos
└── music-player.js    # Lógica del reproductor
```

## Notas
- El script generará automáticamente IDs únicos para cada canción
- Las canciones se ordenan por fecha de más reciente a más antigua
- Puedes añadir metadatos a tus archivos MP3 para mejorar la información mostrada