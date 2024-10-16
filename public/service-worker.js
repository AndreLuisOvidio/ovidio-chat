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
      .then(() => console.log('Notificação exibida com sucesso'))
      .catch(error => console.error('Erro ao exibir notificação:', error))
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notificação clicada');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://chat.ovidio.dev')
      .then(() => console.log('Janela aberta com sucesso'))
      .catch(error => console.error('Erro ao abrir janela:', error))
  );
});

self.addEventListener('install', function(event) {
  console.log('Service Worker instalado');
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker ativado');
});

self.addEventListener('updatefound', function() {
  console.log('Nova versão do Service Worker encontrada');
});
