const socket = io();

let userName;
const PASSWORD = 'mamao';

function showPrompt(message, isPassword = false) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('prompt-overlay');
        const input = document.getElementById('password-input');
        const submitButton = document.getElementById('submit-password');
        const promptTitle = overlay.querySelector('h3');

        promptTitle.textContent = message;
        input.type = isPassword ? 'password' : 'text';
        input.value = '';
        input.placeholder = isPassword ? 'Digite a senha' : 'Digite seu nome';
        overlay.style.display = 'flex';

        function handleSubmit() {
            const value = input.value.trim();
            if (value) {
                overlay.style.display = 'none';
                resolve(value);
            }
        }

        submitButton.onclick = handleSubmit;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        };
    });
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Este navegador não suporta notificações de desktop');
        return false;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
        console.log('Permissão para notificações concedida');
        return true;
    } else if (permission === 'denied') {
        console.log('Permissão para notificações negada');
        addMessage('As notificações foram negadas. Você pode não receber alertas de novas mensagens.');
        return false;
    } else {
        console.log('Permissão para notificações não foi decidida');
        addMessage('Por favor, permita as notificações para receber alertas de novas mensagens.');
        return false;
    }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registrado com sucesso:', registration);
      return registration;
    } catch (error) {
      console.error('Falha ao registrar o Service Worker:', error);
    }
  }
}

async function subscribeToPush(swRegistration) {
  try {
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'BLBx-hxPOZ7KSBYFdxZ9nPbh9mhc9KKLUzOFzLO_j9xRCch1_NXfQEzwFdqKSX8rYNEh4vvqVyEYZUlA5dF2xQA'
    });
    console.log('Push Notification Subscription:', subscription);

    await fetch(`/subscribe?userName=${encodeURIComponent(userName)}`, {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Inscrição de push enviada para o servidor');
  } catch (error) {
    console.error('Falha ao se inscrever para notificações push:', error);
  }
}

async function setupPushNotifications() {
  const swRegistration = await registerServiceWorker();
  if (swRegistration) {
    await subscribeToPush(swRegistration);
  }
}

async function login() {
    let password = localStorage.getItem('chatPassword');
    let storedUserName = localStorage.getItem('chatUserName');

    if (!password || password !== PASSWORD) {
        localStorage.removeItem('chatPassword'); // Remove a senha incorreta, se existir
        do {
            password = await showPrompt('Digite a senha para acessar o chat:', true);
            if (password !== PASSWORD) {
                alert('Senha incorreta. Tente novamente.');
            }
        } while (password !== PASSWORD);
        localStorage.setItem('chatPassword', password);
    } else {
        console.log('Senha correta');
        document.getElementById('prompt-overlay').style.display = "none";
    }

    if (storedUserName) {
        userName = storedUserName;
    } else {
        do {
            userName = await showPrompt('Por favor, digite seu nome:');
        } while (!userName);
        localStorage.setItem('chatUserName', userName);
    }

    document.getElementById('chat-container').style.display = 'flex';
    socket.emit('user login', userName);

    await setupPushNotifications();

    const notificationsEnabled = await requestNotificationPermission();
    if (!notificationsEnabled) {
        addMessage('Aviso: As notificações estão desativadas. Você pode não receber alertas de novas mensagens.');
    }
}

login();

function addMessage(msg) {
    const [userName, content] = msg.split(': ');
    const li = document.createElement('li');
    li.className = 'message';
    
    const userSpan = document.createElement('span');
    userSpan.className = 'user-name';
    userSpan.textContent = userName;
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'message-content';
    contentSpan.textContent = content;
    
    li.appendChild(userSpan);
    li.appendChild(contentSpan);
    
    if (userName === window.userName) {
        li.classList.add('own-message');
    }
    
    document.getElementById('messages').appendChild(li);
    scrollToBottom();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        const statusSpan = document.createElement('span');
        statusSpan.className = `user-status ${user.isOnline ? 'online' : 'offline'}`;
        li.appendChild(statusSpan);
        li.appendChild(document.createTextNode(`${user.userName} - Último login: ${new Date(user.lastLogin).toLocaleString()}`));
        userList.appendChild(li);
    });
}

document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    if (input.value) {
        socket.emit('chat message', `${userName}: ${input.value}`);
        input.value = '';
    }
});

function showNotification(message) {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            try {
                new Notification('Nova mensagem no chat', {
                    body: message,
                    icon: '/icon.png'
                });
            } catch (error) {
                console.error('Erro ao mostrar notificação:', error);
                addMessage(`Erro ao mostrar notificação: ${error.message}`);
            }
        } else if (Notification.permission === 'denied') {
            console.log('Notificações foram negadas pelo usuário');
            addMessage('As notificações estão desativadas. Você pode não receber alertas de novas mensagens.');
        } else {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification(message);
                }
            });
        }
    } else {
        console.log('Este navegador não suporta notificações de desktop');
        addMessage('Seu navegador não suporta notificações de desktop.');
    }
}

socket.on('chat message', (msg) => {
    addMessage(msg);
    scrollToBottom();

    // Mostrar notificação apenas se a mensagem não for do usuário atual
    if (!msg.startsWith(userName)) {
        showNotification(msg);
    }
});

socket.on('load messages', (messages) => {
    messages.forEach(message => {
        addMessage(`${message.userName}: ${message.content}`);
    });
    scrollToBottom();
});

socket.on('user list', (users) => {
    updateUserList(users);
});

addMessage('Bem-vindo ao chat!');
