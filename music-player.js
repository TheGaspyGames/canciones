// Variables globales
const DEFAULT_COVER = 'assets/default-cover.png';
let songs = [];
let currentPage = 1;
const songsPerPage = 24;

// Variables globales del reproductor
let currentSongIndex = 0;
let isPlaying = false;
let fadeInterval = null;
let music, musicButton, currentSongElement, progressBar, progressContainer, playlist;

// Función para formatear el tamaño del archivo
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function populateSelectOptions(select, values, defaultLabel) {
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.textContent = defaultLabel;
  select.appendChild(defaultOption);

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  if (values.includes(previousValue)) {
    select.value = previousValue;
  }
}

function updateFilters() {
  const genreSelect = document.getElementById('genre-filter');
  const modelSelect = document.getElementById('model-filter');

  const genres = Array.from(new Set(
    songs
      .map((song) => song.genre)
      .filter((genre) => typeof genre === 'string' && genre.trim() !== '')
  )).sort((a, b) => a.localeCompare(b, 'es'));

  const models = Array.from(new Set(
    songs
      .map((song) => song.aiModel)
      .filter((model) => typeof model === 'string' && model.trim() !== '')
  )).sort((a, b) => a.localeCompare(b, 'es'));

  populateSelectOptions(genreSelect, genres, 'Todos los géneros');
  populateSelectOptions(modelSelect, models, 'Todos los modelos');
}

function showUploadStatus(message, status = '') {
  const statusElement = document.getElementById('uploadStatus');
  if (!statusElement) return;

  statusElement.textContent = message;
  statusElement.classList.remove('error', 'success');
  if (status) {
    statusElement.classList.add(status);
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function formatTitleFromFileName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Inicializar variables del reproductor
function initializePlayerElements() {
  music = document.getElementById('bgMusic');
  musicButton = document.getElementById('musicToggle');
  currentSongElement = document.getElementById('currentSong');
  progressBar = document.getElementById('progressBar');
  progressContainer = document.getElementById('progressContainer');
  playlist = document.getElementById('playlist');
  
  // Inicializar eventos del reproductor
  if (music && progressContainer) {
    // Actualizar la barra de progreso mientras se reproduce
    music.addEventListener('timeupdate', () => {
      if (!isNaN(music.duration)) {
        const progress = (music.currentTime / music.duration) * 100;
        progressBar.style.width = `${progress}%`;
      }
    });

    // Permitir hacer clic y arrastrar en la barra de progreso
    let isDragging = false;

    progressContainer.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateProgress(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        updateProgress(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Función para actualizar el progreso
    function updateProgress(e) {
      const rect = progressContainer.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      if (clickPosition >= 0 && clickPosition <= 1) {
        music.currentTime = clickPosition * music.duration;
      }
    }

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
  }
}

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

    refreshInterface({ resetPage: true });
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
    const title = song.title || '';
    const songGenre = song.genre || '';
    const songModel = song.aiModel || '';
    const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = genre === 'all' || songGenre === genre;
    const matchesModel = model === 'all' || songModel === model;
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

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / songsPerPage));
  if (currentPage > totalPages) {
    currentPage = totalPages;
  }
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
  defaultImage.src = DEFAULT_COVER;

  displayedSongs.forEach((song) => {
    // Encontrar el índice real en el array completo de canciones
    const realIndex = songs.findIndex(s => s.id === song.id);
    const fallbackIndex = songs.indexOf(song);
    const songIndex = realIndex !== -1 ? realIndex : Math.max(fallbackIndex, 0);
    const songDate = song.date || 'Fecha desconocida';
    const songModel = song.aiModel || 'Modelo desconocido';
    const songGenre = song.genre || 'Sin género';
    const songSize = typeof song.size === 'number' ? `<span class="song-size">💾 ${formatFileSize(song.size)}</span>` : '';
    const downloadName = song.downloadName || song.title || 'cancion.mp3';
    const card = document.createElement('div');
    card.className = 'music-card';
    card.innerHTML = `
      <div class="card-image" onclick="playSongAtIndex(${songIndex})">
        <img
          src="${song.cover || DEFAULT_COVER}"
          alt="${song.title}"
          loading="lazy"
          onerror="this.onerror=null; this.src='${DEFAULT_COVER}'; this.classList.add('default-cover')">
        <div class="play-overlay">
          <span class="play-icon">▶</span>
        </div>
      </div>
      <div class="card-content">
        <h3>${song.title}</h3>
        <div class="song-meta">
          <span class="song-date">📅 ${songDate}</span>
          <span class="song-model">🤖 ${songModel}</span>
          <span class="song-genre">🎵 ${songGenre}</span>
          ${songSize}
        </div>
        <div class="card-actions">
          <a href="${song.file}" download="${downloadName}" class="download-button" onclick="event.stopPropagation()">
            <span class="download-icon">⬇️</span> Descargar
          </a>
          <button class="play-button" onclick="playSongAtIndex(${songIndex})">
            <span>▶️</span> Reproducir
          </button>
        </div>
      </div>
    `;
    musicGrid.appendChild(card);
  });
}

function refreshInterface({ resetPage = false } = {}) {
  if (resetPage) {
    currentPage = 1;
  }

  updateFilters();
  generateMusicCards();
  initializePlaylist();

  if (!songs.length) {
    if (playlist) {
      playlist.innerHTML = '<div class="playlist-empty">No hay canciones cargadas todavía</div>';
    }
    if (currentSongElement) {
      currentSongElement.textContent = 'Selecciona una canción';
    }
    if (music) {
      music.pause();
      music.removeAttribute('src');
    }
    return;
  }

  if (currentSongIndex >= songs.length) {
    currentSongIndex = 0;
  }

  loadCurrentSong();
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
    const totalPages = Math.max(1, Math.ceil(filteredSongs.length / songsPerPage));
    if (currentPage < totalPages) {
      currentPage++;
    }
  }
  generateMusicCards();
}

