# Hostname App — Node.js + Docker + GitHub Actions

A simple Node.js application that returns the system hostname, containerized with Docker and automated with GitHub Actions CI/CD.

---

## Project Structure

```
.
├── app.js                          # Node.js application
├── package.json                    # Node.js dependencies
├── Dockerfile                      # Docker image definition
├── .dockerignore                   # Files excluded from Docker build
└── .github/workflows/
    └── docker-publish.yml          # GitHub Actions CI/CD pipeline
```

---

## Step 1: Develop the Node.js Application

### `app.js`

- Uses the **Express** framework to create an HTTP server running on port **3000**.
- Uses Node.js built-in `os.hostname()` method to retrieve the system hostname.
- Exposes a single `GET /` endpoint that returns a JSON response:
  ```json
  {
    "hostname": "your-machine-name",
    "message": "Hello from hostname-app!"
  }
  ```

### Run Locally

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

---

## Step 2: Create a Docker Image

### `Dockerfile`

- **Base image:** `node:18-alpine` — a lightweight Node.js image (~50 MB).
- **Working directory:** `/app` inside the container.
- **Dependency install:** Copies `package.json` first and runs `npm install --production` to leverage Docker layer caching (dependencies are only reinstalled when `package.json` changes).
- **Copy source code:** Copies `app.js` into the container.
- **Expose port:** Declares port `3000` for the container.
- **Startup command:** Runs `node app.js` when the container starts.

### Build the Docker Image

```bash
docker build -t hostname-app .
```

### Run the Docker Container

```bash
docker run -p 3000:3000 hostname-app
```

Visit http://localhost:3000 — the hostname returned will be the **container ID**, since Docker assigns its own hostname to each container.

---

## Step 3: Push the Docker Image to Docker Hub

### 3.1 Log in to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password/token when prompted.

### 3.2 Tag the Image

```bash
docker tag hostname-app <your-dockerhub-username>/hostname-app:latest
```

Replace `<your-dockerhub-username>` with your actual Docker Hub username.

### 3.3 Push the Image

```bash
docker push <your-dockerhub-username>/hostname-app:latest
```

The image is now publicly available on Docker Hub and can be pulled by anyone:

```bash
docker pull <your-dockerhub-username>/hostname-app:latest
```

---

## Step 4: Automate with GitHub Actions

### `.github/workflows/docker-publish.yml`

This workflow automates the Docker build and push process every time code is pushed to the `main` branch.

### How It Works

1. **Trigger:** Runs on every `push` or `pull_request` to the `main` branch.
2. **Checkout:** Clones the repository code using `actions/checkout@v4`.
3. **Docker Hub Login:** Authenticates to Docker Hub using stored repository secrets.
4. **Build & Push:** Uses `docker/build-push-action@v5` to:
   - Build the Docker image from the `Dockerfile`.
   - Push the image with two tags:
     - `latest` — always points to the most recent build.
     - `<commit-sha>` — unique tag for traceability.
   - On pull requests, the image is **built only** (not pushed) to validate the Dockerfile.

### Required GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**, and add:

| Secret Name          | Value                                                                 |
|----------------------|-----------------------------------------------------------------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username                                              |
| `DOCKERHUB_TOKEN`    | A Docker Hub access token (create at Docker Hub → Account Settings → Security) |

---

## Summary

| Step | Action                        | Tool/Service    |
|------|-------------------------------|-----------------|
| 1    | Develop the application       | Node.js/Express |
| 2    | Create a Docker image         | Docker          |
| 3    | Push image to Docker Hub      | Docker CLI      |
| 4    | Automate build and push       | GitHub Actions  |
