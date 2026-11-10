# Docker guide — Campus Lost and Found

## Requirements

Install Docker Engine and the Docker Compose plugin. Configure the required JWT secret and SMTP settings in a root `.env` file, then start the services:

```bash
cp server/.env.example .env
openssl rand -hex 32
# Set JWT_SECRET to the generated value and fill in the SMTP_* settings in .env.
docker compose up --build
```

Open the app at http://localhost:8080. The API is at http://localhost:5000 and its health endpoint is http://localhost:5000/api/health.

To run in the background, use `docker compose up --build -d`. Follow logs with `docker compose logs -f`; stop and remove containers with `docker compose down`.

The frontend is built with `VITE_API_URL=http://localhost:5000/api`, which is the URL the user's browser uses to reach the API. The backend allows the frontend origin `http://localhost:8080`. Nginx serves the built frontend and falls back to `index.html` for client-side routes. Compose waits for the backend health check before starting the frontend.

MongoDB stores accounts in the `mongodb_data` Docker volume. Passwords are hashed, session tokens are signed using `JWT_SECRET`, and password reset codes expire after 10 minutes and can only be used once. By default, Mailpit captures local reset emails; view them at http://localhost:8025. To deliver codes to real email addresses, replace `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env` with your email provider's SMTP settings. For Gmail, use `smtp.gmail.com`, port `587`, and an app password as `SMTP_PASS`. Use a strong random `JWT_SECRET` and never commit `.env` or real SMTP credentials.

The API and authentication are now backed by MongoDB, but claim verification and other database-backed item workflows are still outside this setup.