// Funciones del reproductor
function initializePlaylist() {
  if (!playlist) return;

  if (!songs.length) {
    playlist.innerHTML = '<div class="playlist-empty">No hay canciones cargadas todavía</div>';
    return;
  }

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
  if (!music) return;

  const song = songs[currentSongIndex];
  if (!song) {
    music.pause();
    music.removeAttribute('src');
    if (currentSongElement) {
      currentSongElement.textContent = 'Selecciona una canción';
    }
    updatePlaylistSelection();
    return;
  }

  music.src = song.file;
  if (currentSongElement) {
    currentSongElement.textContent = song.title;
  }
  if (isPlaying) {
    music.play();
  }
  updatePlaylistSelection();
}

// Funciones de fade para el audio
function fadeOut(callback) {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  
  const duration = 400; // Duración más corta para el fade out
  const steps = 30;
  const stepTime = duration / steps;
  const initialVolume = music.volume || lastKnownVolume;
  
  let currentStep = 0;
  
  fadeInterval = setInterval(() => {
    currentStep++;
    if (currentStep <= steps) {
      const factor = Math.pow((steps - currentStep) / steps, 2);
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
  
  const duration = 400; // Duración más corta para el fade in
  const steps = 30;
  const stepTime = duration / steps;
  const startVolume = music.volume;
  targetVolume = Math.max(0.1, Math.min(1, targetVolume)); // Asegurar un volumen válido
  
  let currentStep = 0;
  
  fadeInterval = setInterval(() => {
    currentStep++;
    if (currentStep <= steps) {
      const factor = Math.pow(currentStep / steps, 2);
      music.volume = startVolume + (targetVolume - startVolume) * factor;
    } else {
      music.volume = targetVolume;
      lastKnownVolume = targetVolume; // Actualizar el último volumen conocido
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }, stepTime);
}

// Control de reproducción
let lastKnownVolume = 1; // Variable global para mantener el último volumen conocido

function toggleMusic() {
  if (!music) return;

  if (!music.src) {
    console.warn('No hay una canción seleccionada');
    return;
  }

  if (isPlaying) {
    // Si está reproduciendo, pausar
    lastKnownVolume = music.volume > 0 ? music.volume : lastKnownVolume; // Guardar volumen actual
    fadeOut(() => {
      music.pause();
      isPlaying = false;
      musicButton.textContent = '▶';
    });
  } else {
    // Si está pausado, reproducir
    music.volume = 0; // Empezamos desde silencio
    
    // Intentar reproducir y manejar la promesa
    try {
      music.play()
        .then(() => {
          isPlaying = true;
          musicButton.textContent = '⏸';
          fadeIn(lastKnownVolume); // Usar el último volumen conocido
        })
        .catch(error => {
          console.error('Error al reproducir:', error);
          isPlaying = false;
          musicButton.textContent = '▶';
        });
    } catch (error) {
      console.error('Error al intentar reproducir:', error);
      isPlaying = false;
      musicButton.textContent = '▶';
    }
  }
}

function nextSong() {
  if (!songs.length) return;
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
  if (!songs.length) return;
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
  if (!songs.length) return;
  if (index < 0 || index >= songs.length) {
    console.warn('Índice de canción inválido:', index);
    return;
  }
  currentSongIndex = index;
  loadCurrentSong();
  if (!isPlaying) {
    toggleMusic();
  }
}

function setupUploadForm() {
  const uploadForm = document.getElementById('uploadForm');
  if (!uploadForm) return;

  const fileInput = document.getElementById('songFile');
  const titleInput = document.getElementById('songTitle');
  const genreInput = document.getElementById('songGenre');
  const modelInput = document.getElementById('songModel');
  const coverInput = document.getElementById('coverFile');

  fileInput?.addEventListener('change', () => {
    if (fileInput.files?.length) {
      const [file] = fileInput.files;
      if (file && titleInput && !titleInput.value.trim()) {
        titleInput.value = formatTitleFromFileName(file.name);
      }
    }
  });

  uploadForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const file = fileInput?.files?.[0];
    if (!file) {
      showUploadStatus('Selecciona un archivo de audio para continuar.', 'error');
      return;
    }

    showUploadStatus('Procesando canción...');

    try {
      const coverFile = coverInput?.files?.[0];
      const coverUrl = coverFile ? await fileToDataURL(coverFile) : DEFAULT_COVER;
      const title = titleInput?.value.trim() || formatTitleFromFileName(file.name) || file.name;
      const genre = genreInput?.value.trim() || 'Sin género';
      const aiModel = modelInput?.value.trim() || 'Personal';

      const newSong = {
        id: `local-${Date.now()}`,
        title,
        file: URL.createObjectURL(file),
        cover: coverUrl,
        date: new Date().toISOString().slice(0, 10),
        size: file.size,
        genre,
        aiModel,
        isLocal: true,
        downloadName: file.name
      };

      songs.unshift(newSong);
      currentSongIndex = 0;
      refreshInterface({ resetPage: true });

      showUploadStatus('Canción subida correctamente. ¡A disfrutar!', 'success');
      uploadForm.reset();
    } catch (error) {
      console.error('Error al cargar la canción local:', error);
      showUploadStatus('No se pudo cargar la canción. Intenta nuevamente.', 'error');
    }
  });
}

// Inicializar la interfaz cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('Documento cargado, iniciando carga de canciones...');
  initializePlayerElements();
  setupUploadForm();
  loadSongs();
});