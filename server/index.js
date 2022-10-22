const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const cors = require('cors');

const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const blockedList = require('./blockedList');

const router = require('./router');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(cors());
app.use(router);

const check = (message) => {
  return new Promise((resolve, reject) => {
    let ans=0;

    blockedList.forEach((word) => {
      let pos = message.search(word);
      if(pos!=-1){
        message = message.replace(word, "****"); 
        ans=1;
      }
    })
    if(ans===0)
      resolve(message);
    else
      reject(message);
  })
}

io.on('connect', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if(error) return callback(error);

    socket.join(user.room);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to room ${user.room}.`});
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined!` });
    
    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    
    callback();
  });
  
  socket.on('sendMessage', async (message, callback) => {
    const user = getUser(socket.id);

    try {
      await check(message);
      io.to(user.room).emit('message', { user: user.name, text: message });
    }
    catch (newMsg) {
      socket.emit('message', { user: 'admin', text: `${user.name}, Your message was blocked by admin!`});
      io.to(user.room).emit('message', { user: user.name, text: newMsg });
    }
        
    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if(user) {
      io.to(user.room).emit('message', { user: 'Admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room)});
    }
  })
});

server.listen(process.env.PORT || 5000, () => console.log(`Server has started.`));