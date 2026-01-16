if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha silenciosa: o app continua utilizável sem SW.
    });
  });
}
