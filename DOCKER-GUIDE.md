# Docker guide — Campus Lost and Found

## What is included
- `client`: React + Vite frontend, built into static files and served by Nginx.
- `server`: Express API.
- `database`: MongoDB with a persistent Docker volume.
- Docker Compose starts all three services and waits for MongoDB to become healthy before starting the API.

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

The health check reports `database: connected` when the API has an active MongoDB connection.

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
- MongoDB data is stored in the `mongo_data` Docker volume and remains available after containers are recreated. `docker compose down -v` deletes that data.
- The backend currently provides database connectivity but does not yet implement item or claim persistence routes, authentication, or claim verification.
- Do not commit real `.env` secrets to Git.
