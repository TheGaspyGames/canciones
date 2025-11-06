// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Variables globales
let songs = [];
let currentPage = 1;
const songsPerPage = 24; // Número de canciones por página

// Cargar canciones desde el JSON
async function loadSongs() {
    try {
        console.log('Intentando cargar songs.json...');
        const response = await fetch('songs.json');
        console.log('Respuesta recibida:', response);
        const data = await response.json();
        console.log('Datos cargados:', data);
        songs = data.songs;
    console.log('Canciones guardadas:', songs.length);
    // Inicializar partes del reproductor ahora que `songs` está cargado
    updatePagination();
    generateMusicCards(); // Asegurarnos de que se generan las tarjetas
    // Inicializar la playlist y cargar la canción actual solo si hay canciones
    if (songs.length > 0) {
      initializePlaylist();
      loadCurrentSong();
    } else {
      console.warn('No hay canciones en la lista después de cargar songs.json');
    }
    } catch (error) {
        console.error('Error cargando las canciones:', error);
        document.querySelector('.music-grid').innerHTML = `
            <div class="error-message">
                Error cargando las canciones. Por favor, intenta recargar la página.<br>
                Detalles del error: ${error.message}
            </div>
        `;
    }
}

// Filtros y búsqueda
function filterSongs(searchTerm = '', genre = 'all', model = 'all') {
    return songs.filter(song => {
        const matchesSearch = song.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGenre = genre === 'all' || song.genre === genre;
        const matchesModel = model === 'all' || song.aiModel === model;
        return matchesSearch && matchesGenre && matchesModel;
    });
}

// Paginación
function updatePagination() {
    const filteredSongs = filterSongs(
        document.querySelector('#search-input')?.value || '',
        document.querySelector('#genre-filter')?.value || 'all',
        document.querySelector('#model-filter')?.value || 'all'
    );
    
    const totalPages = Math.ceil(filteredSongs.length / songsPerPage);
    const paginationContainer = document.querySelector('.pagination');
    
    if (paginationContainer) {
        paginationContainer.innerHTML = `
            <button onclick="changePage('prev')" ${currentPage === 1 ? 'disabled' : ''}>
                Anterior
            </button>
            <span>Página ${currentPage} de ${totalPages}</span>
            <button onclick="changePage('next')" ${currentPage === totalPages ? 'disabled' : ''}>
                Siguiente
            </button>
        `;
    }
    
    return filteredSongs.slice((currentPage - 1) * songsPerPage, currentPage * songsPerPage);
}

// Generar tarjetas de música
function generateMusicCards() {
    console.log('Generando tarjetas de música...');
    const musicGrid = document.querySelector('.music-grid');
    if (!musicGrid) {
        console.error('No se encontró el elemento .music-grid');
        return;
    }
    
    const displayedSongs = updatePagination();
    console.log('Canciones a mostrar:', displayedSongs.length);
    
    musicGrid.innerHTML = '';
    if (displayedSongs.length === 0) {
        musicGrid.innerHTML = '<div class="error-message">No hay canciones para mostrar</div>';
        return;
    }

    // Precarga de la imagen por defecto
    const defaultImage = new Image();
    defaultImage.src = '/assets/default-cover.svg';
    
    displayedSongs.forEach((song, index) => {
        // Encontrar el índice real en el array completo de canciones
        const realIndex = songs.findIndex(s => s.id === song.id);
        const card = document.createElement('div');
        card.className = 'music-card';
        card.innerHTML = `
            <div class="card-image" onclick="playSongAtIndex(${realIndex})">
                <img 
                    src="${song.cover || 'assets/default-cover.png'}" 
                    alt="${song.title}" 
                    onerror="this.onerror=null; this.src='assets/default-cover.png'; this.classList.add('default-cover');">
                <div class="play-overlay">
                    <span class="play-icon">▶</span>
                </div>
            </div>
            <div class="card-content">
                <h3>${song.title}</h3>
                <div class="song-meta">
                    <span class="song-date">📅 ${song.date}</span>
                    <span class="song-model">🤖 ${song.aiModel}</span>
                    <span class="song-genre">🎵 ${song.genre}</span>
                </div>
                <div class="card-actions">
                    <a href="${song.file}" download class="download-button" onclick="event.stopPropagation()">
                        <span class="download-icon">⬇️</span> Descargar
                    </a>
                    <button class="play-button" onclick="playSongAtIndex(${realIndex})">
                        <span>▶️</span> Reproducir
                    </button>
                </div>
            </div>
        `;
        musicGrid.appendChild(card);
    });
}

// Función para cambiar de página
function changePage(direction) {
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    } else if (direction === 'next') {
        const filteredSongs = filterSongs(
            document.querySelector('#search-input')?.value || '',
            document.querySelector('#genre-filter')?.value || 'all',
            document.querySelector('#model-filter')?.value || 'all'
        );
        const totalPages = Math.ceil(filteredSongs.length / songsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
        }
    }
    generateMusicCards();
}

