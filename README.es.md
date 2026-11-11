# Watchboard

Panel local de **actualizaciones de software y precios de juegos**, desarrollado con React 19, TypeScript y Vite.

[English](README.md) · [API](https://github.com/David-H-Afonso/Watchboard.Api) · [Cambios](CHANGELOG.md)

## Funciones

- Versiones instaladas y publicadas, agrupadas por ubicaciones reutilizables.
- Comparación Steam ↔ AllKeyShop con plataforma, clave/regalo e idioma indicados.
- Steam oficial como oferta principal cuando cuesta igual o menos.
- Metas por fuente, mínimos observados con fecha e historial de precios.
- Las ediciones verificadas se agrupan con su producto Steam sin mezclar históricos. Actualizar en Precios permite reintentar una asociación automática fallida.
- Widget por usuario e importación/exportación de configuración.
- Cuentas privadas y diseño adaptable con diálogos accesibles por teclado.
- Edición de versiones y nombres/objetivos de juegos sin borrar el historial. Las fuentes sin lecturas se pueden corregir; las que ya tienen histórico mantienen su identidad y filtros.

## Docker

GitHub Actions compila y publica los dos repositorios en GHCR:

| Imagen | Arquitecturas |
| --- | --- |
| `ghcr.io/david-h-afonso/watchboard-api:latest` | Linux amd64 |
| `ghcr.io/david-h-afonso/watchboard-web:latest` | Linux amd64 |

La 1.0 se publica para sistemas amd64 verificados. ARM64 queda pendiente de comprobar en hardware nativo; la prueba con .NET/QEMU no fue fiable.

Desde este repositorio, con Docker Compose instalado:

```sh
docker compose pull
docker compose up -d
```

Abre **http://localhost:5333** y elige la contraseña inicial de `admin`. Solo se publica la web; `/api` permanece en el mismo origen. Ambos contenedores usan usuarios sin privilegios y sistemas de archivos de solo lectura. El volumen `watchboard-data` conserva la base de datos y las claves de sesión.

Valores opcionales en un archivo `.env` ignorado:

| Variable | Valor predeterminado / uso |
| --- | --- |
| `WATCHBOARD_PORT` | `5333`; cámbialo si está ocupado |
| `WATCHBOARD_BIND` | `127.0.0.1`; `0.0.0.0` solo para una LAN de confianza |
| `WATCHBOARD_HOST` | `localhost`; indica IP o nombre del servidor para la LAN |
| `WATCHBOARD_ORIGIN` | `http://<host>:<puerto>`; reemplázalo por el origen público exacto de un proxy |
| `WATCHBOARD_SECURE_COOKIES` | `false`; `true` con terminación HTTPS |
| `WATCHBOARD_TAG` | `latest`; `1.0.0` fija ambas imágenes versionadas |
| `WATCHBOARD_OWNER` | `david-h-afonso`; cámbialo si usas un fork |

La API nunca se publica directamente. No expongas este panel personal a Internet. En una red compartida, usa HTTPS con host/origen coincidentes y cookies seguras.

Antes de actualizar, detén el conjunto y respalda el volumen completo. Después ejecuta `docker compose pull` y `docker compose up -d`. Conserva la etiqueta anterior y su copia de datos para restaurar; **no uses `docker compose down -v`** salvo que quieras eliminar todos los datos.

### Trasladar imágenes sin usar un registro en el destino

Para otro equipo con la misma arquitectura de CPU, copia `compose.yaml` y el archivo:

```sh
docker save -o watchboard-images.tar ghcr.io/david-h-afonso/watchboard-api:latest ghcr.io/david-h-afonso/watchboard-web:latest
# En el destino:
docker load -i watchboard-images.tar
docker compose up -d --pull never
```

El archivo contiene imágenes, **no tus datos**. La primera publicación puede requerir hacer públicos ambos paquetes en los ajustes de GitHub para descargarlos sin iniciar sesión. Actions usa `GITHUB_TOKEN`, sin token personal. Los commits de la rama predeterminada actualizan `latest`; cada compilación lleva `sha-…` completo. Una etiqueta Git `v1.0.0` añade `v1.0.0`, `1.0.0` y `1`. Las pull requests no publican imágenes.

## Desarrollo

Requiere **Node.js 22.12+ o 24+** y la API de Watchboard ejecutándose por separado.

```sh
npm ci
npm run dev
```

Abre **http://127.0.0.1:5333**. Vite redirige `/api` a **http://127.0.0.1:5197**. El primer acceso permite elegir la contraseña de `admin`.

## Compilación

```sh
npm run lint
npm run build
```

Resultado en `dist`. La instalación compilada debe servir frontend y `/api` desde el mismo origen. Está pensada para uso local, no para publicarse directamente en Internet.

## Precios e historial

Consulta diaria o manual desde la API. Se prioriza Steam y se indica la plataforma real de las alternativas de PC. Se excluyen cuentas y tarjetas monedero. Los totales incluyen las comisiones publicadas, pero son estimaciones.

El historial contiene lecturas guardadas y puede ser parcial; no incluye dos años completos importados. Las versiones de otros equipos se indican manualmente, sin detección remota.

Una sesión ya cargada puede conservar una copia con fecha cuando falla la API; los precios antiguos no confirman objetivos. No incluye widget nativo ni PWA sin conexión.

## Licencia

[MIT](LICENSE) © 2026 David-H-Afonso. Las fuentes de Fontsource mantienen sus respectivas licencias.
