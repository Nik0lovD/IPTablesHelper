#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="${SUDO_USER:-$USER}"
SERVICE_FILE="/etc/systemd/system/networking-panel.service"
SUDOERS_FILE="/etc/sudoers.d/networking-panel"

echo "Installing Networking Panel into ${APP_DIR}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 20+ first."
  exit 1
fi

cd "$APP_DIR"
npm install
npm install --prefix client
npm run build

sudo apt-get update
sudo apt-get install -y iptables-persistent netfilter-persistent || true

echo "net.ipv4.ip_forward=1" | sudo tee /etc/sysctl.d/99-networking-panel.conf >/dev/null
sudo sysctl -p /etc/sysctl.d/99-networking-panel.conf

sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Networking Port Panel
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=8787
ExecStart=$(command -v node) ${APP_DIR}/server/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee "$SUDOERS_FILE" >/dev/null <<EOF
${SERVICE_USER} ALL=(root) NOPASSWD: /sbin/iptables, /usr/sbin/iptables, /sbin/iptables-save, /usr/sbin/iptables-save, /sbin/sysctl, /usr/sbin/sysctl, /usr/sbin/netfilter-persistent
EOF
sudo chmod 440 "$SUDOERS_FILE"

sudo systemctl daemon-reload
sudo systemctl enable networking-panel
sudo systemctl restart networking-panel

echo
echo "Installed. Panel: http://$(hostname -I | awk '{print $1}'):8787"
echo "Default login: admin / admin"
echo "Place OCI API keys in ~/.oci/config for automatic security list updates."