// Inicializar la interfaz
document.addEventListener('DOMContentLoaded', () => {
    console.log('Documento cargado, iniciando carga de canciones...');
    initializePlayerElements();
    loadSongs();
});

// Variables globales del reproductor
let currentSongIndex = 0;
let isPlaying = false;
let music, musicButton, currentSongElement, progressBar, progressContainer, playlist;

// Inicializar variables del reproductor
function initializePlayerElements() {
  music = document.getElementById('bgMusic');
  musicButton = document.getElementById('musicToggle');
  currentSongElement = document.getElementById('currentSong');
  progressBar = document.getElementById('progressBar');
  progressContainer = document.getElementById('progressContainer');
  playlist = document.getElementById('playlist');
}

function initializePlaylist() {
  playlist.innerHTML = songs.map((song, index) => `
    <div class="playlist-item ${index === currentSongIndex ? 'active' : ''}" 
         onclick="playSongAtIndex(${index})">
      ${song.title}
    </div>
  `).join('');
}

function updatePlaylistSelection() {
  document.querySelectorAll('.playlist-item').forEach((item, index) => {
    item.classList.toggle('active', index === currentSongIndex);
  });
}

function loadCurrentSong() {
  const song = songs[currentSongIndex];
  music.src = song.file;
  currentSongElement.textContent = song.title;
  if (isPlaying) {
    music.play();
  }
  updatePlaylistSelection();
}

let fadeInterval = null;

function fadeOut(callback) {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  
  const duration = 800; // duración más larga para un fade más suave
  const steps = 50; // más pasos para una transición más suave
  const stepTime = duration / steps;
  const initialVolume = music.volume;
  
  let currentStep = 0;
  
  fadeInterval = setInterval(() => {
    currentStep++;
    if (currentStep <= steps) {
      // Usar una curva exponencial suavizada para el fade
      const factor = Math.pow((steps - currentStep) / steps, 3);
      music.volume = Math.max(0, initialVolume * factor);
    } else {
      music.volume = 0;
      clearInterval(fadeInterval);
      fadeInterval = null;
      if (callback) callback();
    }
  }, stepTime);
}

function fadeIn(targetVolume = 1) {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  
  const duration = 800;
  const steps = 50;
  const stepTime = duration / steps;
  const startVolume = music.volume;
  
  let currentStep = 0;
  
  fadeInterval = setInterval(() => {
    currentStep++;
    if (currentStep <= steps) {
      // Usar una curva exponencial suavizada para el fade
      const factor = Math.pow(currentStep / steps, 3);
      music.volume = startVolume + (targetVolume - startVolume) * factor;
    } else {
      music.volume = targetVolume;
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }, stepTime);
}

function toggleMusic() {
  if (isPlaying) {
    isPlaying = false;
    musicButton.textContent = '▶';
    fadeOut(() => {
      music.pause();
      // No restauramos el volumen aquí para mantener el estado del fade
    });
  } else {
    // Guardamos el volumen actual antes de empezar
    const currentVolume = music.volume;
    music.volume = 0; // Comenzamos desde silencio
    music.play().then(() => {
      isPlaying = true;
      musicButton.textContent = '⏸';
      // Si estábamos en medio de un fade out, comenzamos desde ese punto
      fadeIn(currentVolume);
    }).catch(error => {
      console.error('Error al reproducir:', error);
      isPlaying = false;
      musicButton.textContent = '▶';
    });
  }
}

function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  loadCurrentSong();
  if (isPlaying) {
    music.volume = 0;
    music.play().then(() => {
      fadeIn();
    });
  }
}

function previousSong() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  loadCurrentSong();
  if (isPlaying) {
    music.volume = 0;
    music.play().then(() => {
      fadeIn();
    });
  }
}

function playSongAtIndex(index) {
  currentSongIndex = index;
  loadCurrentSong();
  if (!isPlaying) {
    toggleMusic();
  }
}

// Actualizar la barra de progreso
music.addEventListener('timeupdate', () => {
  const progress = (music.currentTime / music.duration) * 100;
  progressBar.style.width = `${progress}%`;
});

// Permitir cambiar la posición de la canción haciendo clic en la barra de progreso
progressContainer.addEventListener('click', (e) => {
  const clickPosition = e.offsetX / progressContainer.offsetWidth;
  music.currentTime = clickPosition * music.duration;
});

// Reproducir siguiente canción cuando termine la actual
music.addEventListener('ended', () => {
  fadeOut(() => {
    nextSong();
    music.volume = 0;
    music.play().then(() => {
      fadeIn();
    });
  });
});

// Inicializar el reproductor: ya se hace tras cargar `songs` en loadSongs().
// (Evitar inicializar aquí porque `songs` todavía podría estar vacío.)