# Watchboard

A local dashboard for **software updates and game prices**, built with React 19, TypeScript and Vite.

[Español](README.es.md) · [Backend API](https://github.com/David-H-Afonso/Watchboard.Api) · [Changelog](CHANGELOG.md)

## Features

- Installed-versus-published software versions, organized by reusable locations.
- Steam and AllKeyShop comparison with platform, key/gift delivery and language labels.
- Official Steam selected when its fresh price is equal or lower.
- Source-specific targets, dated observed minima and price history.
- Per-user widget filters and configuration import/export.
- Private accounts, compact responsive layout and keyboard-accessible dialogs.
- Edit existing software details and game names/targets without deleting their history. Unpriced sources can be corrected; historical source definitions remain protected.

## Docker

GitHub Actions builds and publishes both repositories to GHCR:

| Image | Architectures |
| --- | --- |
| `ghcr.io/david-h-afonso/watchboard-api:latest` | Linux amd64 |
| `ghcr.io/david-h-afonso/watchboard-web:latest` | Linux amd64 |

The 1.0 stack targets validated amd64 systems. ARM64 publication awaits native runtime verification; the .NET/QEMU test was not reliable.

From this repository, with Docker Compose installed:

```sh
docker compose pull
docker compose up -d
```

Open **http://localhost:5333** and choose the initial `admin` password. Only the web port is published; `/api` stays on the same origin. Both containers run unprivileged with read-only filesystems. The named `watchboard-data` volume retains the database and session keys.

Optional values in an ignored `.env` file:

| Variable | Default / purpose |
| --- | --- |
| `WATCHBOARD_PORT` | `5333`; choose another if already occupied |
| `WATCHBOARD_BIND` | `127.0.0.1`; set `0.0.0.0` only for a trusted LAN |
| `WATCHBOARD_HOST` | `localhost`; set the server IP or hostname for LAN access |
| `WATCHBOARD_ORIGIN` | `http://<host>:<port>`; override for a reverse proxy's exact public origin |
| `WATCHBOARD_SECURE_COOKIES` | `false`; set `true` when using HTTPS termination |
| `WATCHBOARD_TAG` | `latest`; set `1.0.0` to pin both versioned images |
| `WATCHBOARD_OWNER` | `david-h-afonso`; change for your fork |

The API is never published directly. Do not expose this personal dashboard to the Internet. On a shared network, use HTTPS with a matching host/origin and secure cookies.

Before updating, stop the stack and back up the complete data volume. Then run `docker compose pull` and `docker compose up -d`. Keep the old image tag and matching data backup for rollback; **do not use `docker compose down -v`** unless intentionally deleting all data.

### Transfer images without a registry on the destination

For another machine with the same CPU architecture, copy `compose.yaml` and the archive:

```sh
docker save -o watchboard-images.tar ghcr.io/david-h-afonso/watchboard-api:latest ghcr.io/david-h-afonso/watchboard-web:latest
# On the destination:
docker load -i watchboard-images.tar
docker compose up -d --pull never
```

The archive contains images, **not your data**. A first GHCR publication may require making each package public in GitHub's package settings for anonymous downloads. Workflows use `GITHUB_TOKEN`, with no personal token required. Default-branch commits update `latest`; builds also receive a full `sha-…` tag. A `v1.0.0` Git tag adds `v1.0.0`, `1.0.0` and `1`. Pull requests do not publish images.

## Development

Requires **Node.js 22.12+ or 24+** and the separately running Watchboard API.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5333**. Vite proxies `/api` to **http://127.0.0.1:5197**. Set the initial `admin` password through the first-run screen.

## Build

```sh
npm run lint
npm run build
```

Output is generated in `dist`. For a built installation, serve these assets and `/api` from the same origin. The application is intended for local use, not public Internet deployment.

## Pricing and history

The API collects prices daily or on manual refresh. Steam activation is preferred; eligible alternatives identify their actual PC platform. Accounts and gift cards are excluded. Marketplace totals include published fees but remain estimates.

History represents saved observations. Coverage may be partial; complete external two-year backfill is not included. Other devices require manually supplied installation versions, not remote detection.

An already loaded session can retain dated cached data when the API fails; offline prices never confirm targets. There is no native desktop widget or offline PWA shell.

## License

[MIT](LICENSE) © 2026 David-H-Afonso. Fonts are provided by Fontsource packages under their respective licenses.
