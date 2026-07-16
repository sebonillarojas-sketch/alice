# C64 Pac-Man — builds with the cc65 toolchain (https://cc65.github.io)
# `make` produces pacman.prg, runnable in VICE (x64sc pacman.prg) or any C64 emulator.

CC65_TARGET = c64
CL65 = cl65
CFLAGS = -t $(CC65_TARGET) -O

PROGRAMS = pacman.prg bitcount.prg isotilemap.prg

all: pacman.prg

extras: $(PROGRAMS)

%.prg: %.c
	$(CL65) $(CFLAGS) -o $@ $<

clean:
	rm -f $(PROGRAMS) *.o

.PHONY: all extras clean
