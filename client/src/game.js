import config from '../config';
import socket from './socket';
import Phaser from './Phaser';
import nanoid from 'nanoid';

const width = 800;
const height = 600;

function createLog() {
  return {
    id: nanoid,
    x: Math.random() * width,
    y: Math.random() * height,
  };
}

export default function startGame() {
  const log = createLog();

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 200 },
      },
    },
    scene: {
      preload() {
        this.load.setBaseURL(config.server);
        this.load.image('log', require('./assets/log.png'));
      },

      create() {
        const renderLog = log => this.add.image(log.x, log.y, 'log');
        socket.on('logs', ({logs}) => {
          console.log('logs');
          logs.forEach(renderLog)
        });
        socket.on('createLog', renderLog);

        socket.emit('ready');
        socket.emit('createLog', {x: startX, y: startY});
        renderLog(log);
      },
    },
  });
}
