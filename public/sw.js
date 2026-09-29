// Service worker minimal : rend l'appli installable (PWA) et prêt pour les notifications push.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : { title: "Prêt Matériel", body: "" };
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", data: { link: data.link || "/notifications" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data.link));
});
