(function () {

  var GUY    = 1;
  var BULLET = 2;
  var BADA   = 4;

  requestAnimFrame = (function () {
    return  window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame    ||
      window.oRequestAnimationFrame      ||
      window.msRequestAnimationFrame     ||
      function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
  })();

  // support high resolution timer
  if (window.performance && window.performance.webkitNow) {
    timestamp = function () {
      return performance.webkitNow();
    };
  } else {
    timestamp = Date.now;
  }

  var TAU = 2*Math.PI;
  var gameWidth = 600;
  var maxRadius = gameWidth / 2;
  var canvas = document.getElementById('c');
  var c = canvas.getContext('2d');
  c.translate(305,305);
  c.lineWidth = 2;
  var step = TAU/360;
  var running = true;
  var tailSprite = null;
  var headSprite = null;

  var SpritePrototype = {
    prevSprite: null,
    nextSprite: null,
    outside: function () {
      return this.x > maxRadius  ||
             this.x < -maxRadius ||
             this.y > maxRadius  ||
             this.y < -maxRadius;
    },
    updateSpriteCartesian: function () {
      if (this.angle) {
        this.x = Math.cos(rot + this.angle) * this.dist;
        this.y = Math.sin(rot + this.angle) * this.dist;
      }
    },
    add: function () {
      if (tailSprite) {
        tailSprite.nextSprite = this;
        this.prevSprite = tailSprite;
      } else {
        headSprite = this;
      }
      tailSprite = this;
    },
    remove: function () {
      if (this.prevSprite) {
        this.prevSprite.nextSprite = this.nextSprite;
      } else {
        headSprite = this.nextSprite;
      }
      if (this.nextSprite) {
        this.nextSprite.prevSprite = this.prevSprite;
      } else {
        tailSprite = this.prevSprite;
      }
      // clear for further use
      this.prevSprite = null;
      this.nextSprite = null;
    },
    distance: function (other) {
      return Math.sqrt(Math.pow(this.x - other.x,2) + Math.pow(this.y - other.y,2));
    },
    collide: function (other) {
    }
  };

  // add the sprite methods to the prototype
  var Sprite = function (proto) {
    for (var method in SpritePrototype) {
      if (SpritePrototype.hasOwnProperty(method) &&
          !proto.prototype[method]) {
        proto.prototype[method] = SpritePrototype[method];
      }
    }
  };

  var Bada = function () {
    this.ani = 0;
    this.dist = 0;
    this.scale = 0.1;
  };
  Bada.prototype = {
    tick: function (delta) {
      this.ani += delta / 100;
      this.ani %= 5;
      var speed = delta / 10000;
      // --D-b--
      // --b-D--
      // -D---b-
      // -b---D-
      var dist = this.angle - rot;
      if (dist < Math.PI) {
        speed *= (dist < 0) ? 1 : -1;
      } else {
        speed *= (dist > 0) ? 1 : -1;
      }

      if (this.scale < 1) {
        this.scale += delta / 1000;
      } else if (this.scale > 1) {
        this.scale = 1;
      }

      this.angle = clamp(this.angle + speed);

      this.dist = f(this.angle);
      this.rot = tangentAngle(this.angle);

      this.updateSpriteCartesian();
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.scale(this.scale, this.scale);
      c.beginPath();
      c.strokeStyle='blue';
      c.lineWidth = 3/this.scale;
      c.moveTo(-10 + this.ani, 0);
      c.lineTo(0, -8 - this.ani);
      c.lineTo(10 - this.ani, 0);
      c.lineTo(0, 8 + this.ani);
      c.closePath();
      c.stroke();
    },

    type: BADA,

    collidesWith: BULLET + GUY
  };
  Sprite(Bada);

  var Guy = function () {
    this.angle = 0;
    this.x = 0;
    this.y = 0;
  };
  Guy.prototype = {
    path: [-15,   0,
           -10,  -8,
            -5,  -8,
            -2, -10,
            -2,  -8,
             2,  -8,
             2, -10,
             5,  -8,
            10,  -8,
            15,   0,
            10,   8,
             5,   8,
             2,  10,
             2,   8,
            -2,   8,
            -2,  10,
            -5,   8,
           -10,   8,
           -15,   0],

    tick: function (delta) {
      this.dist = f(this.angle);
      this.pathLength = this.path.length/2;
      this.rot = tangentAngle(this.angle);
      this.updateSpriteCartesian();
      this.angle = rot;
    },

    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.beginPath();
      c.moveTo(this.path[0], this.path[1]);
      for (var i = 1; i < this.pathLength; i++) {
        c.lineTo(this.path[2*i], this.path[2*i+1]);
      }
      c.closePath();
      c.fillStyle='black';
      c.fill();
      c.stroke();
      c.fillStyle='red';
      c.fillRect(-10, -7, 20, 14);
    },

    type: GUY,

    collidesWith: BADA
  };
  Sprite(Guy);

  var Bullet = function () {
    this.rot = 0;
  };
  Bullet.prototype = {
    tick: function (delta) {
      this.rot++;
      this.x += this.velX * delta;
      this.y += this.velY * delta;
      if (this.outside()) {
        this.remove();
      }
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      c.fillStyle='black';
      c.fillRect(-4,-4,8,8);
    },
    remove: function () {
      freeBullets.push(this);
      SpritePrototype.remove.apply(this);
    },
    collide: function (other) {
      other.remove();
      this.remove();
    },

    type: BULLET,

    collidesWith: BADA
  };
  Sprite(Bullet);

  function checkCollisions(canidate) {
    var sprite = headSprite;
    while (sprite) {
      if (sprite.type & canidate.collidesWith) {
        if (sprite.distance(canidate) < 10) {
          sprite.collide(canidate);
        }
      }
      sprite = sprite.nextSprite;
    }
  }

  function pause() {
    running = !running;
    if (running) {
      loop();
    }
  }

  function fire(direction) {
    if (freeBullets.length) {
      var bullet = freeBullets.pop();
      bullet.x = guy.x;
      bullet.y = guy.y;
      var angle = guy.rot + rot;
      if (direction === 'up') {
        angle -= Math.PI/2;
      } else {
        angle -= 3*Math.PI/2;
      }
      bullet.velX = Math.cos(angle);
      bullet.velY = Math.sin(angle);
      bullet.add();
    }
  }

  var KEY_CODES = {
    88: 'x',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    32: 'space'
  };

  var KEYS = {};

  window.addEventListener('keydown', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = true;
    if (e.keyCode === 80) {
      pause();
    }
  }, false);
  window.addEventListener('keyup', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = false;
  }, false);

  function renderLine(f,z,rot) {
    c.save();
    c.rotate(rot);
    var i=0;
    c.beginPath();
    c.moveTo(f(0,z),0);
    while (i<TAU) {
      var w = f(i,z);
      c.lineTo(Math.cos(i)*w,Math.sin(i)*w);
      i+=step;
    }
    c.strokeStyle='black';
    c.stroke();
    c.restore();
  }

  function clamp(theta) {
    var t = theta % TAU; 
    if (t < 0) {
      t += TAU;
    }
    return t;
  }

  function f(t,z) {
    z = z ? z : zz;
    return Math.sin(t * z) * maxRadius;
  }

  function tangentAngle(t) {
    var t1 = f(t);
    var x1 = Math.cos(t)*t1;
    var y1 = Math.sin(t)*t1;
    var t2 = f(t+step);
    var x2 = Math.cos(t+step)*t2;
    var y2 = Math.sin(t+step)*t2;
    x = x2 - x1;
    y = y2 - y1;
    return Math.atan2(y, x); // radians
  }

  function addBada(position, length) {
    for (var i = 0; i < length; i++) {
      var bada = new Bada();
      bada.angle = position + i/20;
      bada.ani = i;
      bada.add();
    }
  }

  var offset = 0;
  var zz = 0;
  var zzTarget = 2;
  var lastFrame = timestamp();
  var rotAcc = 0;
  var rotVel = 0;
  var rot = 0;
  var maxRot = 0.04;
  var frameCount = 0;
  var secondCounter = 0;
  var lastFramerate = 0;
  var currentFramerate = 0;

  var BULLET_FIRE_TIMEOUT = 150;
  var currentBulletFireTimeout = 0;
  var freeBullets = [];
  for (var i = 0; i < 6; i++) {
    freeBullets.push(new Bullet());
  }

  var guy = new Guy();
  guy.add();

  addBada(1, 5);

  function loop() {
    var thisFrame = timestamp();
    var elapsed = thisFrame - lastFrame;

    frameCount++;
    secondCounter += elapsed;
    if (secondCounter > 500) {
      lastFramerate = currentFramerate;
      currentFramerate = frameCount;
      frameCount = 0;
      secondCounter = 0;
    }

    if (elapsed > 100) {
      elapsed = 100; // cap it at 10 FPS
    }

    lastFrame = thisFrame;
    c.clearRect(-305, -305, 610, 610);
    c.save();
    c.translate(-280, -280);
    c.scale(2, 2);
    c.fillText(currentFramerate + lastFramerate, 0, 0);
    c.restore();

    if (zz < zzTarget) {
      zz += elapsed / 800;
    } else {
      zz = zzTarget;
      if (KEYS.left) {
        rotAcc = -elapsed / 10000;
      }
      if (KEYS.right) {
        rotAcc = elapsed / 10000;
      }
      if (KEYS.space) {
        rotAcc = -rotVel / 10;
      }
      if (KEYS.x) {
        currentBulletFireTimeout -= elapsed;
        if (currentBulletFireTimeout < 0) {
          currentBulletFireTimeout = BULLET_FIRE_TIMEOUT;
          fire('up');
          fire('down');
        }
      }
    }

    rotVel += rotAcc;
    if (Math.abs(rotVel) > maxRot) {
      rotVel = maxRot * Math.abs(rotVel)/rotVel;
    }

    rot += rotVel;
    rot = clamp(rot);
    rotAcc = 0;

    var percent = zz/zzTarget;
    c.save();
    c.scale(percent, percent);
    c.lineWidth = 2/percent;

    renderLine(f,zz,rot);

    var sprite = headSprite;
    while (sprite) {
      // tick with 0 until the game really starts
      sprite.tick((zz === zzTarget) ? elapsed : 0);

      c.save();
      sprite.render(c);
      c.restore();

      checkCollisions(sprite);

      sprite = sprite.nextSprite;
    }
    c.restore();

    if (running) {
      requestAnimFrame(loop, canvas);
    }
  }
  loop();

})();
