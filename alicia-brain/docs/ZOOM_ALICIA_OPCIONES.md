# Alicia en los Zooms — Opciones (unirse + intervenir + ver)
_Preparado 13 jul 2026 · para decisión de Sebastián · trabajo de la sesión supercomputadora_

## Lo que se busca
1. **Unirse** a la reunión de Zoom como participante
2. **Escuchar** → transcribir (Whisper) → minutas/action items en tiempo real
3. **Intervenir** → hablar en la reunión (TTS de Alicia entra al audio de la llamada)
4. **Ver** → capturar video/pantalla compartida → visión (Claude) para entender slides, quién habla, whiteboards

Hoy la integración Zoom está en CERO (vars vacías, zoom.js stub). Esto es construcción nueva.

---

## 5 opciones

### 1. Recall.ai ⭐ el atajo (bot-as-a-service)
- **Qué es**: API que mete un bot a Zoom/Meet/Teams. Devuelve audio+video en tiempo real y permite **enviar audio de vuelta** (Alicia habla) y hasta **video** (mostrar su blob/avatar).
- **Unirse** ✅ · **Escuchar** ✅ · **Intervenir** ✅ (output audio) · **Ver** ✅ (streams de video → visión)
- **Pros**: funcionando en días, no maintenés infra de media, multi-plataforma (sirve para Meet/Teams también), maneja el caos de las SDK de Zoom por vos.
- **Contras**: **costo por hora de bot** (~$0.70–1.50/hr aprox · verificar) que escala con uso; dependencia de un tercero; el bot aparece como participante "Recall"/renombrable.
- **Ideal para**: validar rápido el caso de uso antes de invertir en lo pesado.

### 2. Zoom Meeting SDK self-hosted (bot en la supercomputadora) 🏗️ el definitivo
- **Qué es**: bot headless con el **Linux Meeting SDK de Zoom** corriendo en la supercomputadora. Acceso a audio crudo in/out y **frames de video in/out**.
- **Unirse** ✅ · **Escuchar** ✅ · **Intervenir** ✅ (inyecta audio TTS) · **Ver** ✅ (frames crudos) · **Mostrarse** ✅ (puede enviar el blob de Alicia como su "cámara")
- **Pros**: **control total**, sin fee por minuto de vendor, la supercomputadora es justo para esto (proceso persistente + media pipeline), Alicia con cara propia en la llamada.
- **Contras**: **ingeniería pesada** (C++/Linux SDK, pipelines de audio/video, WebRTC), semanas no días, mantenimiento propio.
- **Ideal para**: el estado final, cuando el caso ya esté validado.

### 3. Zoom RTMS (Realtime Media Streams) — el oficial para escuchar+ver
- **Qué es**: streaming de media en tiempo real de Zoom hacia tu app (audio + video + transcript).
- **Unirse** ➖ (no es un participante, es un stream) · **Escuchar** ✅ · **Ver** ✅ · **Intervenir** ❌ (salida de media limitada)
- **Pros**: oficial de Zoom, limpio para captura, sin bot visible.
- **Contras**: **no habla** (no intervención) — solo observa. Bueno para minutas, no para participar.

### 4. Dial-in telefónico (SIP/PSTN) — intervenir sin ver
- **Qué es**: Alicia "llama" al número de dial-in de Zoom como un participante telefónico. Audio bidireccional.
- **Unirse** ✅ · **Escuchar** ✅ · **Intervenir** ✅ (habla por la línea) · **Ver** ❌ (solo audio)
- **Pros**: relativamente simple, robusto, funciona con cualquier plataforma que tenga dial-in.
- **Contras**: **ciega** (sin video/slides), calidad de audio telefónica, se siente "llamada" no participante nativo.

### 5. Zoom App + AI Companion nativo — lo liviano
- **Qué es**: usar el AI Companion de Zoom / apps del marketplace para resúmenes.
- **Unirse** N/A · **Escuchar** ✅ (resúmenes nativos) · **Intervenir** ❌ · **Ver** ❌ (no custom)
- **Pros**: cero infra, ya existe en Zoom.
- **Contras**: **no es Alicia** — es la IA de Zoom, sin su personalidad, memoria ni acceso al contexto de Hygge. Descartable para lo que querés.

---

## 🎯 Recomendación (camino en 2 fases)
- **Fase 1 (validar, días)**: **Recall.ai**. Alicia entra, escucha, toma minutas → memoria, e **interviene por voz** cuando se la menciona o cuando detecta algo relevante. "Ver" vía sampling de frames → visión de Claude para slides/pantalla. Bajo riesgo, rápido.
- **Fase 2 (definitivo, en la supercomputadora)**: migrar al **Meeting SDK self-hosted** cuando el caso esté probado — control total, sin fee por hora, y Alicia con **su blob como cámara** en la llamada. 

**Base común (hacer primero, cualquiera sea el camino)**: app **Server-to-Server OAuth** de Zoom en la cuenta corporativa Hygge (scopes de meetings + recordings) — hoy está en cero.

**Pregunta de producto para vos**: ¿Alicia interviene **proactivamente** (detecta y habla sin que la llamen) o solo **cuando la mencionan** ("Alicia, ¿qué opinás?")? Arranca en modo "cuando la mencionan" — proactiva sin guardrails en una reunión de directorio puede ser incómodo. Igual que los agentes: L0/L1 primero.
