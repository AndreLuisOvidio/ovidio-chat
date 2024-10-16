const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const webpush = require('web-push');

// Configuração do Web Push
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
  'mailto:seu-email@exemplo.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Configuração do Sequelize com SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite')
});

// Definição do modelo de Mensagem
const Message = sequelize.define('Message', {
  userName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});

// Definição do modelo de Usuário
const User = sequelize.define('User', {
  userName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: false
  },
  isOnline: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Sincroniza o modelo com o banco de dados
sequelize.sync()
  .then(() => console.log('Banco de dados sincronizado'))
  .catch(err => console.error('Erro ao sincronizar o banco de dados:', err));

app.use(express.static('public'));
app.use(express.json());

// Armazenar as inscrições de push
const pushSubscriptions = new Map();

app.post('/subscribe', (req, res) => {
  const subscription = req.body;
  const userName = req.query.userName;
  pushSubscriptions.set(userName, subscription);
  res.status(201).json({});
});

io.on('connection', (socket) => {
  console.log('Um usuário se conectou');
  let currentUser;

  socket.on('user login', async (userName) => {
    try {
      [currentUser] = await User.findOrCreate({
        where: { userName },
        defaults: { lastLogin: new Date() }
      });
      currentUser.isOnline = true;
      currentUser.lastLogin = new Date();
      await currentUser.save();

      // Envia a lista atualizada de usuários para todos
      io.emit('user list', await User.findAll());

      // Envia as últimas 50 mensagens para o usuário que acabou de se conectar
      const messages = await Message.findAll({
        limit: 50,
        order: [['createdAt', 'DESC']]
      });
      socket.emit('load messages', messages.reverse());
    } catch (error) {
      console.error('Erro ao processar login:', error);
    }
  });

  socket.on('chat message', async (msg) => {
    const [userName, content] = msg.split(': ');
    
    try {
      // Salva a mensagem no banco de dados
      const savedMessage = await Message.create({ userName, content });
      
      // Emite a mensagem para todos os clientes conectados
      io.emit('chat message', `${savedMessage.userName}: ${savedMessage.content}`);

      // Envia notificação push para todos os usuários inscritos, exceto o remetente
      for (const [subscriptionUserName, subscription] of pushSubscriptions) {
        if (subscriptionUserName !== userName) {
          const payload = JSON.stringify({
            title: 'Nova mensagem no chat',
            body: `${userName}: ${content}`
          });
          webpush.sendNotification(subscription, payload).catch(error => {
            console.error('Erro ao enviar notificação:', error);
          });
        }
      }
    } catch (error) {
      console.error('Erro ao salvar a mensagem:', error);
    }
  });

  socket.on('disconnect', async () => {
    if (currentUser) {
      currentUser.isOnline = false;
      await currentUser.save();
      io.emit('user list', await User.findAll());
    }
    console.log('Um usuário se desconectou');
  });
});

const PORT = process.env.PORT || 8085;
http.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
