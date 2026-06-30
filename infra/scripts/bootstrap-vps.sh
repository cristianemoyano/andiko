#!/usr/bin/env bash
# One-time setup for a fresh Debian VPS (Hostinger). Run as root or with sudo.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash infra/scripts/bootstrap-vps.sh" >&2
  exit 1
fi

echo "==> Andiko VPS bootstrap (Debian)"

export DEBIAN_FRONTEND=noninteractive

echo "==> System packages"
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  make \
  gettext-base \
  openssl \
  python3 \
  apache2-utils \
  ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Docker Engine (official repo)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
else
  echo "Docker already installed: $(docker --version)"
fi

echo "==> Docker Swarm"
if ! docker info 2>/dev/null | grep -q 'Swarm: active'; then
  docker swarm init
else
  echo "Swarm already active"
fi

echo "==> Firewall (UFW)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable || true
ufw status

DEPLOY_USER="${SUDO_USER:-root}"
if [ "$DEPLOY_USER" != "root" ]; then
  echo "==> Add $DEPLOY_USER to docker group"
  usermod -aG docker "$DEPLOY_USER"
fi

echo ""
echo "Bootstrap complete."
echo ""
echo "Next steps (as ${DEPLOY_USER}):"
echo "  1. Hostinger panel: allow TCP 22, 80, 443 if a cloud firewall is enabled"
echo "  2. DNS: andiko.cloud + www + portainer.andiko.cloud → this server's public IP"
echo "  3. GitHub SSH key (if repo is private):"
echo "       ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519"
echo "       cat ~/.ssh/id_ed25519.pub   # add at github.com/settings/keys"
echo "  4. Clone repo:"
echo "       git clone git@github.com:cristianemoyano/andiko.git ~/andiko"
echo "       cd ~/andiko && git checkout develop"
echo "  5. Configure env:"
echo "       cp infra/.env.production.example infra/.env.production"
echo "       nano infra/.env.production"
echo "  6. GHCR login (PAT with read:packages):"
echo "       echo \"\$GITHUB_TOKEN\" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin"
echo "  7. After laptop pushed image: make prod-init && make prod-deploy TAG=v0.25.2"
echo ""
echo "Full runbook: docs/deployment/production.md"
