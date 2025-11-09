// Variables globales
const DEFAULT_COVER = 'assets/default-cover.png';
const DISCORD_ALLOWED_USER_ID = window.DISCORD_ALLOWED_USER_ID || '684395420004253729';
const DISCORD_CLIENT_ID = window.DISCORD_CLIENT_ID || 'REEMPLAZA_CON_TU_CLIENT_ID';
const DISCORD_SCOPE = 'identify';
const DISCORD_STORAGE_KEY = 'discordAccessToken';
const DISCORD_REDIRECT_URI =
  window.DISCORD_REDIRECT_URI || `${window.location.origin}${window.location.pathname}`;
const DISCORD_AUTH_BASE = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_ENDPOINT = 'https://discord.com/api/oauth2/token';
const DISCORD_CODE_VERIFIER_KEY = 'discordCodeVerifier';

const GITHUB_OWNER = window.GITHUB_OWNER || 'thegaspygames';
const GITHUB_REPO = window.GITHUB_REPO || 'canciones';
const GITHUB_BRANCH = window.GITHUB_BRANCH || 'main';
const GITHUB_SONGS_PATH = window.GITHUB_SONGS_PATH || 'songs.json';
const GITHUB_MUSIC_DIR = window.GITHUB_MUSIC_DIR || 'music';
const GITHUB_COVER_DIR = window.GITHUB_COVER_DIR || 'assets/covers';
const GITHUB_API_BASE = 'https://api.github.com';

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

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .toLowerCase();
}

function extractExtension(fileName, fallback = '') {
  const match = /\.([^.]+)$/.exec(fileName || '');
  return match ? match[1].toLowerCase() : fallback;
}

