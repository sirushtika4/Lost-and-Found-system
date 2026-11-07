# Docker guide — Campus Lost and Found

## What is included
- `client`: React + Vite frontend, built into static files and served by Nginx.
- `server`: Express API.
- Docker Compose starts both services together.
- The backend connects to the existing Windows MongoDB database `lost_found_db` through `host.docker.internal`. No MongoDB container is created. See `MONGODB-GUIDE.md` for setup and preservation checks.

## Requirements
Configure the private JWT_SECRET as described in `AUTHENTICATION.md` before
starting Compose. Examples contain no real secrets. Docker localhost uses
AUTH_MODE=local; public production deployment requires HTTPS and Secure cookies.

Install Docker Engine and the Docker Compose plugin, then verify:
```bash
docker --version
docker compose version
```

## Run from the project root
Use `D:\Lost-and-Found-system-main (1)\Lost-and-Found-Recovered`.

```bash
docker compose build --builder campus-build-recovery
docker compose up
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
docker compose up -d
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
- The backend starts after auth configuration validation and its initial MongoDB connection succeed. `/api/health` reports 200/`connected` after a live ping, or 503/`disconnected` if the connection fails after startup. Registration, login, current-user lookup and logout now use HttpOnly cookies; see `AUTHENTICATION.md`. Item-management and claim APIs remain unimplemented.
- Do not commit real `.env` secrets to Git.
