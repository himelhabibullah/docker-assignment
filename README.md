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
├── docker-compose.yml              # Multi-container stack (3 app replicas + Nginx)
├── nginx.conf                      # Nginx load balancer configuration
├── ansible/                        # Ansible automation for 4-VM deployment
│   ├── ansible.cfg
│   ├── inventory.ini               # app_servers + proxies groups
│   ├── playbooks/
│   │   ├── 10-docker.yml           # Install Docker on all VMs
│   │   ├── 20-deploy-app.yml       # Deploy app container on 3 app VMs
│   │   ├── 30-nginx.yml            # Run Nginx reverse proxy on proxy VM
│   │   └── site.yml                # Master playbook
│   ├── templates/nginx.conf.j2     # Nginx config (upstream from inventory)
│   └── SETUP_RUNNER.md             # Self-hosted runner setup guide
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
    "commit": "4aa1fc3...",
    "message": "Hello from hostname-app!"
  }
  ```
- The `commit` field is read from the `COMMIT_HASH` env var, which is baked into the image at build time via a Docker `ARG` (the CI pipeline passes `github.sha` as the build-arg).

### Run Locally

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

---

## Step 2: Create a Docker Image

### `Dockerfile`

- **Base image:** `node:22-alpine` — a lightweight Node.js image (~50 MB).
- **Working directory:** `/app` inside the container.
- **Non-root user:** Creates a dedicated `appuser` for security — the container never runs as root.
- **Dependency install:** Uses `npm ci` for deterministic installs from the lockfile, then cleans the npm cache to reduce image size.
- **Copy source code:** Copies `app.js` into the container with proper ownership.
- **Expose port:** Declares port `3000` for the container.
- **Health check:** Built-in `HEALTHCHECK` instruction lets Docker monitor if the app is responding.
- **Startup command:** Runs `node app.js` as the non-root user.

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

The pipeline has **two jobs** that run sequentially:

#### Job 1: Lint & Test

1. **Checkout:** Clones the repository code.
2. **Setup Node.js:** Installs Node.js 22 with npm caching for faster runs.
3. **Install dependencies:** Runs `npm ci` for deterministic installs.
4. **Run tests:** Executes tests if available — fails the pipeline early before building.

#### Job 2: Build & Push Docker Image

Only runs if Job 1 passes (`needs: lint-and-test`).

1. **Checkout:** Clones the repository code.
2. **Set up Docker Buildx:** Enables advanced Docker build features (multi-platform, caching).
3. **Docker metadata:** Auto-generates smart image tags:
   - `latest` — on pushes to `main`
   - `<short-sha>` — short commit hash for traceability
   - `v1.0.0`, `1.0` — semantic version tags when you push a git tag like `v1.0.0`
   - `pr-<number>` — on pull requests
4. **Docker Hub Login:** Authenticates using repository secrets (skipped on PRs).
5. **Build & Push:** Uses `docker/build-push-action@v6` with:
   - **Multi-platform builds:** `linux/amd64` and `linux/arm64` (Intel + Apple Silicon).
   - **GitHub Actions cache:** Speeds up rebuilds by caching Docker layers.
   - **Auto-generated tags and labels:** From the metadata step.
   - On pull requests, the image is **built only** (not pushed) to validate the Dockerfile.
6. **Docker Hub description sync:** Automatically updates the Docker Hub repository description.

### Production-Ready Features

| Feature | Purpose |
|---|---|
| **Separate test job** | Fails fast before building if tests fail |
| **Docker Buildx** | Enables multi-platform and advanced caching |
| **Smart tagging (metadata-action)** | Auto-generates `latest`, SHA, and semver tags |
| **Semantic versioning** | Push `v1.0.0` git tag → image tagged `1.0.0` and `1.0` |
| **GitHub Actions layer cache** | Speeds up Docker rebuilds significantly |
| **Multi-platform (amd64 + arm64)** | Works on Intel servers and Apple Silicon Macs |
| **Docker Hub description sync** | Keeps Docker Hub repo description up to date |
| **Minimal permissions** | `contents: read` follows least-privilege principle |
| **Login only on push** | Skips Docker Hub auth on PRs (not needed) |

### Dockerfile Production Features

| Feature | Purpose |
|---|---|
| **Non-root user (`appuser`)** | Container never runs as root — security best practice |
| **`npm ci`** | Deterministic installs from lockfile |
| **Cache cleanup** | `npm cache clean` reduces final image size |
| **HEALTHCHECK** | Docker auto-detects if the container is healthy |

### Required GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**, and add:

| Secret Name          | Value                                                                 |
|----------------------|-----------------------------------------------------------------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username                                              |
| `DOCKERHUB_TOKEN`    | A Docker Hub access token (create at Docker Hub → Account Settings → Security) |

### Tagging Strategy

| Trigger | Example Tags Generated |
|---|---|
| Push to `main` | `latest`, `a1b2c3d` |
| Push tag `v1.2.3` | `1.2.3`, `1.2`, `a1b2c3d` |
| Pull request #42 | `pr-42` (build only, no push) |

---

## Step 5: Load Balancing with Docker Compose + Nginx

Deploy three replicas of the containerized app behind an Nginx reverse proxy to demonstrate load balancing. The image is **pulled from Docker Hub** (`himeldocker/hostname-app:latest`) — no local build is used.

### `docker-compose.yml`

- **`app` service:** Runs 3 replicas of `himeldocker/hostname-app:latest` via `deploy.replicas: 3`. `pull_policy: always` guarantees the image is pulled fresh from Docker Hub on every `up`. Only `expose: "3000"` — the app is not directly reachable from the host.
- **`nginx` service:** `nginx:1.27-alpine`, publishes port **8080** on the host, mounts `nginx.conf` read-only, and depends on `app`.

### `nginx.conf`

- **`resolver 127.0.0.11`:** Docker's embedded DNS. Required because `deploy.replicas` puts all replica IPs behind the single DNS name `app`, and Nginx needs to re-resolve it at runtime.
- **`upstream hostname_app`:** Defines `app:3000` as the backend pool. Nginx defaults to **round-robin**, rotating requests across the three replicas.
- **`proxy_pass`:** Forwards incoming requests to the upstream pool with standard `Host`, `X-Real-IP`, and `X-Forwarded-For` headers.

### Run the Stack

```bash
docker compose up -d
```

Check the containers:

```bash
docker compose ps
```

You should see `app-1`, `app-2`, `app-3`, and `nginx-1` all running.

### Verify Load Balancing

```bash
for i in {1..6}; do curl -s localhost:8080 ; echo; done
```

Expected output — the `hostname` field rotates across the three container IDs:

```
{"hostname":"89a167f592c7","message":"Hello from hostname-app!"}
{"hostname":"6809863b46ad","message":"Hello from hostname-app!"}
{"hostname":"0407e7cb742f","message":"Hello from hostname-app!"}
{"hostname":"89a167f592c7","message":"Hello from hostname-app!"}
{"hostname":"6809863b46ad","message":"Hello from hostname-app!"}
{"hostname":"0407e7cb742f","message":"Hello from hostname-app!"}
```

### Tear Down

```bash
docker compose down
```

---

## Step 6: Multi-VM Deployment with Multipass + Ansible

Step 5 runs everything on a single host. Step 6 targets the assignment's real
topology: **3 app VMs behind a 4th reverse-proxy VM**, all provisioned and
configured by Ansible. This replaces `docker-compose` for the production-style
deployment.

### 6.1 Provision the VMs (Multipass)

Install Multipass (`brew install --cask multipass` on macOS), then launch four
Ubuntu 24.04 VMs:

```bash
for vm in app1 app2 app3 proxy; do
  multipass launch 24.04 --name $vm --cpus 1 --memory 1G --disk 5G
