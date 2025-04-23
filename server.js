const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', socket => {
  socket.on('joinChannel', channel => {
    socket.join(channel);
    socket.channel = channel;
    socket.broadcast.to(channel).emit('userJoined', socket.id);
  });

  socket.on('offer', data => {
    io.to(data.targetUserId).emit('offer', { userId: socket.id, offer: data.offer });
  });

  socket.on('answer', data => {
    io.to(data.targetUserId).emit('answer', { userId: socket.id, answer: data.answer });
  });

  socket.on('iceCandidate', data => {
    io.to(data.targetUserId).emit('iceCandidate', { userId: socket.id, candidate: data.candidate });
  });

  socket.on('leaveChannel', () => {
    socket.leave(socket.channel);
    socket.broadcast.to(socket.channel).emit('userLeft', socket.id);
  });

  socket.on('disconnect', () => {
    if (socket.channel) {
      socket.broadcast.to(socket.channel).emit('userLeft', socket.id);
    }
  });
});

const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
