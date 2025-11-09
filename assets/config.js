// Configuración pública para integraciones externas.
// Reemplaza los valores por los reales en tu despliegue privado. No incluyas secretos en el repositorio público.

// Discord OAuth
window.DISCORD_CLIENT_ID = window.DISCORD_CLIENT_ID || '1405367857109532732';
window.DISCORD_REDIRECT_URI = window.DISCORD_REDIRECT_URI || 'https://discord.com/oauth2/authorize?client_id=1405367857109532732&response_type=code&redirect_uri=https%3A%2F%2Fthegaspygames.github.io%2Fcanciones&scope=identify';
window.DISCORD_ALLOWED_USER_ID = window.DISCORD_ALLOWED_USER_ID || '684395420004253729';

// GitHub
window.GITHUB_OWNER = window.GITHUB_OWNER || 'thegaspygames';
window.GITHUB_REPO = window.GITHUB_REPO || 'canciones';
window.GITHUB_BRANCH = window.GITHUB_BRANCH || 'main';
window.GITHUB_SONGS_PATH = window.GITHUB_SONGS_PATH || 'songs.json';
window.GITHUB_MUSIC_DIR = window.GITHUB_MUSIC_DIR || 'music';
window.GITHUB_COVER_DIR = window.GITHUB_COVER_DIR || 'assets/covers';
