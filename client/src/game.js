import { throttle, range } from 'lodash';
import config from '../config';
import socket from './socket';
import Phaser from './Phaser';
import nanoid from 'nanoid';

const width = 960;
const height = 540;
const woodRespawnDelay = 5000; // ms

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
  const firePosition = {
    x: 200,
    y: height - 20,
  };

  const draggableLogAreaPosition = {
    x: width * 0.8,
    y: height - 50,
  };

  // Add fire and static logs around it
  createLog({x: firePosition.x - 50, y: firePosition.y - 50, spriteId: 'log_c'});
  createLog({x: firePosition.x + 50, y: firePosition.y - 40, spriteId: 'log_a'});
  const fire = createFire();
  createLog({x: firePosition.x - 50, y: firePosition.y - 10, spriteId: 'log_a'});
  createLog({x: firePosition.x + 20, y: firePosition.y - 10, spriteId: 'log_b'});

  // Add draggable logs
  const draggableLogs = ['log_a', 'log_b', 'log_c'].map((spriteId, i) => {
    return createDraggableLog({
      spriteId,
      x: draggableLogAreaPosition.x + (i * 50),
      y: draggableLogAreaPosition.y + ((Math.random() * 50) - 25)
    });
  });

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

  socket.on('fireLevel', ({ fireLevel }) => setFireLevel(fireLevel));

  socket.on('init', ({ fireLevel }) => {
    setFireLevel(fireLevel);
  });

  socket.emit('ready');

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
      reset(duration) {
        if(duration) {
          game.tweens.add({
            targets: [sprite],
            x, y,
            duration: 100,
          });
        } else {
          log.updatePosition(x, y);
        }
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
      if(isOverlapping(sprite, fire)) {
        socket.emit('feedFire');
        log.reset(0);
        sprite.alpha = 0;

        setTimeout(() => {
          game.tweens.add({
            targets: [sprite],
            alpha: 1,
            duration: 300,
          });
        }, woodRespawnDelay);
      } else {
        log.reset(100);
      }
    });

    return log;
  }

  function createFire() {
    const fire = game.add.sprite(firePosition.x, firePosition.y, 'campingscene', 'small/1.png');
    const smallFireFrames = game.anims.generateFrameNames('campingscene', {
      start: 1,
      end: 3,
      zeroPad: 0,
      prefix: 'small/',
      suffix: '.png'
    });
    const largeFireFrames = game.anims.generateFrameNames('campingscene', {
      start: 1,
      end: 3,
      zeroPad: 0,
      prefix: 'large/',
      suffix: '.png'
    });

    game.anims.create({ key: 'small', frames: smallFireFrames, frameRate: 10, repeat: -1 });
    game.anims.create({ key: 'large', frames: largeFireFrames, frameRate: 10, repeat: -1 });

    return fire;
  }

  function setFireAnimation(animation) {
    fire.anims.play(animation);
    fire.x = firePosition.x;
    fire.y = firePosition.y - (fire.height / 2);
  }

  function setFireLevel(fireLevel) {
    if(fireLevel <= 5) {
      setFireAnimation('small');
    } else {
      setFireAnimation('large');
    }
  }

  function isOverlapping(spriteA, spriteB) {
    const topLeft = getTopLeft(spriteB);
    return spriteA.x >= topLeft.x &&
      spriteA.y >= topLeft.y &&
      spriteA.x < (topLeft.x + spriteB.width) &&
      spriteA.y < (topLeft.y + spriteB.height);
  }

  function getTopLeft(sprite) {
    return {
      x: sprite.x - (sprite.width / 2),
      y: sprite.y - (sprite.height / 2),
    };
  }
}
