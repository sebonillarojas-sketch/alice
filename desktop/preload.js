// Puente entre la web y el shell. Superficie mínima y explícita: el shell NUNCA
// inyecta JavaScript en la página ni toca su estado. Le manda mensajes y la web
// decide qué hacer con ellos.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("alice", {
  notify: (banner) => ipcRenderer.send("alice:notify", banner),

  onResume: (cb) => {
    const h = () => cb();
    ipcRenderer.on("alice:resume", h);
    return () => ipcRenderer.removeListener("alice:resume", h);
  },

  onOpen: (cb) => {
    const h = (_e, link) => cb(link);
    ipcRenderer.on("alice:open", h);
    return () => ipcRenderer.removeListener("alice:open", h);
  },
});
