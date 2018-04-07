const nanoid = require('nanoid');

module.exports = function startGameServer(io) {
  io.on('connection', onConnect);
};

function onConnect(socket) {
  const player = {
    id: nanoid(),
    x: Math.random() * 800,
    y: Math.random() * 600,
  };
  const playerId = player.id;

  socket.on('ready', () => {
    socket.emit('init', {
      yourId: player.id
    });
    socket.broadcast.emit('addPlayer', player);
  });

  socket.on('grabLog', log => socket.broadcast.emit('grabLog', log));
  socket.on('moveLog', log => socket.broadcast.emit('moveLog', log));
  socket.on('dropLog', log => socket.broadcast.emit('dropLog', log));

  socket.on('disconnect', () => {

  });
}
