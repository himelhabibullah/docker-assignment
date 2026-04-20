# Self-hosted GitHub Runner on `proxy` VM

The CD job in `.github/workflows/docker-publish.yml` targets
`runs-on: [self-hosted, proxy]`. This runner lives on the `proxy` VM so it
can reach `app1/app2/app3` over the private network and run Ansible.

## One-time setup on the proxy VM

```bash
# 1. SSH into the proxy VM
multipass shell proxy

# 2. Install Ansible + git (runner dependencies)
sudo apt update
sudo apt install -y ansible git

# 3. Install and register the GitHub Actions runner.
#    Replace <REPO_URL> and <TOKEN> with the values from
#    GitHub → repo → Settings → Actions → Runners → "New self-hosted runner".
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-arm64-2.319.1.tar.gz
tar xzf actions-runner.tar.gz
./config.sh --url <REPO_URL> --token <TOKEN> --labels self-hosted,proxy --unattended
sudo ./svc.sh install
sudo ./svc.sh start

# 4. Copy the SSH key used to reach the app VMs into the runner user's
#    ~/.ssh so Ansible can connect. Also copy the inventory/playbooks
#    (the checkout step in the workflow handles the playbooks; the SSH
#    key must be installed out-of-band).
```

## Inventory note

The inventory file checked into git uses `192.168.64.0/24` IPs (Multipass
default on macOS). If you rebuild VMs or move this to another host, update
`ansible/inventory.ini` before running the playbooks.
