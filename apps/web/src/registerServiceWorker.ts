export const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const cacheLoadedAssets = () => {
          const urls = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((url) => {
              const parsedUrl = new URL(url, window.location.origin);

              return (
                parsedUrl.origin === window.location.origin &&
                parsedUrl.pathname.startsWith("/assets/")
              );
            });

          registration.active?.postMessage({
            type: "CACHE_URLS",
            urls
          });
        };

        if (registration.active) {
          cacheLoadedAssets();
          return;
        }

        navigator.serviceWorker.ready.then(cacheLoadedAssets).catch((error: unknown) => {
          console.error("Service worker readiness failed", error);
        });
      })
      .catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
  });
};
