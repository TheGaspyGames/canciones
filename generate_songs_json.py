import os
import json
from datetime import datetime
import hashlib
from mutagen import File
from mutagen.easyid3 import EasyID3


def generate_songs_json():
    music_dir = "C:\\Users\\Gamer\\Documents\\GitHub\\canciones\\music"
    songs_data = []
    
    # Asegurarse de que la carpeta music existe
    if not os.path.exists(music_dir):
        os.makedirs(music_dir)

    # Recorrer todos los archivos de música
    for filename in os.listdir(music_dir):
        if filename.lower().endswith(('.mp3', '.wav', '.ogg')):
            file_path = os.path.join(music_dir, filename)
            
            try:
                # Intentar obtener metadatos
                audio = File(file_path)
                if hasattr(audio, 'tags'):
                    tags = audio.tags
                else:
                    try:
                        audio = EasyID3(file_path)
                        tags = audio
                    except:
                        tags = {}

                # Obtener información del archivo
                file_stats = os.stat(file_path)
                file_size = file_stats.st_size
                creation_date = datetime.fromtimestamp(file_stats.st_ctime).strftime('%Y-%m-%d')

                # Generar un ID único basado en el nombre del archivo
                file_id = hashlib.md5(filename.encode()).hexdigest()[:8]

                # Crear objeto de canción
                song = {
                    "id": file_id,
                    "title": tags.get("title", [os.path.splitext(filename)[0]])[0] if hasattr(tags, "get") else os.path.splitext(filename)[0],
                    "file": f"music/{filename}",
                    "cover": f"assets/covers/{file_id}.jpg",  # Imagen de portada con el mismo ID
                    "date": creation_date,
                    "size": file_size,
                    "genre": tags.get("genre", ["Sin género"])[0] if hasattr(tags, "get") else "Sin género",
                    "aiModel": tags.get("comment", ["IA"])[0] if hasattr(tags, "get") else "IA"
                }
                
                songs_data.append(song)
                
                print(f"Procesada canción: {filename}")
                
            except Exception as e:
                print(f"Error procesando {filename}: {str(e)}")
                continue

    # Ordenar canciones por fecha de creación (más recientes primero)
    songs_data.sort(key=lambda x: x['date'], reverse=True)

    # Guardar en JSON
    with open('songs.json', 'w', encoding='utf-8') as f:
        json.dump({"songs": songs_data}, f, ensure_ascii=False, indent=2)

    print(f"\nProceso completado. Se encontraron {len(songs_data)} canciones.")
    print("El archivo songs.json ha sido generado/actualizado.")

if __name__ == "__main__":
    generate_songs_json()