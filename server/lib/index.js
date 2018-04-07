const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = 8080;

app.use(require('cors')());
app.use(express.static('public'));

const state = {
  logs: [],
};

io.on('connection', socket => {
  console.log('a user connected');

  socket.on('ready', () => {
    console.log('ready');
    setTimeout(() => socket.emit('logs', state));
  });

  socket.on('createLog', log => {
    state.logs.push(log);
    socket.broadcast.emit('createLog', log);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

http.listen(port, error => {
  console.log(error || `listening on *:${port}`);
});
