self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "MatchPlay", {
      body: payload.body ?? "",
      data: { matchId: payload.matchId ?? null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const matchId = event.notification.data?.matchId;
  const url = matchId ? `/matches/${matchId}` : "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.endsWith(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
