// Menú de hamburguesa
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

menuToggle.addEventListener('click', () => {
  menuToggle.classList.toggle('active');
  mainNav.classList.toggle('active');
});

// Cerrar el menú al hacer clic fuera
document.addEventListener('click', (e) => {
  if (!menuToggle.contains(e.target) && !mainNav.contains(e.target)) {
    menuToggle.classList.remove('active');
    mainNav.classList.remove('active');
  }
});

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
        const response = await fetch('songs.json');
        const data = await response.json();
        songs = data.songs;
        initializeMusicPlayer();
        updatePagination();
    } catch (error) {
        console.error('Error cargando las canciones:', error);
        document.querySelector('.music-grid').innerHTML = `
            <div class="error-message">
                Error cargando las canciones. Por favor, intenta recargar la página.
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
    const musicGrid = document.querySelector('.music-grid');
    const displayedSongs = updatePagination();
    
    musicGrid.innerHTML = '';
    displayedSongs.forEach((song, index) => {
        const card = document.createElement('div');
        card.className = 'music-card';
        card.innerHTML = `
            <div class="card-image" onclick="playSongAtIndex(${index})">
                <img src="${song.cover}" alt="${song.title}" onerror="this.src='assets/default-cover.png'">
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
                    <button class="play-button" onclick="playSongAtIndex(${index})">
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
generateMusicCards();

// Reproductor de música
let currentSongIndex = 0;
let isPlaying = false;
const music = document.getElementById('bgMusic');
const musicButton = document.getElementById('musicToggle');
const currentSongElement = document.getElementById('currentSong');
const progressBar = document.getElementById('progressBar');
const progressContainer = document.getElementById('progressContainer');
const playlist = document.getElementById('playlist');

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

function toggleMusic() {
  if (isPlaying) {
    music.pause();
    musicButton.textContent = '▶';
  } else {
    music.play();
    musicButton.textContent = '⏸';
  }
  isPlaying = !isPlaying;
}

function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  loadCurrentSong();
}

function previousSong() {
  currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
  loadCurrentSong();
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
  nextSong();
});

// Inicializar el reproductor
initializePlaylist();
loadCurrentSong();