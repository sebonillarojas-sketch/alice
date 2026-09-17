# El reloj de la bestia 🕰️ — instalación y por qué es así

La máquina de los agentes (`alicias-mac-pro-1`, Tailscale `100.88.12.17`) corre el
scraper con navegador real, Cheshire y Knave. Entre el **9 y el 16 de septiembre de
2026 no corrió ninguno** y nadie se enteró: cero pushes a `/api/market-import`, cero
reportes a `/api/agents/report`, cero polls a `/api/agents/run-requests`. No fue un
problema de scraping — fue el reloj.

## Instalación

**Una sola línea, en esa máquina:**

```sh
cd ~/Desktop/ALICE && git pull && sudo bash alicia-brain/scripts/bestia/install.sh
```

Con `--con-ssh` al final, además prende Sesión remota y le abre el paso en el firewall.
Sin eso, el próximo diagnóstico exige volver físicamente. Es idempotente: se puede
correr de nuevo cuantas veces haga falta.

## Qué instala y por qué

| Pieza | Qué es | El problema que arregla |
|---|---|---|
| `com.hygge.wonderland.clock` | LaunchDaemon (dominio system) que dispara un tick cada 10 min | El LaunchAgent anterior vivía en `gui/<uid>`: solo corría con sesión gráfica abierta. Logout, reinicio sin login o máquina dormida = reloj muerto en silencio |
| `com.hygge.wonderland.watchdog` | LaunchDaemon root, bash + curl, cada 10 min | El único que reinstalaba el reloj era una corrida que el reloj disparaba. Recuperación circular: existía solo cuando no se necesitaba |
| `run-tick.sh` | Wrapper que resuelve node en runtime | El plist viejo hardcodeaba `/Users/eduardobonilla/.volta/bin/node`. Volta mueve sus shims al cambiar de versión y launchd falla contra un log que nadie puede leer |
| `pmset` | No dormir, reiniciar tras corte de luz, despertar por red | Una máquina dormida es indistinguible de una máquina rota, vista desde afuera |

El reloj corre **como el usuario**, no como root, aunque sea un daemon: el estado vive
en su `~/Library/Application Support/wonderland` y el repo es suyo — un `git pull` de
root dejaría archivos root-owned que después rompen el repo. Persistencia de daemon,
permisos de usuario.

## Las dos marcas, y por qué son dos

- `last-fire` la escribe **el wrapper** antes de arrancar node.
- `last-tick` la escribe **el runner** cuando completó el tick.

La diferencia entre las dos es el diagnóstico: *fire* viejo = el reloj no dispara;
*fire* fresco con *tick* viejo = el reloj anda y node o el runner se están muriendo.
Son dos causas con arreglos opuestos, y sin acceso a la máquina es la única forma de
distinguirlas desde el cerebro.

## El latido

El watchdog postea cada 10 min a `POST /api/bestia/heartbeat` con: host, estado del
reloj, ruta de node, rama del repo, edad del último tick y qué reparó. Es **bash y
curl a propósito**: no comparte nada con lo que vigila — ni node, ni volta, ni el
repo, ni git — así que si todo eso está roto, el latido igual llega y dice cuál.

En el cerebro, `checkBestiaHeartbeat()` lo mira cada 30 min: si se corta, abre un
hallazgo `bestia-muda` (`major`, y `critical` pasadas 3h) que Dark Alice avisa por
WhatsApp. Antes la ausencia tardaba 18h en cantar, y solo si además faltaban datos.

## Para mirar sin entrar

```sh
tail -f /var/log/wonderland-watchdog.log                    # el watchdog
tail -f ~/Library/Logs/wonderland.err.log                   # el reloj
sudo launchctl print system/com.hygge.wonderland.clock      # estado y último exit code
```
