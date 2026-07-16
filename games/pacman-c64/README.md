# Pac-Man para Commodore 64

Port de Pac-Man para C64 escrito en C (cc65), vendoreado desde
[midicdj1000/pacman](https://github.com/midicdj1000/pacman) para desarrollarlo aquí.
También se puede abrir directo en el IDE online:
[8bitworkshop](https://8bitworkshop.com/v3.12.1/?repo=midicdj1000%2Fpacman&platform=c64&file=pacman.c).

## Archivos

| Archivo | Qué es |
|---|---|
| `pacman.c` | El juego completo: charset y mapa embebidos, sprites, 4 fantasmas, sonido SID, niveles |
| `bitcount.c` | Demo/experimento standalone de conteo de bits (no es parte del juego) |
| `isotilemap.c` | Demo standalone de tilemap isométrico (no es parte del juego) |
| `C64PAC.prg` | Binario original precompilado del repo upstream (referencia) |
| `Makefile` | Build con cc65 |

## Compilar

Requiere [cc65](https://cc65.github.io) (`apt-get install cc65`):

```sh
make          # genera pacman.prg
make extras   # además compila bitcount.prg e isotilemap.prg
```

## Jugar

Cargar `pacman.prg` en cualquier emulador de C64:

```sh
x64sc pacman.prg        # VICE
```

o en un C64 real vía SD2IEC/Ultimate. Controles: joystick en puerto 2.

## Notas de desarrollo

- Compila limpio con cc65 2.19 (`-t c64 -O`). Verificado: PRG válido con stub
  BASIC `SYS 2061`, ~28 KB.
- `bitcount.c` traía un error de sintaxis upstream (línea 136, token `fd` suelto);
  corregido con el fix mínimo para que compile.
- Los `.prg` compilados localmente no se versionan (ver `.gitignore`); solo se
  conserva el `C64PAC.prg` de referencia.