done
multipass list        # note each VM's IP
```

> **Note on `192.168.123.0/24`:** the assignment brief specifies that subnet,
> but Multipass on macOS uses its own `192.168.64.0/24` bridge by default.
> Switching requires reconfiguring the host bridge (system-level change), so
> this project adapts to whatever IPs Multipass assigns — functionally
> identical. Update `ansible/inventory.ini` with the IPs from `multipass list`.

### 6.2 Grant Ansible SSH access

Inject your SSH public key into each VM's `ubuntu` user:

```bash
PUB_KEY=$(cat ~/.ssh/id_ed25519.pub)
for vm in app1 app2 app3 proxy; do
  multipass exec $vm -- bash -c "mkdir -p ~/.ssh && echo '$PUB_KEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
done
```

Smoke-test with `ansible all -m ping` from the `ansible/` directory.

### 6.3 The Ansible playbooks

| Playbook                    | Target        | What it does                                                                 |
|-----------------------------|---------------|------------------------------------------------------------------------------|
| `10-docker.yml`             | all 4 VMs     | Adds Docker's apt repo + GPG key, installs `docker-ce` + Compose plugin, enables the service, adds `ubuntu` to the `docker` group. |
| `20-deploy-app.yml`         | `app_servers` | Pulls `himeldocker/hostname-app:latest` and runs it as a container on each app VM (`hostname` set to the VM name, port `3000:3000`). |
| `30-nginx.yml`              | `proxies`     | Renders `nginx.conf` from a Jinja2 template (upstream block auto-populated from the `app_servers` group) and runs `nginx:1.27-alpine` in a container on port 80. |
| `site.yml`                  | —             | Master playbook — imports the three above in order.                          |

Run everything:

```bash
cd ansible
ansible-playbook playbooks/site.yml
```

### 6.4 Continuous Delivery (CD)

The workflow has a third job, `deploy`, that runs after `build-and-push` on
every push to `main`:

- `runs-on: [self-hosted, proxy]` — a **self-hosted GitHub runner** installed
  on the proxy VM (GitHub's public runners cannot reach the private Multipass
  LAN).
- Checks out the repo and runs:
  ```bash
  ansible-playbook playbooks/20-deploy-app.yml \
    -e docker_image=<dockerhub-user>/hostname-app:latest
  ```

One-time runner setup instructions live in `ansible/SETUP_RUNNER.md`.

### 6.5 Testing via `myapp.com`

Add an `/etc/hosts` entry on the host pointing `myapp.com` at the proxy VM:

```bash
echo "<proxy-vm-ip> myapp.com" | sudo tee -a /etc/hosts
```

Verify round-robin load balancing across the three app VMs:

```bash
for i in {1..6}; do curl -s http://myapp.com/ ; echo; done
```

Expected — `hostname` rotates `app1 → app2 → app3` and `commit` holds the
deployed Git SHA:

```
{"hostname":"app1","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
{"hostname":"app2","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
{"hostname":"app3","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
{"hostname":"app1","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
{"hostname":"app2","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
{"hostname":"app3","commit":"4aa1fc3...","message":"Hello from hostname-app!"}
```

---

## Summary

| Step | Action                          | Tool/Service            |
|------|---------------------------------|-------------------------|
| 1    | Develop the application         | Node.js/Express         |
| 2    | Create a Docker image           | Docker                  |
| 3    | Push image to Docker Hub        | Docker CLI              |
| 4    | Automate build and push         | GitHub Actions          |
| 5    | Load balance 3 replicas (dev)   | Docker Compose + Nginx  |
| 6    | Multi-VM deployment             | Multipass + Ansible     |
| 7    | Continuous delivery             | Self-hosted GitHub runner |
