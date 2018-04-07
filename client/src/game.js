import { throttle, range } from 'lodash';
import config from '../config';
import socket from './socket';
import Phaser from './Phaser';
import nanoid from 'nanoid';

const width = 960;
const height = 540;

const center = {x: width / 2, y: height / 2};

export default function startGame() {
  return new Phaser.Game({
    width, height,
    type: Phaser.AUTO,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { y: 200 },
      },
    },
    scene: { preload, create },
  });
}

function preload() {
  this.load.setBaseURL(config.server);
  this.load.image('background', require('./assets/background.png'));
  this.load.image('log_a', require('./assets/log_a.png'));
  this.load.image('log_b', require('./assets/log_b.png'));
  this.load.image('log_c', require('./assets/log_c.png'));
  this.load.atlas('campingscene', require('./assets/scene.png'), require('file-loader!./assets/scene.json'));
}

function create() {
  const game = this;
  const logs = new Map();
  const background = this.add.sprite(center.x, center.y, 'campingscene', 'background.png').setScale(0.5);
  const fire = createFire();

  const draggableLogs = [
    createDraggableLog({x: width * 0.2, y: height - 65, spriteId: 'log_a'}),
    createDraggableLog({x: (width * 0.2) + 50, y: height - 50, spriteId: 'log_b'}),
    createDraggableLog({x: (width * 0.2) + 100, y: height - 65, spriteId: 'log_c'}),
  ];

  socket.on('grabLog', createLog);
  socket.on('moveLog', remoteLog => {
    const log = logs.get(remoteLog.id);
    if(log) {
      log.updatePosition(remoteLog.x, remoteLog.y);
    } else {
      createLog(remoteLog);
    }
  });
  socket.on('dropLog', remoteLog => {
    const log = logs.get(remoteLog.id);
    if(log) {
      log.getSprite().destroy();
      logs.delete(log.id);
    }
  });

  function createLog({id, x, y, spriteId}) {
    const sprite = game.add.image(x, y, spriteId).setScale(0.5);
    const log = {
      id: id || nanoid(),
      initialX: x,
      initialY: y,
      x, y, spriteId,
      getSprite() {
        return sprite;
      },
      updatePosition(x, y) {
        const sprite = log.getSprite();
        log.x = sprite.x = x;
        log.y = sprite.y = y;
      },
      reset() {
        log.updatePosition(x, y);
      },
    };
    logs.set(log.id, log);
    return log;
  }

  function createDraggableLog(props) {
    const log = createLog(props);
    const sprite = log.getSprite();

    sprite.setInteractive();
    game.input.setDraggable(sprite);

    sprite.on('dragstart', () => socket.emit('grabLog', log));

    sprite.on('drag', (pointer, x, y) => {
      log.updatePosition(x, y);
      socket.emit('moveLog', log);
    });

    sprite.on('dragend', () => {
      socket.emit('dropLog', log);
      log.reset();
    });

    return log;
  }

  function createFire(animation='small') {
    const fire = this.add.sprite(100, 100, 'campingscene', 'small/1.png');
    const smallFireFrames = this.anims.generateFrameNames('campingscene', {
      start: 1,
      end: 3,
      zeroPad: 0,
      prefix: 'small/',
      suffix: '.png'
    });
    const largeFireFrames = this.anims.generateFrameNames('campingscene', {
      start: 1,
      end: 3,
      zeroPad: 0,
      prefix: 'large/',
      suffix: '.png'
    });

    this.anims.create({ key: 'small', frames: smallFireFrames, frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'large', frames: largeFireFrames, frameRate: 10, repeat: -1 });
    fire.anims.play(animation);

    return fire;
  }

  function setFireAnimation(animation) {
    fire.anims.play(animation);
  }
}
