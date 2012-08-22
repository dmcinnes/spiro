(function () {

  var GUY    = 1;
  var BULLET = 2;
  var BADA   = 4;
  var SEEKER   = 8;

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

  var PI  = Math.PI;
  var TAU = 2*PI; // http://tauday.com/
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
  var currentLevel;
  var badGuyCount;


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
      if (this.angle !== undefined) {
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
      
      this.derezz();
    },
    distance: function (other) {
      return Math.sqrt(Math.pow(this.x - other.x,2) + Math.pow(this.y - other.y,2));
    },
    collide: function (other) {
      // called when a collision occurs
    },
    derezz: function (other) {
      // called when this sprite goes to meet its user
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

  /////////////////
  //// SPRITES ////
  /////////////////

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
      if (dist < PI) {
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

      this.dist = currentLevel.f(this.angle);
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
    derezz: function () {
      badGuyCount--;
      newBadGuy();
    },

    type: BADA,

    collidesWith: BULLET + GUY
  };
  Sprite(Bada);

  var Seeker = function () {
    this.x = 0;
    this.y = 0;
    this.scale = 0.1;
    this.dir = PI/2;
    this.rot = 0;
  };
  Seeker.prototype = {
    tick: function (delta) {
      var change = delta / 100;
      var target = Math.atan2(guy.y - this.y, guy.x - this.x);
      var diff = centerClamp(target - this.dir);
      this.dir += (diff < 0) ? -change : change;
      this.dir = clamp(this.dir);
      this.x += Math.cos(this.dir) * delta / 10;
      this.y += Math.sin(this.dir) * delta / 10;
      this.rot -= delta / 100;
      this.rot = clamp(this.rot);
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0,0);
      var i = 0;
      while (i<TAU*3) {
        var w = Math.pow(i, 0.5) * 4;
        c.lineTo(Math.cos(i)*w,Math.sin(i)*w);
        i+=step;
      }
      c.strokeStyle='purple';
      c.stroke();
    },
    derezz: function () {
      badGuyCount--;
      newBadGuy();
    },

    type: SEEKER,

    collidesWith: BULLET + GUY
  };
  Sprite(Seeker);

  var Guy = function () {
    this.angle = 0;
    this.rot = 0;
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
      this.dist = currentLevel.f(this.angle);
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

    collidesWith: BADA + SEEKER
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
    derezz: function () {
      freeBullets.push(this);
    },
    collide: function (other) {
      other.remove();
      this.remove();
      var p = new Particles(5);
      p.x = this.x;
      p.y = this.y;
      p.add();
    },

    type: BULLET,

    collidesWith: BADA + SEEKER
  };
  Sprite(Bullet);

  var Particles = function (count) {
    this.life = 0;
    this.particleDirections = [];
    for (var i=0; i < count; i++) {
      var dir = Math.random() * TAU;
      this.particleDirections.push(
        Math.cos(dir),
        Math.sin(dir)
      );
    }
  };
  Particles.prototype = {
    tick: function (delta) {
      this.life += delta;
      if (this.life > 500) {
        this.remove();
      }
    },
    render: function (c) {
      var count = this.particleDirections.length;
      c.translate(this.x, this.y);
      for (var i = 0; i < count; i+=2) {
        var particleX = this.particleDirections[i];
        var particleY = this.particleDirections[i+1];
        c.save();
        c.translate(particleX * this.life/8, particleY * this.life/8);
        c.fillRect(0,0,2,2);
        c.restore();
      }
    }
  };
  Sprite(Particles);


  ////////////////////////
  //// Input Handling ////
  ////////////////////////

  var KEY_CODES = {
    88: 'x',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    32: 'space'
  };

  var KEYS = {};

  var keyDown = false;

  window.addEventListener('keydown', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = true;
    if (e.keyCode === 80) {
      pause();
    }
    keyDown = true;
  }, false);
  window.addEventListener('keyup', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = false;
    keyDown = false;
  }, false);

  function checkCollisions(canidate) {
    var sprite = headSprite;
    while (sprite) {
      // Compare this sprite's type against
      // the canidate's bitmask.
      // If it's non-zero the sprites can interact
      if (sprite.type & canidate.collidesWith) {
        // dumb distance comparison
        if (sprite.distance(canidate) < 10) {
          sprite.collide(canidate);
        }
      }
      sprite = sprite.nextSprite;
    }
  }

  function fire(direction) {
    if (freeBullets.length) {
      var bullet = freeBullets.pop();
      bullet.x = guy.x;
      bullet.y = guy.y;
      var angle = guy.rot + rot;
      if (direction === 'up') {
        angle -= PI/2;
      } else {
        angle -= 3*PI/2;
      }
      bullet.velX = Math.cos(angle);
      bullet.velY = Math.sin(angle);
      bullet.add();
    }
  }

  function pause() {
    running = !running;
    if (running) {
      loop();
    }
  }

  function integrateLine() {
    rotVel += rotAcc;
    if (Math.abs(rotVel) > maxRot) {
      rotVel = maxRot * Math.abs(rotVel)/rotVel;
    }

    rot += rotVel;
    rot = clamp(rot);
    rotAcc = 0;
  }

  function renderLine(f,z,rot) {
    c.save();

    // scale it up
    var percent = zz/zzTarget;
    c.scale(percent, percent);
    c.lineWidth = 2/percent;

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

  // clamp theta to 0..2*PI
  function clamp(theta) {
    var t = theta % TAU; 
    if (t < 0) {
      t += TAU;
    }
    return t;
  }

  // clamp theta to -PI..PI
  function centerClamp(theta) {
    var t = theta % TAU; 
    if (t < -PI) {
      t += TAU;
    } else if (t > PI) {
      t -= TAU;
    }
    return t;
  }

  function tangentAngle(theta) {
    var t1 = currentLevel.f(theta);
    var x1 = Math.cos(theta)*t1;
    var y1 = Math.sin(theta)*t1;
    var t2 = currentLevel.f(theta+step);
    var x2 = Math.cos(theta+step)*t2;
    var y2 = Math.sin(theta+step)*t2;
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


  function renderFramerate(delta) {
    frameCount++;
    secondCounter += delta;
    if (secondCounter > 500) {
      lastFramerate = currentFramerate;
      currentFramerate = frameCount;
      frameCount = 0;
      secondCounter = 0;
    }

    c.save();
    c.translate(-280, -280);
    c.scale(2, 2);
    c.fillText(currentFramerate + lastFramerate, 0, 0);
    c.restore();
  }

  function handleControls(elapsed) {
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

  function runSprites(elapsed) {
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
  }

  function newBadGuy() {
    if (currentLevel.nextBaddie < currentLevel.baddies.length) {
      var baddieClass = currentLevel.baddies[currentLevel.nextBaddie];
      var rotation = Math.random() * TAU;
      if (baddieClass === Bada) {
        addBada(rotation, currentLevel.badaSize);
      } else {
        var baddie = new baddieClass();
        baddie.add();
        baddie.rotation = rotation;
      }

      currentLevel.nextBaddie++;
      badGuyCount++;
    }
  }

  function startNewLevel(levelNumber) {
    currentLevelNumber = (levelNumber === undefined) ? currentLevelNumber + 1 : levelNumber;
    currentLevel = levels[currentLevelNumber];
    currentLevel.nextBaddie = 0;
    badGuyCount = 0;
    for (var i = 0; i < currentLevel.bgcc; i++) {
      newBadGuy();
    }
  }


  //////////////
  /// Levels ///
  //////////////

  var levels = [
    {
      f: function (t) {
        return zz * maxRadius / 3;
      },
      bgcc: 3,
      badaSize: 1,
      baddies: [Bada, Bada, Bada, Bada]
    },

    {
      f: function (t) {
        return (zz * maxRadius / 4.2*(1 + Math.cos(t)));
      },
      bgcc: 3,
      badaSize: 1,
      baddies: [Bada, Bada, Bada, Bada, Bada, Seeker]
    },

    {
      f: function (t) {
        return Math.sin(t * zz) * maxRadius;
      },
      bgcc: 4,
      badaSize: 1,
      baddies: [Bada, Bada, Bada, Bada, Bada, Seeker]
    }
  ];

  var guy = new Guy();
  guy.add();

  for (var i = 0; i < 6; i++) {
    freeBullets.push(new Bullet());
  }

  startNewLevel(0);


  var states = {
    waitToBegin: function () {
      if (keyDown) {
        zz = 0;
        currentState = states.startLevel;
      }
    },
    startLevel: function (elapsed) {
      if (zz < zzTarget) {
        zz += elapsed / 800;
      } else {
        zz = zzTarget;
        currentState = states.runLevel;
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
    },
    runLevel: function (elapsed) {
      if (badGuyCount === 0 && currentLevelNumber+1 < levels.length) {
        currentState = states.finishLevel;
      }
      handleControls(elapsed);
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      runSprites(elapsed);
    },
    finishLevel: function (elapsed) {
      if (zz < zzTarget*2) {
        zz += elapsed / 800;
      } else {
        zz = 0;
        currentState = states.startLevel;
        startNewLevel();
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
    },
    guyDie: function () {
    },
    outOfLives: function () {
    }
  };
  var currentState = states.waitToBegin;

  function loop() {
    var thisFrame = timestamp();
    var elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;

    if (elapsed > 100) {
      elapsed = 100; // cap it at 10 FPS
    }

    c.clearRect(-305, -305, 610, 610);

    currentState(elapsed);

    renderFramerate(elapsed);

    if (running) {
      requestAnimFrame(loop, canvas);
    }
  }
  loop();

})();
