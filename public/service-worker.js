self.addEventListener('push', function(event) {
  console.log('Push event recebido');
  const data = event.data.json();
  console.log('Dados da notificação:', data);
  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/badge.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://chat.ovidio.dev')
  );
});
