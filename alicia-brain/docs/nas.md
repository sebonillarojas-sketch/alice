# NAS Synology DS225+ — runbook de configuración (Hygge)

_Objetivo: el NAS es el espejo físico del Dropbox corporativo (`/Hygge`) con historial de snapshots de 30 días. Cloud Sync mantiene el espejo en tiempo real; Snapshot Replication protege contra borrados accidentales o ransomware que se propaguen desde Dropbox (un snapshot es inmutable, el sync no)._

_Relación con alicia-brain: el cerebro de Alicia se exporta a Dropbox en `/Hygge/09_ALICE/_cerebro/` (ver `src/brainsync.js`). Con el sync bidireccional del NAS, el cerebro queda respaldado físicamente sin tocar el código — la "migración cerebro al NAS" del HANDOFF (pendiente #9) empieza aquí._

Orden estricto: **volumen Btrfs → carpeta compartida → Cloud Sync → snapshots**. Snapshot Replication solo funciona sobre Btrfs; si el volumen se crea en ext4 hay que rehacerlo desde cero.

---

## 1. Setup inicial de DSM (si el NAS está recién sacado de la caja)

1. Conectar el DS225+ por cable Ethernet al router y encender. Esperar ~2 min al beep.
2. Desde una compu **en la misma red**, abrir `find.synology.com` (o instalar la app Synology Assistant si no lo encuentra).
3. Instalar DSM (descarga automática). El NAS se reinicia (~10 min).
4. Crear la cuenta de administrador:
   - Usuario: NO usar `admin` (DSM lo deshabilita, mejor así). Sugerido: `hygge-admin`.
   - Contraseña fuerte → guardarla en el gestor de contraseñas corporativo.
5. **QuickConnect**: crear/loguear Synology Account con `sebastian@hygge.pe` (regla del HANDOFF: todo corporativo va a cuentas Hygge) y elegir un ID, p. ej. `hygge-nas`. Esto da acceso remoto vía `quickconnect.to/hygge-nas` sin abrir puertos.
6. En las opciones de actualización elegir instalar automáticamente solo actualizaciones importantes de DSM.
7. Seguridad mínima antes de seguir: **Panel de control → Seguridad → Cuenta** → activar 2FA para el admin, y verificar que el firewall y la protección auto-block estén activos.

## 2. Storage Pool + Volumen en Btrfs

1. Abrir **Administrador de almacenamiento** (Storage Manager).
2. Crear Storage Pool:
   - Con 2 discos: **SHR** (tolera la falla de 1 disco). Con 1 solo disco: Basic (sin redundancia — comprar el segundo disco pronto).
3. Crear Volumen sobre el pool:
   - Sistema de archivos: **Btrfs** ← crítico, es lo que habilita snapshots. NO ext4.
   - Asignar toda la capacidad (o lo que se decida).
4. Esperar la verificación de paridad inicial en segundo plano (puede tomar horas con discos grandes; no bloquea los pasos siguientes).

## 3. Carpeta compartida `Hygge`

1. **Panel de control → Carpeta compartida → Crear**.
2. Nombre: `Hygge` (exacto, respetando mayúscula — Cloud Sync la mapea 1:1 con `/Hygge` de Dropbox).
3. Ubicación: el volumen Btrfs del paso 2.
4. Opciones recomendadas:
   - ✅ "Habilitar suma de comprobación de datos para la integridad avanzada de datos" (data checksum) — solo se puede activar al crear la carpeta, después no.
   - ❌ Papelera de reciclaje: opcional (los snapshots ya cubren recuperación); si se activa, programar vaciado.
   - Cifrado: NO para esta carpeta (complica Cloud Sync y la recuperación; el NAS está físicamente en la oficina).
5. Permisos: solo el admin (`hygge-admin`) con lectura/escritura por ahora.
   - ⚠️ `Hygge/09_ALICE/_cerebro/` contiene insights de coaching por persona (dato sensible, misma regla que en Dropbox: solo admins). Mientras la carpeta compartida entera sea solo-admin, está cubierto; si más adelante se da acceso al equipo al NAS, restringir esa subcarpeta explícitamente con permisos avanzados.

## 4. Cloud Sync ↔ Dropbox corporativo

1. **Centro de paquetes → buscar "Cloud Sync" → Instalar** y abrirlo.
2. Proveedor: **Dropbox** → se abre el OAuth de Dropbox en el navegador → **loguear con la cuenta Dropbox corporativa/Hygge** (NO la personal se.bonillarojas — regla del HANDOFF) → Permitir.
3. Configuración de la tarea:
   - Ruta local: `/Hygge` (la carpeta compartida del paso 3).
   - Ruta remota: `/Hygge` (la carpeta raíz corporativa en Dropbox).
   - Dirección de sincronización: **Bidireccional**.
   - Programación: sincronización **continua** (es el comportamiento por defecto al no fijar horario; en Configuración de la tarea dejar "Ejecutar en horario programado" desactivado).
   - ❌ NO marcar "No eliminar archivos en la carpeta de destino…" — un espejo de verdad debe propagar borrados en ambas direcciones; la protección contra borrados accidentales la dan los snapshots (paso 5), no el sync.
4. Confirmar y dejar correr la primera sincronización completa (según el tamaño de `/Hygge` puede tomar horas/días; el estado se ve en el panel de Cloud Sync).
5. Nota Dropbox Business/Team: si la cuenta corporativa es de equipo con Team Space, al autorizar hay que verificar que Cloud Sync vea la raíz correcta donde vive `/Hygge` (espacio de equipo vs. carpeta personal del miembro). Si `/Hygge` no aparece al elegir la ruta remota, seleccionar primero el Team Space en el selector de carpeta.

## 5. Snapshot Replication — diario, retención 30 días

1. **Centro de paquetes → buscar "Snapshot Replication" → Instalar** y abrirlo.
2. Ir a **Snapshots** → seleccionar la carpeta compartida `Hygge`.
3. **Configuración → Programación**:
   - ✅ Habilitar programación de snapshots.
   - Frecuencia: **diaria**, hora sugerida **03:00** (después del cron de brainsync de las 3:30 corre el snapshot del día siguiente; si se prefiere capturar el export del mismo día, poner 04:00).
4. **Configuración → Retención**:
   - ✅ Habilitar retención → conservar los últimos **30** snapshots (= 30 días con frecuencia diaria).
5. Pestaña avanzada: ✅ "Hacer visible el snapshot" (opcional pero útil: expone `#snapshot/` dentro de la carpeta para restaurar archivos sueltos por SMB/File Station sin abrir DSM).
6. Sacar el primer snapshot manual ahora (botón **Snapshot**) para verificar que todo funciona sin esperar a las 3am.

## 6. Checklist de verificación

- [ ] Volumen reporta sistema de archivos **Btrfs** en Storage Manager.
- [ ] Carpeta compartida `Hygge` existe con checksum activado.
- [ ] Cloud Sync en estado "Sincronizando"/"Actualizado", cuenta conectada = Dropbox corporativo (verificar el email en Cloud Sync → Configuración de cuenta).
- [ ] Prueba de ida: crear un archivo de prueba en Dropbox web dentro de `/Hygge/` → aparece en el NAS (File Station) en ~1 min.
- [ ] Prueba de vuelta: crear un archivo vía File Station en `/Hygge/` → aparece en Dropbox web.
- [ ] Borrar ambos archivos de prueba y confirmar que el borrado también se propaga.
- [ ] `Hygge/09_ALICE/_cerebro/` presente en el NAS tras la primera sincronización completa (si el export de brainsync ya corre; hoy está bloqueado por el OAuth de Dropbox — pendiente #1 del HANDOFF).
- [ ] Existe al menos 1 snapshot de `Hygge` y la programación dice "diaria / retención 30".
- [ ] QuickConnect responde desde fuera de la red de la oficina.

## 7. Gotchas

- **Btrfs es irreversible por volumen**: si por error se creó ext4, no hay conversión — hay que borrar el volumen y rehacerlo antes de meter data.
- Cloud Sync **no es backup**: replica también los borrados y el cifrado por ransomware. El backup real son los snapshots (y son locales al NAS — para cobertura completa contra robo/incendio, considerar más adelante Hyper Backup hacia un segundo destino).
- El token OAuth de Cloud Sync es independiente del token de `alicia-brain` (pendiente #1 del HANDOFF): arreglar uno no arregla el otro.
- La primera sincronización completa satura el ancho de banda de subida; si molesta en horario de oficina, en Cloud Sync → Configuración global se puede limitar la velocidad.
- Si Dropbox renombra/mueve `/Hygge` de nivel raíz, la tarea de Cloud Sync queda huérfana y hay que recrearla — no renombrar esa carpeta.
