(function () {

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
  var maxRadius = 300;
  var canvas = document.getElementById('c');
  var c = canvas.getContext('2d');
  c.translate(305,305);
  c.lineWidth = 2;
  var step = TAU/360;
  var running = true;

  function updateSpriteCartesian(sprite) {
    if (sprite.angle) {
      sprite.x = Math.cos(rot + sprite.angle)*sprite.dist;
      sprite.y = Math.sin(rot + sprite.angle)*sprite.dist;
    }
  }

  var Bada = function () {
    this.ani = 0;
    this.dist = 0;
  };
  Bada.prototype = {
    tick: function (delta) {
      this.ani += delta / 100;
      this.ani %= 5;
      var speed = delta / 12000;
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

      this.angle = clamp(this.angle + speed);

      this.dist = f(this.angle);
      this.rot = tangentAngle(this.angle);

      updateSpriteCartesian(this);
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.beginPath();
      c.strokeStyle='blue';
      c.moveTo(-10 + this.ani, 0);
      c.lineTo(0, -8 - this.ani);
      c.lineTo(10 - this.ani, 0);
      c.lineTo(0, 8 + this.ani);
      c.closePath();
      c.stroke();
    }
  };

  var Guy = function () {
    this.angle = 0;
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
      updateSpriteCartesian(this);
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
    }
  };

  var Bullet = function () {
    this.rot = 0;
  };
  Bullet.prototype = {
    tick: function (delta) {
      this.rot++;
      this.x += this.velX * delta / 2;
      this.y += this.velY * delta / 2;
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      c.fillStyle='black';
      c.fillRect(-3,-3,4,4);
    }
  };

  function pause() {
    running = !running;
    if (running) {
      loop();
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

  var BULLET_FIRE_TIMEOUT = 200;
  var currentBulletFireTimeout = 0;
  var bullets = [
    new Bullet(),
    new Bullet(),
    new Bullet()
  ];

  var sprites = [];

  var guy = new Guy();
  sprites.push(guy);

  var bada = new Bada();
  bada.angle = 1 + Math.PI/2;
  sprites.push(bada);

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
    c.translate(-200, -200);
    c.scale(2, 2);
    c.fillText(currentFramerate + lastFramerate, 0, 0);
    c.restore();

    if (zz < zzTarget) {
      zz += elapsed / 800;
    } else {
      zz = zzTarget;
      // rotAcc += elapsed / 1000;
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
        if (bullets.length > 0 &&
            currentBulletFireTimeout < 0) {
          currentBulletFireTimeout = BULLET_FIRE_TIMEOUT;
          var bullet = bullets.pop();
          bullet.x = guy.x;
          bullet.y = guy.y;
          var angle = guy.rot + rot - Math.PI/2;
          bullet.velX = Math.cos(angle);
          bullet.velY = Math.sin(angle);
          sprites.push(bullet);
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

    guy.angle = rot;

    renderLine(f,zz,rot);

    var spriteCount = sprites.length;
    for (var i = 0; i < spriteCount; i++) {
      var sprite = sprites[i];

      sprite.tick(elapsed);

      c.save();
      sprite.render(c);
      c.restore();
    }

    if (running) {
      requestAnimFrame(loop, canvas);
    }
  }
  loop();

})();
