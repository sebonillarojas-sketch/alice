# Voz de Alicia — Opciones de TTS y Whisper (STT)
_Preparado 13 jul 2026 · precios verificados con búsqueda web ese día · para decisión de Sebastián_

## El problema
Groq free tier = **3.600 tokens de voz/DÍA** (~10 respuestas). La voz de Alicia "se muere" a diario.
Ya está capada a 600 chars/respuesta como parche. **El cuello de botella es el TTS (orpheus), no el Whisper.**
Además: el TTS actual emite **WAV**, que WhatsApp Cloud API no acepta bien → hay que pasar a **ogg/opus**.

---

## 🔊 TTS (VOZ) — 5 opciones

### 1. OpenAI · `gpt-4o-mini-tts` / `tts-1` ⭐ recomendado pragmático
- **Precio**: `tts-1` **$15 / 1M chars** · `tts-1-hd` $30/1M · `gpt-4o-mini-tts` ~$15/1M (≈$0.015/min)
- **Pros**: barato, 6 voces decentes en español, **voz "dirigible"** (instrucción de tono: "cálida, pausada"), consolida con OpenAI (lo que ya querés usar), API simple, sin límite diario absurdo. Emite mp3/opus/wav nativo → resuelve lo de WhatsApp.
- **Contras**: voces buenas pero no "wow"; no clonación de voz propia.
- **Costo estimado Hygge** (~3M chars/mes): **~$45/mes**

### 2. ElevenLabs · Flash / Multilingual v2 — el premium
- **Precio**: Flash/Turbo ~$0.05/1K (**$50/1M**) · Multilingual v2 ~$0.10/1K (**$100/1M**). Planes: Creator $22 (121k), Pro $99 (600k), Scale $330/mes (API, ~6.6M).
- **Pros**: **la mejor calidad de voz del mercado**, español latino natural, **clonación de voz** (podrías darle a Alicia una voz única de marca), streaming, emoción real.
- **Contras**: **el más caro** (2-6x OpenAI), sistema de créditos confuso, se dispara con volumen.
- **Costo estimado Hygge**: Pro $99/mes cubre ~600k chars; a 3M/mes ≈ **$150-300/mes**

### 3. Deepgram · Aura-2 — el de baja latencia
- **Precio**: **$0.030 / 1K chars ($30/1M)** · $0.027 en tier Growth
- **Pros**: **latencia ultra baja** (pensado para agentes de voz en tiempo real), buen precio medio, mismo proveedor puede hacer STT+TTS (un solo contrato).
- **Contras**: catálogo de voces en **español más limitado** que OpenAI/ElevenLabs; calidad buena pero no líder.
- **Costo estimado Hygge** (~3M/mes): **~$90/mes**

### 4. Google Cloud TTS · Chirp3-HD / WaveNet — el corporativo
- **Precio**: Standard **$4/1M** · WaveNet/Neural2 **$16/1M** · Chirp3-HD ~$30/1M _(verificar en consola)_
- **Pros**: **Standard baratísimo**, español latino sólido, infra Google confiable, escala infinita, sin límite diario.
- **Contras**: setup más pesado (GCP, service account), voces Standard suenan algo robóticas (subir a WaveNet), un proveedor más en la ecuación.
- **Costo estimado Hygge**: Standard ~$12/mes · WaveNet ~$48/mes

### 5. Groq · orpheus (ACTUAL) — solo si se paga el tier
- **Precio**: free = 3.600 tokens voz/día (el problema). Tier pago existe _(verificar en console.groq.com/billing)_.
- **Pros**: ya integrado, latencia buenísima (LPU), voces orpheus lindas.
- **Contras**: **el límite diario nos mata**; menos voces; ecosistema chico. Pagar el tier lo resuelve pero no da tanto upside vs. cambiar a OpenAI.
- **Costo estimado**: depende del tier pago de Groq (barato en compute, pero cuota de voz históricamente restrictiva)

---

## 🎙️ WHISPER (STT · transcripción) — comparativa

_Nota: el STT no es el problema urgente. Alicia transcribe notas de voz de WhatsApp — volumen bajo (~25 hrs/mes)._

| Proveedor | Modelo | Precio | Costo Hygge (~25 hrs/mes) | Nota |
|---|---|---|---|---|
| **Groq** ⭐ | whisper-large-v3-turbo | **$0.04/hr** | **~$1/mes** | Imbatible en precio, 228x tiempo real, multilingüe. Mín 10s/request. **Mantener.** |
| Deepgram | Nova-3 | $0.26/hr (multi $0.55/hr) | ~$7-14/mes | Rápido, buena puntuación/diarización |
| OpenAI | gpt-4o-mini-transcribe | $0.18/hr ($0.003/min) | ~$4.5/mes | Consolida con OpenAI; buena calidad |
| OpenAI | whisper-1 / gpt-4o-transcribe | $0.36/hr ($0.006/min) | ~$9/mes | Máxima precisión/acentos |

---

## 🎯 Recomendación

**Combo pragmático (mejor relación calidad/precio/simplicidad):**
- **TTS → OpenAI `gpt-4o-mini-tts`** (~$45/mes): barato, voz dirigible, consolida con OpenAI, emite opus (arregla WhatsApp), sin límite diario. **Mata el problema de Groq de una.**
- **STT → seguir con Groq whisper-turbo** (~$1/mes): es 9x más barato que todos y anda perfecto. El problema nunca fue el Whisper.
- **Total: ~$46/mes** para todo el equipo.

**Combo premium (si querés que la voz de Alicia sea un diferenciador de marca):**
- **TTS → ElevenLabs** (voz clonada única, Pro $99/mes) + **STT → Groq** ($1/mes).
- **Total: ~$100-150/mes.** Vale la pena solo si la voz "wow" es parte de la experiencia de producto.

**Decisión de fondo**: OpenAI cubre TTS + STT + LLM en una sola cuenta corporativa (encaja con la migración de identidad, tarea #8). ElevenLabs es mejor voz pero un proveedor extra y más caro. Groq queda como STT barato pase lo que pase.

---
_Fuentes: OpenAI/ElevenLabs/Deepgram/Groq pricing pages + agregadores, jul 2026. Verificar el número final en cada consola antes de contratar — los precios de voz cambian seguido._
