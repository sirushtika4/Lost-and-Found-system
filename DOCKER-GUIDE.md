# Docker guide — Campus Lost and Found

## What is included
- `client`: React + Vite frontend, built into static files and served by Nginx.
- `server`: Express API.
- Docker Compose starts both services together.
- The current server health route explicitly says the database is not connected yet, so this setup does **not** add a database service or claim that persistence is implemented.

## Requirements
Install Docker Engine and the Docker Compose plugin, then verify:
```bash
docker --version
docker compose version
```

## Run from the project root
```bash
docker compose up --build
```
Open:
- Frontend: http://localhost:8080
- Backend root: http://localhost:5000/
- API health check: http://localhost:5000/api/health

Stop with `Ctrl+C`, then:
```bash
docker compose down
```

Run in background:
```bash
docker compose up --build -d
```
View logs:
```bash
docker compose logs -f
```
Stop background containers:
```bash
docker compose down
```

## Notes
- The frontend is built with `VITE_API_URL=http://localhost:5000/api`. This URL is used by the browser on the host computer.
- Backend CORS allows `http://localhost:8080` through `CLIENT_URL`.
- The current backend is a basic API skeleton. `/api/health` returns `database: not connected yet`; Dockerizing it does not create authentication, database persistence, or complete claim-verification functionality.
- Do not commit real `.env` secrets to Git.
