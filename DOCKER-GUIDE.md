# Docker guide — Campus Lost and Found

## Requirements

Install Docker Engine and the Docker Compose plugin. From this project root, run:

```bash
docker compose up --build
```

Open the app at http://localhost:8080. The API is at http://localhost:5000 and its health endpoint is http://localhost:5000/api/health.

To run in the background, use `docker compose up --build -d`. Follow logs with `docker compose logs -f`; stop and remove containers with `docker compose down`.

The frontend is built with `VITE_API_URL=http://localhost:5000/api`, which is the URL the user's browser uses to reach the API. The backend allows the frontend origin `http://localhost:8080`. Nginx serves the built frontend and falls back to `index.html` for client-side routes. Compose waits for the backend health check before starting the frontend.

The backend currently reports `database: not connected yet`. Docker starts the API and frontend, but does not add database persistence, authentication, or complete claim verification. Do not commit real `.env` secrets.
