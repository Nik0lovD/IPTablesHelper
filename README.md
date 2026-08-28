# Networking Panel

React панел за управление на `iptables` NAT пренасочвания на Ubuntu машината, която го хоства, с автоматична синхронизация към Oracle Cloud security list.

## Какво прави

- CRUD върху локални port forwards (listen port → dest IP:port, TCP/UDP/both)
- Прилага `iptables` правила на хоста:
  - `PREROUTING` DNAT
  - `POSTROUTING` MASQUERADE
  - `FORWARD` allow
  - `net.ipv4.ip_forward=1`
- Автоматично добавя/маха ingress правила в Oracle Cloud security list
- Login по подразбиране: `admin` / `admin` (сменяеми от настройки)

## Development (Windows / локално)

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8787

На Windows backend работи в **dry-run** режим — `iptables` командите се логват, но не се изпълняват.

## Production install (Ubuntu)

1. Копирай проекта на gateway машината (напр. `/opt/networking-panel`).
2. Сложи OCI API ключовете в `~/.oci/config` на потребителя, под който ще върви service-а.
3. Стартирай:

```bash
chmod +x install.sh
./install.sh
```

Панелът ще е на порт **8787**.

## OCI API ключове

Създай API key в Oracle Cloud Console и конфигурирай `~/.oci/config`:

```ini
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=xx:xx:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=eu-frankfurt-1
key_file=~/.oci/oci_api_key.pem
```

Security list OCID и region могат да се променят от **Настройки** в панела.

Ако OCI ключовете липсват или API заявката се провали, `iptables` правилото пак се прилага, но панелът показва линк за ръчно отваряне на security list в Oracle Cloud Console.

## API

- `POST /api/login`
- `GET /api/forwards`
- `POST /api/forwards`
- `PUT /api/forwards/:id`
- `DELETE /api/forwards/:id`
- `PUT /api/credentials`
- `GET /api/settings`
- `PUT /api/settings`

## Бележки

- Панелът се инсталира **само на машината**, която прави NAT пренасочването.
- `install.sh` конфигурира `sudoers` само за `iptables`, `sysctl` и `netfilter-persistent`.
- Смени `SESSION_SECRET` env var в production.