function uint8ArrayToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function arrayBufferToBase64(buffer) {
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(arrayBufferToBase64(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function encodeStringToBase64(value) {
  if (typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    return uint8ArrayToBase64(encoder.encode(value));
  }
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64ToString(base64Value) {
  const binary = atob(base64Value);
  if (typeof TextDecoder !== 'undefined') {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(escape(binary));
}

function base64UrlEncodeFromUint8(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i += 1) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return base64UrlEncodeFromUint8(array);
}

async function createCodeChallenge(verifier) {
  if (window.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncodeFromUint8(new Uint8Array(digest));
  }
  throw new Error('Tu navegador no soporta la autenticación segura de Discord (PKCE).');
}

async function beginDiscordLogin() {
  try {
    const verifier = generateCodeVerifier();
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem(DISCORD_CODE_VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: DISCORD_CLIENT_ID,
      scope: DISCORD_SCOPE,
      redirect_uri: DISCORD_REDIRECT_URI,
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    window.location.href = `${DISCORD_AUTH_BASE}?${params.toString()}`;
  } catch (error) {
    console.error('No se pudo iniciar la autenticación con Discord:', error);
    updateDiscordStatus('No se pudo iniciar la autenticación con Discord. Intenta nuevamente.', 'error');
  }
}

function buildRawGitHubUrl(path) {
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
}

function isGitHubConfigured() {
  if (
    !GITHUB_OWNER ||
    !GITHUB_REPO ||
    !GITHUB_BRANCH ||
    !GITHUB_SONGS_PATH ||
    !GITHUB_MUSIC_DIR ||
    !GITHUB_COVER_DIR
  ) {
    return {
      valid: false,
      reason: 'Configura los datos de GitHub en assets/config.js para habilitar las subidas seguras.'
    };
  }
  return { valid: true };
}

async function githubRequest(path, { method = 'GET', token, body } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    let details = '';
    try {
      const errorPayload = await response.json();
      details = errorPayload?.message ? `: ${errorPayload.message}` : '';
    } catch (parseError) {
      details = `: ${response.statusText}`;
    }
    throw new Error(`GitHub respondió ${response.status}${details}`);
  }

  return response.json();
}

async function fetchGitHubFile(path, token) {
  return githubRequest(`${path}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, { token });
}

async function putGitHubFile(path, base64Content, token, message, sha) {
  const body = {
    message,
    content: base64Content,
    branch: GITHUB_BRANCH
  };

  if (sha) {
    body.sha = sha;
  }

  return githubRequest(path, {
    method: 'PUT',
    token,
    body
  });
}

async function fetchGitHubJson(path, token) {
  const payload = await fetchGitHubFile(path, token);
  const decoded = decodeBase64ToString(payload.content);
  return {
    sha: payload.sha,
    json: JSON.parse(decoded)
  };
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

function updateDiscordStatus(message, type = '') {
  const statusElements = [
    document.getElementById('discordStatus'),
    document.getElementById('discordBannerStatus')
  ].filter(Boolean);

  statusElements.forEach((element) => {
    element.textContent = message;
    element.classList.remove('error', 'success');
    if (type) {
      element.classList.add(type);
    }
  });
}

function setCreatorSectionVisible(isVisible) {
  const creatorSection = document.getElementById('creator-tools');
  if (!creatorSection) return;

  creatorSection.classList.toggle('hidden', !isVisible);
  creatorSection.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function setLoginBannerVisible(isVisible) {
  const banner = document.getElementById('discordGateBanner');
  if (!banner) return;

  banner.classList.toggle('hidden', !isVisible);
  banner.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function formatDiscordDisplayName(profile) {
  if (!profile) return 'usuario';
  if (profile.global_name) return profile.global_name;
  if (profile.discriminator && profile.discriminator !== '0') {
    return `${profile.username}#${profile.discriminator}`;
  }
  return profile.username || 'usuario';
}

function toggleUploadVisibility(isVisible) {
  const uploadWrapper = document.getElementById('uploadWrapper');
  if (!uploadWrapper) return;

  uploadWrapper.classList.toggle('hidden', !isVisible);
  uploadWrapper.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
  setUploadFormEnabled(isVisible);
}

function setUploadFormEnabled(isEnabled) {
  const uploadForm = document.getElementById('uploadForm');
  if (!uploadForm) return;

  uploadForm
    .querySelectorAll('input, button, select, textarea')
    .forEach((element) => {
      element.disabled = !isEnabled;
    });
}

function isDiscordOAuthConfigured() {
  if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID === 'REEMPLAZA_CON_TU_CLIENT_ID') {
    return {
      valid: false,
      reason: 'Configura tu CLIENT ID de Discord en assets/config.js para habilitar el acceso.'
    };
  }

  if (
    !DISCORD_REDIRECT_URI ||
    DISCORD_REDIRECT_URI.startsWith('file://') ||
    DISCORD_REDIRECT_URI === 'null' ||
    DISCORD_REDIRECT_URI === 'undefined'
  ) {
    return {
      valid: false,
      reason: 'Debes alojar la página con HTTPS y definir un redirect URI autorizado para Discord.'
    };
  }

  return { valid: true };
}

function storeDiscordToken(token, expiresInSeconds, refreshToken) {
  if (!token) return;
  const expiresAt = Date.now() + (Number(expiresInSeconds) || 3600) * 1000;
  const payload = JSON.stringify({
    token,
    expiresAt,
    refreshToken: refreshToken || null
  });
  sessionStorage.setItem(DISCORD_STORAGE_KEY, payload);
}

function readStoredDiscordToken() {
  const raw = sessionStorage.getItem(DISCORD_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.token || !parsed.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(DISCORD_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('No se pudo leer el token de Discord:', error);
    sessionStorage.removeItem(DISCORD_STORAGE_KEY);
    return null;
  }
}

function clearDiscordToken() {
  sessionStorage.removeItem(DISCORD_STORAGE_KEY);
  sessionStorage.removeItem(DISCORD_CODE_VERIFIER_KEY);
}

async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem(DISCORD_CODE_VERIFIER_KEY);
  if (!verifier) {
    throw new Error('No se encontró el verificador PKCE. Inicia sesión nuevamente.');
  }

  sessionStorage.removeItem(DISCORD_CODE_VERIFIER_KEY);

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_REDIRECT_URI,
    code_verifier: verifier
  });

  const response = await fetch(DISCORD_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord rechazó el intercambio de código (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Discord no devolvió un token de acceso válido.');
  }

  storeDiscordToken(data.access_token, data.expires_in, data.refresh_token);
  return data.access_token;
}

function cleanDiscordOAuthParams() {
  const url = new URL(window.location.href);
  ['code', 'state', 'error', 'error_description'].forEach((param) => {
    url.searchParams.delete(param);
  });
  const newSearch = url.searchParams.toString();
  const newUrl = `${url.pathname}${newSearch ? `?${newSearch}` : ''}${url.hash}`;
  if (history.replaceState) {
    history.replaceState(null, document.title, newUrl);
  } else {
    window.location.search = newSearch ? `?${newSearch}` : '';
  }
}

async function handleDiscordRedirect() {
  const url = new URL(window.location.href);
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const code = url.searchParams.get('code');

  if (!error && !code) {
    return null;
  }

  if (error) {
    const details = decodeURIComponent(errorDescription || error);
    updateDiscordStatus(`Discord canceló la autorización: ${details}`, 'error');
    cleanDiscordOAuthParams();
    clearDiscordToken();
    return null;
  }

  if (!code) {
    cleanDiscordOAuthParams();
    return null;
  }

  try {
    updateDiscordStatus('Validando la autorización de Discord...');
    const token = await exchangeCodeForToken(code);
    cleanDiscordOAuthParams();
    return token;
  } catch (error) {
    console.error('Error al procesar el código de Discord:', error);
    updateDiscordStatus('No se pudo completar la autenticación con Discord. Intenta nuevamente.', 'error');
    cleanDiscordOAuthParams();
    clearDiscordToken();
    return null;
  }
}

async function fetchDiscordProfile(token) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord respondió ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function initializeDiscordGate() {
  const loginButton = document.getElementById('discordLoginButton');
  const logoutButton = document.getElementById('discordLogoutButton');
  const configCheck = isDiscordOAuthConfigured();

  setCreatorSectionVisible(false);
  setLoginBannerVisible(true);
  toggleUploadVisibility(false);
  updateDiscordStatus('Conéctate con Discord para acceder al panel privado.');

  if (!loginButton) return;

  if (!configCheck.valid) {
    loginButton.disabled = true;
    logoutButton?.setAttribute('disabled', 'true');
    updateDiscordStatus(configCheck.reason, 'error');
    return;
  }

  loginButton.addEventListener('click', () => {
    beginDiscordLogin();
  });

  logoutButton?.addEventListener('click', () => {
    clearDiscordToken();
    setCreatorSectionVisible(false);
    setLoginBannerVisible(true);
    toggleUploadVisibility(false);
    updateDiscordStatus('Sesión cerrada. Conéctate nuevamente para subir canciones.');
    loginButton.disabled = false;
    logoutButton?.removeAttribute('disabled');
  });

  const redirectedToken = await handleDiscordRedirect();
  const storedSession = readStoredDiscordToken();
  const token = redirectedToken || storedSession?.token;
  if (!token) {
    loginButton.disabled = false;
    setCreatorSectionVisible(false);
    setLoginBannerVisible(true);
    return;
  }

  try {
    updateDiscordStatus('Verificando tu cuenta de Discord...');
    const profile = await fetchDiscordProfile(token);

    if (profile.id !== DISCORD_ALLOWED_USER_ID) {
      updateDiscordStatus(
        'Esta cuenta de Discord no coincide con la autorizada para administrar las canciones.',
        'error'
      );
      clearDiscordToken();
      loginButton.disabled = false;
      setCreatorSectionVisible(false);
      setLoginBannerVisible(true);
      return;
    }

    loginButton.disabled = true;
    setLoginBannerVisible(false);
    setCreatorSectionVisible(true);
    logoutButton?.removeAttribute('disabled');

    const githubCheck = isGitHubConfigured();
    if (!githubCheck.valid) {
      toggleUploadVisibility(false);
      updateDiscordStatus(
        `Acceso concedido, pero ${githubCheck.reason}`,
        'error'
      );
      return;
    }

    toggleUploadVisibility(true);
    updateDiscordStatus(`Acceso concedido. Bienvenido, ${formatDiscordDisplayName(profile)}.`, 'success');
  } catch (error) {
    console.error('Error al validar el token de Discord:', error);
    updateDiscordStatus('No se pudo verificar tu cuenta de Discord. Intenta nuevamente.', 'error');
    clearDiscordToken();
    loginButton.disabled = false;
    setCreatorSectionVisible(false);
    setLoginBannerVisible(true);
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

async function uploadSongToGitHub({ file, coverFile, title, genre, aiModel, token, commitMessage }) {
  const sanitizedTitle = title || formatTitleFromFileName(file.name) || 'Canción AI';
  const baseSlug = slugify(sanitizedTitle) || 'cancion-ai';
  const uniqueSuffix = Date.now();
  const audioExtension = extractExtension(file.name, 'mp3');
  const baseFileName = `${baseSlug}-${uniqueSuffix}`;
  const audioRepoPath = `${GITHUB_MUSIC_DIR}/${baseFileName}.${audioExtension}`;

  const audioBase64 = await readFileAsBase64(file);
  const audioMessage = commitMessage || `Añadir canción ${sanitizedTitle}`;
  await putGitHubFile(audioRepoPath, audioBase64, token, audioMessage);

  let coverRepoPath = '';
  if (coverFile) {
    const coverExtension = extractExtension(coverFile.name, 'png');
    coverRepoPath = `${GITHUB_COVER_DIR}/${baseFileName}.${coverExtension}`;
    const coverBase64 = await readFileAsBase64(coverFile);
    const coverMessage = commitMessage
      ? `${commitMessage} (portada)`
      : `Añadir portada para ${sanitizedTitle}`;
    await putGitHubFile(coverRepoPath, coverBase64, token, coverMessage);
  }

  let songsData;
  try {
    songsData = await fetchGitHubJson(GITHUB_SONGS_PATH, token);
  } catch (error) {
    throw new Error(`No se pudo leer ${GITHUB_SONGS_PATH} en GitHub. ${error.message}`);
  }

  if (!Array.isArray(songsData.json.songs)) {
    songsData.json.songs = [];
  }

  const newSongEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `song-${uniqueSuffix}`,
    title: sanitizedTitle,
    file: audioRepoPath,
    cover: coverRepoPath || DEFAULT_COVER,
    date: new Date().toISOString().slice(0, 10),
    size: file.size,
    genre,
    aiModel,
    downloadName: `${baseFileName}.${audioExtension}`
  };

  songsData.json.songs = songsData.json.songs.filter((song) => song.file !== audioRepoPath);
  songsData.json.songs.unshift(newSongEntry);
  const updatedContent = `${JSON.stringify(songsData.json, null, 2)}\n`;
  const songsMessage = commitMessage
    ? `${commitMessage} (actualizar songs.json)`
    : `Actualizar songs.json con ${sanitizedTitle}`;

  await putGitHubFile(
    GITHUB_SONGS_PATH,
    encodeStringToBase64(updatedContent),
    token,
    songsMessage,
    songsData.sha
  );

  return {
    repoSong: newSongEntry,
    clientSong: {
      ...newSongEntry,
      file: buildRawGitHubUrl(audioRepoPath),
      cover: coverRepoPath ? buildRawGitHubUrl(coverRepoPath) : DEFAULT_COVER
    }
  };
}

function setupUploadForm() {
  const uploadForm = document.getElementById('uploadForm');
  if (!uploadForm) return;

  const fileInput = document.getElementById('songFile');
  const titleInput = document.getElementById('songTitle');
  const genreInput = document.getElementById('songGenre');
  const modelInput = document.getElementById('songModel');
  const coverInput = document.getElementById('coverFile');
  const tokenInput = document.getElementById('githubToken');
  const commitMessageInput = document.getElementById('commitMessage');

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

    const githubCheck = isGitHubConfigured();
    if (!githubCheck.valid) {
      showUploadStatus(githubCheck.reason, 'error');
      return;
    }

    const token = tokenInput?.value.trim();
    if (!token) {
      showUploadStatus('Ingresa tu token personal de GitHub para continuar.', 'error');
      return;
    }

    showUploadStatus('Subiendo canción al repositorio... Esto puede tardar unos segundos.');
    setUploadFormEnabled(false);

    try {
      const coverFile = coverInput?.files?.[0];
      const title = titleInput?.value.trim() || formatTitleFromFileName(file.name) || file.name;
      const genre = genreInput?.value.trim() || 'Sin género';
      const aiModel = modelInput?.value.trim() || 'Personal';
      const commitMessage = commitMessageInput?.value.trim() || '';

      const { clientSong, repoSong } = await uploadSongToGitHub({
        file,
        coverFile,
        title,
        genre,
        aiModel,
        token,
        commitMessage
      });

      songs = songs.filter((song) => song.id !== clientSong.id);
      songs.unshift(clientSong);
      currentSongIndex = 0;
      refreshInterface({ resetPage: true });

      showUploadStatus('Canción subida y guardada en GitHub correctamente. ¡Listo!', 'success');
      uploadForm.reset();
      if (tokenInput) {
        tokenInput.value = '';
      }
      console.info('Canción añadida al repositorio:', repoSong);
    } catch (error) {
      console.error('Error al subir la canción al repositorio:', error);
      showUploadStatus(error.message || 'No se pudo subir la canción. Intenta nuevamente.', 'error');
    }
    setUploadFormEnabled(true);
  });
}

// Inicializar la interfaz cuando el documento esté listo
document.addEventListener('DOMContentLoaded', () => {
  console.log('Documento cargado, iniciando carga de canciones...');
  initializePlayerElements();
  initializeDiscordGate();
  setupUploadForm();
  loadSongs();
});
