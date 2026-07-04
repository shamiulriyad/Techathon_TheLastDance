# Smart Office IUT Combined

This project combines:

- `frontend`: the Smart Office Dashboard React/Vite UI.
- `backend`: the IUT Express, Socket.IO, SQLite, simulator, and optional Discord bot backend.

## Run

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## Environment

Frontend uses:

```bash
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Backend can be configured from `backend/.env.example`. The Discord bot is optional; leave `DISCORD_TOKEN` empty to run without it.
