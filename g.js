(function () {

  var GUY    = 1,
      BOLT   = 2,
      PULSE  = 4,
      BADA   = 8,
      SEEKER = 16,
      SPIDER = 32,
      JELLY  = 64;

  var LEFT  = 1,
      RIGHT = 2,
      UP    = 3,
      DOWN  = 4;

  var GOOD_GUYS = GUY + BOLT + PULSE,
      BAD_GUYS  = BADA + SEEKER + SPIDER;

  window.scrollTo(0,1);

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

  var hasTouch = (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch);
  if (hasTouch) {
    document.body.className = "touch";
  }

  if (hasTouch && window.innerHeight < 600) {
    var meta = document.querySelector('meta[name="viewport"]');
    meta.content = meta.content.replace(/1/g, '0.45');
  }

  ////////////////
  /// Sound FX ///
  ////////////////

  var synth = new SfxrSynth();

  var sfx = {
    shoot:     "1,,0.14,,0.25,0.9927,0.6662,-0.2093,,,,,,0.715,-0.5504,,,,1,,,0.2751,,0.5",
    pickup:    "1,,0.0454,,0.4952,0.35,,0.1773,,,,,,,,,,,1,,,,,0.5",
    splode1:   "3,,0.2792,0.2599,0.28,0.0464,,0.26,,,,,,,,,0.4555,-0.055,1,,,,,0.5",
    splode2:   "1,,0.1926,,0.066,0.6888,0.0064,-0.36,,,,,,0.3733,0.0696,,,,1,,,,,0.5",
    shieldHit: "0,,0.13,,0.2599,0.4721,,0.4366,,,,,,0.3465,,0.7747,,,1,,,,,0.5",
    newPickup: "1,,0.143,,0.3098,0.4283,,0.2087,,0.5804,0.45,,,,,,,,1,,,,,0.5",
    pulse:     "0,0.08,0.44,0.0793,0.2657,0.5097,0.2913,-0.1914,0.0154,0.0193,0.0164,-0.0147,0.0216,0.7922,-0.2077,0.0809,-0.1022,0.0799,1,-0.0031,,0.0954,0.075,0.5",
    eggDrop:   "0,,0.0809,,0.2607,0.651,,-0.3547,,,,,,0.568,,0.7,,,1,,,0.0417,,0.5",
    seeker:    "1,0.64,0.12,,0.27,0.79,,0.3032,,,,,,,,0.765,,,1,,,,,0.5",
    levelIn:   "0,0.61,0.51,,0.84,0.37,,0.3523,,,,,,0.2821,,0.2,,,1,,,,,0.5",
    levelOut:  "0,0.61,0.51,,0.84,0.18,,0.3523,,,,,,0.2821,,0.35,,,1,,,,,0.5"
  };

  var play = function () {
    this[++this.current % this.length].play();
  };

  var s;
  try {
    for (s in sfx) {
      var src = synth.getWave(sfx[s]);
      var group = [];
      group.current = 0;
      group.play = play;
      for (var i = 0; i < 3; i++) {
        var player = new Audio();
        player.src = src;
        group[i] = player;
      }
      sfx[s] = group;
    }
  } catch(e) {
    // probably on mobile
    var b = function () {};
    for (s in sfx) {
      sfx[s] = {
        play: b
      };
    }
  }


  /////////////////
  /// Variables ///
  /////////////////

  var PI  = Math.PI,
      TAU = 2*PI, // http://tauday.com/
      gameWidth = 600,
      maxRadius = gameWidth / 2,
      canvas = document.getElementById('c'),
      c = canvas.getContext('2d'),
      segmentCount = 360,
      step = TAU/segmentCount,
      running = true,
      tailSprite = null,
      headSprite = null,
      zz = 0,
      zzTarget = 2,
      lastFrame = timestamp(),
      rotAcc = 0,
      rotVel = 0,
      rot = 0,
      maxRot = 0.04,
      levelTimeout = 0,
      currentLevel,
      pulseCount = 1,
      badGuyCount,
      guy,
      score = 0,
      scoreNode = document.getElementById('s'),
      menuNode  = document.getElementById('u'),
      instructionsNode = document.getElementById('i'),
      gameOverNode = document.getElementById('over'),
      pauseNode = document.getElementById('pause'),
      titleOffset = 0,
      extraGuys = 2,
      GAME_OVER_LENGTH = 6000,
      windowHalfWidth,

      savedLine,
      savedLineCanvas = document.createElement('canvas');

  savedLineCanvas.width  = canvas.width;
  savedLineCanvas.height = canvas.height;

  c.translate(305, 305);
  c.lineWidth = 2;


  ///////////////
  /// Sprites ///
  ///////////////

  var SpritePrototype = {
    collidable: true,
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
      this.alive = true;
      this.link();
    },
    remove: function () {
      this.alive = false;
      this.derezz();
    },
    link: function () {
      this.prevSprite = null;
      this.nextSprite = null;
      if (tailSprite) {
        tailSprite.nextSprite = this;
        this.prevSprite = tailSprite;
      } else {
        headSprite = this;
      }
      tailSprite = this;
    },
    unlink: function () {
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

  var Bada = function (group) {
    this.group = group;
    this.ani = 0;
    this.dist = 0;
    this.scale = 0.1;
    this.collidable = false;
  };
  Bada.prototype = {
    tick: function (delta) {
      this.ani += delta / 100;
      this.ani %= 5;
      var speed = this.group.dir * delta / 10000;

      if (this.scale < 1) {
        this.scale += delta / 3000;
      } else if (this.scale > 1) {
        this.scale = 1;
        this.collidable = true;
      }

      this.angle = clamp(this.angle + speed);

      this.dist = currentLevel.f(this.angle);

      this.segment = segmentForAngle(this.angle);
      this.rot = this.segment.tangent;

      this.updateSpriteCartesian();
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.scale(this.scale, this.scale);
      c.beginPath();
      c.strokeStyle = (this.scale < 1) ? '#2A4580' : '#06276F';
      c.lineWidth = 3/this.scale;
      c.moveTo(-10 + this.ani, 0);
      c.lineTo(0, -8 - this.ani);
      c.lineTo(10 - this.ani, 0);
      c.lineTo(0, 8 + this.ani);
      c.closePath();
      c.stroke();
    },
    collide: function (other) {
      sfx.splode2.play();
      plusScore(other.type === GUY ? 25 : 50);
      this.remove();
      var p = new Particles(5, this);
      p.add();
    },
    derezz: function () {
      if (--this.group.count === 0) {
        badGuyCount--;
        newBadGuy();
      }
    },

    halfWidth: 5,

    type: BADA,

    collidesWith: GOOD_GUYS
  };
  Sprite(Bada);

  var Seeker = function () {
    this.x = Math.floor(gameWidth * Math.random()) - maxRadius;
    this.y = Math.floor(gameWidth * Math.random()) - maxRadius;
    this.scale = 0;
    this.dir = PI/2;
    this.rot = 0;
    this.collidable = false;
    sfx.seeker.play();
  };
  Seeker.prototype = {
    tick: function (delta) {
      if (this.scale < 1) {
        this.scale += delta / 1500;
      } else if (this.scale > 1) {
        this.scale = 1;
        this.collidable = true;
      } else {
        var change = delta / 100;
        var target = Math.atan2(guy.y - this.y, guy.x - this.x);
        var diff = centerClamp(target - this.dir);
        this.dir += (diff < 0) ? -change : change;
        this.dir = clamp(this.dir);
        this.x += Math.cos(this.dir) * delta / 10;
        this.y += Math.sin(this.dir) * delta / 10;
      }
      this.rot -= delta / 100;
      this.rot = clamp(this.rot);
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.scale(this.scale, this.scale);
      c.rotate(this.rot);
      c.globalAlpha = this.scale;
      c.drawImage(Seeker.canvas, -25, -25);
    },
    collide: function (other) {
      sfx.splode2.play();
      plusScore(other.type === GUY ? 250 : 500);
      this.remove();
      var p = new Particles(5, this);
      p.add();
    },
    derezz: function () {
      badGuyCount--;
      newBadGuy();
    },

    halfWidth: 20,

    type: SEEKER,

    collidesWith: GOOD_GUYS
  };
  Sprite(Seeker);

  // create seeker sprite
  (function () {
    Seeker.canvas = document.createElement('canvas');
    Seeker.canvas.width=50;
    Seeker.canvas.height=50;
    var con = Seeker.canvas.getContext('2d');
    con.translate(25,25);
    con.lineWidth = 2;
    con.beginPath();
    con.moveTo(0,0);
    var i = 0;
    while (i<TAU*3) {
      var w = Math.pow(i, 0.5) * 4;
      con.lineTo(Math.cos(i)*w,Math.sin(i)*w);
      i+=step;
    }
    con.strokeStyle='#06276F';
    con.stroke();
  })();


  var Spider = function (size) {
    this.ani   = 0;
    this.dist  = 0;
    this.scale = 0;
    this.dir   = 1;
    this.size  = size || 3;
    this.egg   = false;
    this.collidable = false;
  };
  Spider.range = Math.pow(maxRadius + 100, 2);
  Spider.eggDirections = [-PI/4, -3*PI/4, PI/4, 3*PI/4];
  Spider.prototype = {
    tick: function (delta) {
      if (this.egg) {
        if (this.x * this.x + this.y * this.y > Spider.range &&
            this.x * this.velX + this.y * this.velY >= 0) { // pointing outside
          // turn em around
          this.velX = -this.x / Math.abs(this.x);
          this.velY = -this.y / Math.abs(this.y);
        }
        this.scale = this.size / 3;
        this.x += this.velX * delta;
        this.y += this.velY * delta;
        this.hatchTime -= delta;
        this.angle = Math.atan2(this.y, this.x) - rot;
        this.dist = currentLevel.f(this.angle);
        var d = Math.sqrt(this.x * this.x + this.y * this.y);
        if (this.hatchTime < 0) {
          if (Math.abs(d - this.dist) < this.halfWidth * 2) {
            this.egg = false;
            sfx.eggDrop.play();
          }
        }
        // egg is attracted to the line
        var angle = this.angle;
        if (d > this.dist) {
          angle += PI;
        }
        var change = delta / 500,
            dir = Math.atan2(this.velY, this.velX),
            diff = centerClamp(angle - dir);
        dir += (diff < 0) ? -change : change;
        this.velX = Math.cos(dir) * delta / 50;
        this.velY = Math.sin(dir) * delta / 50;
      }

      // don't use else because egg could be set to false
      // in if clause
      if (!this.egg) {
        this.ani += delta / 200;
        this.ani %= TAU;

        this.angleVel = this.dir / 5;

        var targetScale = 0.2 + 0.8 * this.size / 3;
        if (this.scale < targetScale) {
          this.scale += delta / 1000;
        } else if (this.scale > targetScale) {
          this.scale = targetScale;
          this.collidable = true;
        }

        this.angle = clamp(this.angle + this.angleVel * (delta / 1000));

        this.dist = currentLevel.f(this.angle);

        this.segment = segmentForAngle(this.angle);
        this.rot = this.segment.tangent;

        this.updateSpriteCartesian();
        this.index = segmentIndex(this.angle);
      }
    },
    render: function (c) {
      c.strokeStyle='#06276F';
      c.fillStyle='#06276F';
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.scale(this.scale, this.scale);
      if (!this.egg) {
        this.renderLeg(c,1,1,0);
        this.renderLeg(c,-1,1,PI);
        this.renderLeg(c,1,-1,3*PI/2);
        this.renderLeg(c,-1,-1,PI/2);
      }
      c.beginPath();
      c.arc(0,0,10,0,TAU);
      c.closePath();
      c.fill();
    },
    renderLeg: function (c, side, face, aniOffset) {
      c.save();
      var ani = 10 * Math.sin(this.ani + aniOffset),
      // reach is 20..40
          reach = 30 + ani,
          dist = 0,
          i = this.index;
      // step through the segments to find one
      // close enough to the current reach
      while (dist < reach) {
        i += face;
        i = i % segmentCount;
        if (i < 0) {
          i = segmentCount-1;
        }
        dist += currentLevel.segments[i].length;
      }
      reach = dist;
      // figure out the point at this segment
      var rtheta = i * step,
          rdist = currentLevel.f(rtheta),
          x = Math.cos(rot + rtheta) * rdist,
          y = Math.sin(rot + rtheta) * rdist,
          // calculate the angle between the spider and this
          // new segment
          angle = Math.atan2(y - this.y, x - this.x),
          halfReach = reach/2,
          // outer leg is 30
          knuckle = Math.sqrt(30 * 30 - halfReach * halfReach);

      if (face === -1) {
        angle += PI;
      }

      // rotate the leg by the angle we just calculated
      // taking into account the level rotation and the
      // spider's rotation
      c.rotate(angle - this.rot - rot);

      // draw the leg
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(face * halfReach, knuckle * side);
      c.lineTo(face * reach, 0);
      c.stroke();
      c.restore();
    },
    collide: function (other) {
      sfx.splode2.play();
      // smaller eggs worth more
      var score = this.egg ? 4 - this.size : this.size,
          size = this.size - 1;
      plusScore((other.type === GUY ? 50 : 100) * score);

      this.remove();
      if (!this.egg && size > 0) {
        var tan = this.segment.tangent,
            dirStart = Math.floor(Math.random() * 4),
            s, dir;
        for (var i = 0; i < currentLevel.eggCount; i++) {
          s = new Spider(size);
          dir = tan + Spider.eggDirections[(dirStart + i) % 4];
          s.egg = true;
          s.hatchTime = 500;
          s.x = this.x;
          s.y = this.y;
          s.scale = 1;
          s.velX = Math.cos(dir) / 20;
          s.velY = Math.sin(dir) / 20;
          s.add();
          badGuyCount++;
        }
      } else {
        var p = new Particles(5, this);
        p.add();
      }
    },
    derezz: function () {
      badGuyCount--;
      newBadGuy();
    },

    halfWidth: 10,

    type: SPIDER,

    collidesWith: GOOD_GUYS
  };
  Sprite(Spider);

  var Jelly = function () {
    this.ani = 0;
    this.spawnTimeout = 0;
    this.setPosition();
  };
  Jelly.range = Math.pow(maxRadius + 200, 2);
  Jelly.prototype = {
    setPosition: function () {
      this.rot = Math.random() * TAU;
      this.x = Math.cos(this.rot) * (maxRadius + 200);
      this.y = Math.sin(this.rot) * (maxRadius + 200);
      this.curve = Math.random() < 0.5 ? 1 : -1;
      this.rot = this.rot - PI - this.curve/3;
    },
    tick: function (delta) {
      this.ani += delta / 500;
      this.ani %= TAU;
      this.push = (1 + Math.sin(this.ani*2)) / 2;

      this.rot += this.curve * delta / 12000;

      var pushit = this.push + 0.4;
      this.velX = Math.cos(this.rot) * pushit / 20;
      this.velY = Math.sin(this.rot) * pushit / 20;
      this.x += this.velX * delta;
      this.y += this.velY * delta;

      if (this.spawnTimeout < 0) {
        this.angle = Math.atan2(this.y, this.x) - rot;
        this.dist = currentLevel.f(this.angle);
        var d = Math.sqrt(this.x * this.x + this.y * this.y);
        if (Math.abs(d - this.dist) < 1) {
          this.spawn();
          this.spawnTimeout = 1000;
        }
      } else {
        this.spawnTimeout -= delta;
      }

      if (this.x * this.x + this.y * this.y > Jelly.range &&
          this.x * this.velX + this.y * this.velY >= 0) { // pointing outside
        this.setPosition();
      }
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(this.rot + PI/2);
      for (var i = 0; i < 4; i++) {
        var scale = Math.cos(this.ani + i);
        c.save();
        c.translate(-10 + i*7, 0);
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.strokeStyle = '#06276F';
        c.beginPath();
        c.moveTo(0, 0);
        c.bezierCurveTo(-10*scale, 20, 20*scale, 40, 0, 30 + 20*this.push);
        c.stroke();
        c.restore();
      }
      c.scale(1 - this.push/10, 0.5 + this.push/6);
      c.drawImage(Jelly.body, -20, -40);
    },
    collide: function (other) {
      sfx.splode2.play();
      plusScore(other.type === GUY ? 250 : 500);
      this.remove();
      var p = new Particles(5, this);
      p.add();
    },
    derezz: function () {
      badGuyCount--;
      newBadGuy();
    },
    spawn: function () {
      badGuyCount++;
      var bada = addBada(this.angle, 1),
          p = new Particles(5, bada, true, true, '#06276F');
      p.add();
    },

    halfWidth: 20,

    type: JELLY,

    collidesWith: GOOD_GUYS
  };
  Sprite(Jelly);

  // create jelly sprites
  (function () {
    var body = document.createElement('canvas');
    Jelly.body = body;
    body.width=40;
    body.height=60;
    var con = body.getContext('2d');
    con.fillStyle   = '#06276F';
    con.beginPath();
    con.arc(20, 20, 15, 0, TAU);
    con.fillRect(5, 20, 30, 30);
    con.closePath();
    con.fill();
  })();

  var Guy = function () {
    this.angle = 0;
    this.rot = 0;
    this.x = 0;
    this.y = 0;
    this.flash = 0;
    this.newGuyTimeout = Guy.newGuyTimeoutMax;
    this.collidable = false;
    this.upgrades = {};
    this.hitTimeout = 0;
  };
  Guy.newGuyTimeoutMax = 4000;
  Guy.prototype = {
    tick: function (delta) {
      this.dist = currentLevel.f(this.angle);

      this.angle = rot;

      this.segment = segmentForAngle(this.angle);
      this.rot = this.segment.tangent;

      this.updateSpriteCartesian();

      if (this.flash > 0) {
        this.flash -= delta;
      }

      if (this.newGuyTimeout > 0) {
        this.newGuyTimeout -= delta;
        if (this.newGuyTimeout <= 0) {
          this.collidable = true;
        }
      }

      if (this.hitTimeout > 0) {
        this.hitTimeout -= delta;
        if (this.hitTimeout <= 0) {
          this.collidable = true;
        }
      }

      if (this.newShieldTimeout > 0) {
        this.newShieldTimeout -= delta;
        if (this.newShieldTimeout < 0) {
          this.newShieldTimeout = 0;
        }
      }
    },

    render: function (c) {
      var blink = 1;
      if (!this.collidable) {
        var diff = this.newGuyTimeout / Guy.newGuyTimeoutMax;
        blink = (1 + Math.cos(diff * 80 * Math.sin(diff))) / 2;
      }
      c.globalAlpha = blink;

      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.drawImage(Guy.canvas, -15, -10);

      if (this.upgrades.shield &&
          this.upgrades.shieldStrength > 0) {
        var width = this.upgrades.shieldStrength + 2;
        var scale = 1 + this.newShieldTimeout / 300;
        if (blink < 1) {
          c.globalAlpha = blink;
        } else if (scale > 1) {
          var alpha = 1.5 - scale;
          c.globalAlpha = (alpha < 0) ? 0 : alpha;
        } else {
          c.globalAlpha = this.upgrades.shieldStrength / 3;
        }
        c.save();
        c.scale(scale, scale);
        c.beginPath();
        c.arc(0, 0, 20, 0, TAU);
        c.lineWidth = width;
        c.strokeStyle='#A66E00';
        c.stroke();
        c.lineWidth = 1;
        c.strokeStyle='#FFBE40';
        c.stroke();
        if (this.flash > 0 || scale > 1) {
          c.lineWidth = width;
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = this.flash / 800;
          c.stroke();
        }
        c.restore();
      } else if (this.flash > 0) {
        if (scale > 1) {
          foo = 0;
        }
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = this.flash / 800;
        c.drawImage(Guy.canvas, -15, -10);
      }
    },

    collide: function (other) {
      var p;
      if (other.type & BAD_GUYS) {
        if (this.upgrades.shieldStrength > 0) {
          sfx.shieldHit.play();
          this.upgrades.shieldStrength--;
          if (this.upgrades.shieldStrength > 0) {
            this.flash = 800;
          } else {
            p = new Particles(5, this);
            p.add();
          }
          this.hitTimeout = 300;
          this.collidable = false;
        } else {
          sfx.splode1.play();
          this.flash = 800;
          p = new Particles(10, this);
          p.add();
          this.remove();
        }
      }
    },

    fire: function () {
      if (Bolt.freeBolts.length) {
        sfx.shoot.play();
      }
      if (this.upgrades.doubleGuns) {
        guy.fireLaser(UP,   LEFT);
        guy.fireLaser(UP,   RIGHT);
        guy.fireLaser(DOWN, LEFT);
        guy.fireLaser(DOWN, RIGHT);
      } else {
        guy.fireLaser(UP);
        guy.fireLaser(DOWN);
      }
    },

    fireLaser: function (direction, side) {
      if (Bolt.freeBolts.length) {
        var bolt = Bolt.freeBolts.pop(),
            angle = this.rot + rot;
        bolt.x = this.x;
        bolt.y = this.y;
        if (direction === UP) {
          angle -= PI/2;
        } else {
          angle -= 3*PI/2;
        }
        if (side === LEFT) {
          bolt.x += Math.sin(angle) * 10;
          bolt.y -= Math.cos(angle) * 10;
        } else if (side === RIGHT) {
          bolt.x -= Math.sin(angle) * 10;
          bolt.y += Math.cos(angle) * 10;
        }
        bolt.rot = this.rot + rot;
        bolt.velX = Math.cos(angle) * 3;
        bolt.velY = Math.sin(angle) * 3;
        bolt.add();
      }
    },
    shield: function () {
      this.upgrades.shield = true;
      this.upgrades.shieldStrength = 3;
      this.newShieldTimeout = 200;
    },
    doubleGuns: function () {
      this.upgrades.doubleGuns = true;
    },

    halfWidth: 10,

    type: GUY,

    collidesWith: BAD_GUYS
  };
  Sprite(Guy);

  // create guy sprite
  (function () {
    var path = [-15, 0, -10, -8, -5, -8, -2, -10, -2, -8, 2, -8, 2, -10, 5, -8, 10, -8, 15, 0, 10, 8, 5, 8, 2, 10, 2, 8, -2, 8, -2, 10, -5, 8, -10, 8, -15, 0];
    var can = document.createElement('canvas');
    can.width=30;
    can.height=20;
    Guy.canvas = can;
    var con = Guy.canvas.getContext('2d');
    con.translate(15,10);
    con.beginPath();
    con.moveTo(path[0], path[1]);
    for (var i = 1; i < path.length; i++) {
      con.lineTo(path[2*i], path[2*i+1]);
    }
    con.closePath();
    con.fillStyle='#A66E00';
    con.fill();
    con.strokeStyle='#FFA900';
    con.stroke();
    con.fillStyle='#FFCF73';
    con.fillRect(-10, -7, 20, 14);
    con.fillStyle='#FFBE40';
    con.fillRect(-10, -5, 20, 10);
    con.fillStyle='#FFCF73';
    con.fillRect(-10, -3, 20, 6);
  })();

  var Bolt = function () {
    this.rot = 0;
  };
  Bolt.size = 160;
  Bolt.BOLT_FIRE_TIMEOUT = 150;
  Bolt.currentBoltFireTimeout = 0;
  Bolt.freeBolts = [];

  Bolt.prototype = {
    tick: function (delta) {
      this.x += this.velX * delta;
      this.y += this.velY * delta;
      if (this.outside()) {
        this.remove();
      }
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(this.rot);
      c.drawImage(Bolt.canvas, -5, -Bolt.size/2);
    },
    derezz: function () {
      Bolt.freeBolts.push(this);
    },
    collide: function (other) {
      this.remove();
    },

    halfWidth: 20,

    type: BOLT,

    collidesWith: BAD_GUYS
  };
  Sprite(Bolt);

  // create bolt sprite
  (function () {
    Bolt.canvas = document.createElement('canvas');
    Bolt.canvas.width=10;
    Bolt.canvas.height=Bolt.size;
    var con = Bolt.canvas.getContext('2d');
    con.lineWidth = 2;
    con.lineCap = 'round';
    con.beginPath();
    con.moveTo(5, 5);
    con.lineTo(5, Bolt.size-5);
    con.closePath();
    con.shadowBlur='10';
    con.shadowColor='#FFCF73';
    con.strokeStyle='#6C8DD5';
    con.stroke();
  })();

  for (var i = 0; i < 6; i++) {
    Bolt.freeBolts.push(new Bolt());
  }


  var Pulse = function (start, dir) {
    this.angle = start;
    this.dir   = dir;
    this.life  = Pulse.MAX_LIFE;
  };
  Pulse.MAX_LIFE = 1000;
  Pulse.prototype = {
    tick: function (delta) {
      this.life -= delta;
      if (this.life <= 0) {
        this.remove();
      }

      var percent = this.life / Pulse.MAX_LIFE;
      this.angleVel = this.dir * 6 * (1 - percent);
      this.angle = clamp(this.angle + this.angleVel * delta/1000);
      this.dist = currentLevel.f(this.angle);
      this.segment = segmentForAngle(this.angle);
      this.updateSpriteCartesian();
    },
    render: function (c) {
      c.translate(this.x, this.y);
      c.drawImage(Pulse.canvas, -40, -40);
    },
    derezz: function () {
      var p = new Particles(3, this);
      p.add();
    },

    halfWidth: 5,

    type: PULSE,

    collidesWidth: BAD_GUYS
  };
  Sprite(Pulse);

  // create Pulse sprite
  (function () {
    var can = document.createElement('canvas');
    Pulse.canvas = can;
    can.width  = 80;
    can.height = 80;
    var con = can.getContext('2d');
    con.beginPath();
    con.fillStyle   = '#FFBE40';
    con.shadowColor = '#FFCF73';
    con.shadowBlur  = '30';
    con.arc(40, 40, 10, 0, TAU);
    con.closePath();
    con.fill();
  })();

  var Particles = function (count, origin, reverse, follow, color, callback) {
    this.x = origin.x;
    this.y = origin.y;
    this.origin = origin;
    this.life = 0;
    this.reverse = reverse;
    this.follow = follow;
    this.color = color || "#FFCF73";
    this.callback = callback;
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
        if (this.callback) {
          this.callback();
        }
      }
      if (this.follow) {
        this.x = this.origin.x;
        this.y = this.origin.y;
      }
    },
    render: function (c) {
      var scale = (this.reverse) ? (500 - this.life)/8 : this.life/8,
          count = this.particleDirections.length;
      c.translate(this.x, this.y);
      c.fillStyle = this.color;
      for (var i = 0; i < count; i+=2) {
        var particleX = this.particleDirections[i];
        var particleY = this.particleDirections[i+1];
        c.fillRect(particleX * scale, particleY * scale, 2, 2);
      }
    }
  };
  Sprite(Particles);

  var Pickup = function () {
    this.angle   = Math.floor(Math.random() * TAU);
    this.segment = segmentForAngle(this.angle);
    this.life    = Pickup.maxLife;
    this.flavor  = Math.random() < 0.5 ? 'shield' : 'doubleGuns';
    sfx.newPickup.play();
  };
  Pickup.maxLife = 12000;
  Pickup.prototype = {
    tick: function (delta) {
      this.dist = currentLevel.f(this.angle);
      this.updateSpriteCartesian();
      this.life -= delta;
      if (this.life < 0) {
        this.remove();
      } else if (guy.alive && this.distance(guy) < this.halfWidth + guy.halfWidth) {
        this.collide();
      }
    },
    render: function (c) {
      c.translate(this.x, this.y);
      var percent = this.life / Pickup.maxLife;
      var scale = (3 + Math.sin(TAU * percent * 10)) / 2;
      if (percent < 0.25) {
        c.globalAlpha = (1 + Math.cos(TAU * percent * 30)) / 2;
      }
      c.scale(scale, scale);
      c.drawImage(Pickup[this.flavor], -40, -40);
    },
    collide: function (other) {
      sfx.pickup.play();
      this.remove();
      guy[this.flavor]();
    },
    derezz: function () {
      badGuyCount--;
    },

    halfWidth: 5
  };
  Sprite(Pickup);

  // create Pickup sprite
  (function () {
    function renderGlow(con) {
      con.beginPath();
      con.fillStyle   = '#FFBE40';
      con.shadowColor = '#FFCF73';
      con.shadowBlur  = '30';
      con.arc(40, 40, 10, 0, TAU);
      con.fill();
    }

    can = document.createElement('canvas');
    Pickup.doubleGuns = can;
    can.width  = 80;
    can.height = 80;
    con = can.getContext('2d');
    renderGlow(con);
    con.scale(0.6, 0.4);
    con.drawImage(Bolt.canvas, 56.5, 80, 10, 40);
    con.drawImage(Bolt.canvas, 66.5, 80, 10, 40);

    document.getElementById('doub').appendChild(can);

    can = document.createElement('canvas');
    Pickup.shield = can;
    can.width  = 80;
    can.height = 80;
    con = can.getContext('2d');
    renderGlow(con);
    con.beginPath();
    con.arc(40, 40, 6, 0, TAU);
    con.shadowBlur='10';
    con.shadowColor='#06276F';
    con.strokeStyle='#06276F';
    con.stroke();

    document.getElementById('shield').appendChild(can);
  })();


  ////////////////////////
  //// Input Handling ////
  ////////////////////////

  var KEY_CODES = {
    13: 'enter',
    32: 'space',
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down',
    88: 'x'
  };

  var KEYS = {};

  var keyDown = false;

  window.addEventListener('keydown', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = true;
    keyDown = true;
    if (e.keyCode === 80 || e.keyCode === 27) { // P or Esc
      pause();
    }
  }, false);
  window.addEventListener('keyup', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = false;
    keyDown = false;
  }, false);

  function handleOrientationChange(e) {
    windowHalfWidth = window.innerWidth / 2;
    window.scrollTo(0,1);
  }
  handleOrientationChange();

  function handleTouch(e) {
    e.preventDefault();
    if (e.type !== 'touchend') {
      KEYS.left  = false;
      KEYS.right = false;
      KEYS.x     = false;
      KEYS.space = false;
    }
    var touches = e.type === 'touchend' ? e.changedTouches : e.touches;
    for (var i = 0; i < touches.length; i++) {
      var status = e.type !== 'touchend';
      if (touches[i].pageX < windowHalfWidth) {
        KEYS.left = status;
      } else {
        KEYS.right = status;
      }
      KEYS.x = status;
      if (e.type === 'touchstart' &&
          touches[i].pageY < 100) {
        KEYS.space = true;
      }
    }
    // stop if both at the same time
    if (KEYS.left && KEYS.right) {
      KEYS.left = false;
      KEYS.right = false;
    }
    keyDown = KEYS.x;
  }

  window.addEventListener('touchstart', handleTouch);
  window.addEventListener('touchmove',  handleTouch);
  window.addEventListener('touchend',   handleTouch);

  window.addEventListener('orientationchange', handleOrientationChange);

  document.getElementById('start').addEventListener('click', function (e) {
    // start game
    currentState = states.begin;
  });



  function checkBoltCollision(bolt, sprite) {
    var normX = -bolt.velY,
        normY = bolt.velX,
        boltNormProj = bolt.x * normX + bolt.y * normY,
        spriteNormProj = sprite.x * normX + sprite.y * normY,
        dirX = sprite.x - bolt.x,
        dirY = sprite.y - bolt.y,
        boltProj = dirX * bolt.velX + dirY * bolt.velY;
    return Math.abs(boltNormProj - spriteNormProj) < bolt.halfWidth + sprite.halfWidth &&
           Math.abs(boltProj) < Bolt.size;
  }

  function checkCollisions(canidate, delta) {
    if (!canidate.alive) {
      return;
    }
    var sprite = headSprite;
    while (sprite) {
      // Compare this sprite's type against
      // the canidate's bitmask.
      // If it's non-zero the sprites can interact
      if (sprite.type & canidate.collidesWith &&
          sprite.collidable && canidate.collidable &&
          sprite.alive && canidate.alive) {

        var collision = false;
        if (sprite.type === BOLT) {
          collision = checkBoltCollision(sprite, canidate);
        } else if (canidate.type === BOLT) {
          collision = checkBoltCollision(canidate, sprite);
        } else {
          collision = (sprite.distance(canidate) < sprite.halfWidth + canidate.halfWidth);
        }
        if (collision) {
          sprite.collide(canidate);
          canidate.collide(sprite);
          if (!canidate.alive) {
            return;
          }
        }
      }
      sprite = sprite.nextSprite;
    }
  }

  function pause() {
    if (currentState !== states.waitToBegin) {
      running = !running;
      if (running) {
        loop();
      }
      pauseNode.style.display = running ? 'none' : 'block';
    }
  }

  function integrateLine() {
    var index = segmentIndex(rot),
        segmentLength = (currentLevel.segments) ? currentLevel.segments[index].length : 1,
        currentMaxVel = 4 * maxRot/segmentLength;
    rotVel += rotAcc;
    if (Math.abs(rotVel) > currentMaxVel) {
      rotVel = currentMaxVel * Math.abs(rotVel)/rotVel;
    }

    rot += rotVel;
    rot = clamp(rot);
    rotAcc = 0;
    rotVel *= 0.99;
  }

  function precalculateLineSegments(level) {
    if (level.segments) {
      return; // already calculated
    }
    var segments = [],
        f = level.f,
        z = zzTarget,
        length,
        position = 0,
        i=0,
        w = f(0,z),
        x1 = Math.cos(0)*w,
        y1 = Math.sin(0)*w,
        angle=step,
        x2, y2, x, y;
    while (angle <= TAU) {
      w = f(angle,z);
      x2 = Math.cos(angle)*w;
      y2 = Math.sin(angle)*w;
      x = x2 - x1;
      y = y2 - y1;
      length = Math.sqrt(x*x + y*y);
      segments[i] = {
        length:   length,
        position: position,
        tangent:  Math.atan2(y, x)
      };
      position += length;
      x1 = x2;
      y1 = y2;
      i++;
      angle+=step;
    }
    level.totalLength = position;
    level.segments = segments;
  }

  function renderLineToContext(c,f,z,rot) {
    c.save();
    // scale it up
    var percent = zz/zzTarget;
    c.scale(percent, percent);
    c.lineWidth = 3/percent;

    c.rotate(rot);
    var i=0;
    c.beginPath();
    c.moveTo(f(0,z),0);
    while (i<TAU) {
      var w = f(i,z);
      c.lineTo(Math.cos(i)*w,Math.sin(i)*w);
      i+=step;
    }
    c.strokeStyle='#FFBE40';
    c.shadowColor='#FFCF73';
    c.shadowBlur='30';
    c.stroke();
    c.restore();
  }

  function renderLine(f,z,rot) {
    if (zz === zzTarget) {
      if (!savedLine) {
        savedLine = savedLineCanvas.getContext('2d');
        savedLine.clearRect(0, 0, 610, 610);
        savedLine.save();
        savedLine.translate(305, 305);
        renderLineToContext(savedLine,f,z,0);
        savedLine.restore();
      }
      c.save();
      c.rotate(rot);
      c.drawImage(savedLineCanvas, -305, -305);
      c.restore();
    } else {
      savedLine = null;
      renderLineToContext(c,f,z,rot);
    }
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

  function segmentForAngle(theta) {
    var i = segmentIndex(theta);
    return currentLevel.segments[i];
  }

  function segmentIndex(theta) {
    return Math.floor(segmentCount * clamp(theta) / TAU);
  }

  function addBada(position, length) {
    var bada;
    var group = {
      dir: (Math.random() > 0.5) ? 1 : -1,
      count: length
    };
    for (var i = 0; i < length; i++) {
      bada = new Bada(group);
      bada.angle = position + i/20;
      bada.ani = i;
      bada.add();
    }
    return bada;
  }

  function findAFreeSpot() {
    var bucketCount = 20,
        bucketLength = Math.round(currentLevel.totalLength / bucketCount),
        buckets = [],
        sprite = headSprite;
    while (sprite) {
      if (sprite.angle !== undefined) {
        var pos = currentLevel.segments[segmentIndex(sprite.angle)].position;
        buckets[Math.floor(pos/bucketLength)] = true;
      }
      sprite = sprite.nextSprite;
    }
    // start random
    var bucket = Math.floor(Math.random() * bucketCount);
    // traverse over the buckets
    var tries = 0;
    while (buckets[bucket] && tries < bucketCount) {
      bucket = (bucket + 7) % bucketCount;
      tries++;
    }
    if (tries > bucketCount) {
      // no free spot
      return false;
    }
    // find the angle this bucket belongs to
    var i = 0;
    // add a half bucket to get us centered
    var position = (bucket + 0.5) * bucketLength;
    while (position > 0) {
      position -= currentLevel.segments[i].length;
      i++;
    }
    return TAU * i / segmentCount;
  }


  //////////////
  /// Titles ///
  //////////////

  var Titles = {
    renderTitle: function (delta) {
      var done = false;
      if (titleOffset < -60) {
        var cos = Math.cos(-(titleOffset + 60) * PI/120);
        // cut it off
        if (cos > 0.01) {
          titleOffset -= cos * delta / 10;
          menuNode.style.opacity = 1-cos;
          menuNode.style.bottom = (1-cos) * 60;
        } else {
          done = true;
        }
      } else {
        titleOffset -= delta / 10;
      }

      c.save();
      c.translate(10, titleOffset);
      c.strokeStyle='#FFA900';
      c.shadowOffsetX=4;
      c.shadowOffsetY=2;
      c.shadowColor='#BF8F30';
      c.lineJoin = "round";
      c.translate(-140, -100);
      c.scale(2,2);
      // S
      c.beginPath();
      c.moveTo(24, 0);
      c.bezierCurveTo(-40, 0, 70, 100, 0, 100);
      c.stroke();
      // P
      c.translate(34, 0);
      c.beginPath();
      c.moveTo(0, 100);
      c.lineTo(0, 0);
      c.bezierCurveTo(30, 0, 30, 50, 0, 50);
      c.stroke();
      // I
      c.translate(32, 0);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, 100);
      c.stroke();
      // R
      c.translate(12, 0);
      c.beginPath();
      c.moveTo(0, 100);
      c.lineTo(0, 0);
      c.bezierCurveTo(30, 0, 30, 50, 0, 50);
      c.lineTo(20, 100);
      c.stroke();
      // O
      c.translate(30, 0);
      c.beginPath();
      c.moveTo(10, 0);
      c.bezierCurveTo(-4, 0, -4, 100, 10, 100);
      c.bezierCurveTo(24, 100, 24, 0, 10, 0);
      c.stroke();
   
      c.restore();

      return done;
    },
    renderInstructions: function (delta) {
      var children = instructionsNode.children;
      var o = 0;
      for (var i = 0; i < children.length; i++) {
        var n = children[i];
        var nOpacity = parseFloat(n.style.opacity, 10) || 0;
        o += nOpacity;
        if (o < (i+1)) {
          n.style.opacity = nOpacity + delta / 1000;
          return false;
        }
      }
      return true;
    }
  };


  function handleControls(elapsed) {
    if (KEYS.left) {
      rotAcc = -elapsed / 10000;
    }
    if (KEYS.right) {
      rotAcc = elapsed / 10000;
    }
    if (KEYS.space) {
      if (pulseCount-- > 0) {
        sfx.pulse.play();
        (new Pulse(guy.angle, 1)).add();
        (new Pulse(guy.angle, -1)).add();
      }
    }
    if (KEYS.x) {
      Bolt.currentBoltFireTimeout -= elapsed;
      if (Bolt.currentBoltFireTimeout < 0) {
        Bolt.currentBoltFireTimeout = Bolt.BOLT_FIRE_TIMEOUT;
        guy.fire();
      }
    }
  }

  function runSprites(elapsed) {
    var sprite = headSprite;
    while (sprite) {
      if (sprite.alive) {
        // tick with 0 until the game really starts
        sprite.tick((zz === zzTarget) ? elapsed : 0);

        c.save();
        sprite.render(c);
        c.restore();

        checkCollisions(sprite, elapsed);
      }

      sprite = sprite.nextSprite;
    }

    // cull removed sprites
    sprite = headSprite;
    while (sprite) {
      if (!sprite.alive) {
        sprite.unlink();
      }
      sprite = sprite.nextSprite;
    }
  }

  function newBadGuy() {
    if (currentLevel.nextBaddie < currentLevel.baddies.length) {
      var baddieClass = currentLevel.baddies[currentLevel.nextBaddie];
      var rotation = findAFreeSpot();
      if (rotation === false) {
        return;
      }
      if (baddieClass === Bada) {
        addBada(rotation, currentLevel.badaSize);
      } else {
        var baddie = new baddieClass();
        baddie.add();
        baddie.angle = rotation;
      }

      currentLevel.nextBaddie++;
      badGuyCount++;
    }
  }

  function startNewLevel(levelNumber) {
    sfx.levelIn.play();
    // remove existing sprites
    var sprite = tailSprite;
    while (sprite) {
      sprite.unlink();
      sprite = tailSprite;
    }

    var upgrades = guy && guy.upgrades;
    // create new guy
    guy = new Guy();
    if (upgrades) {
      guy.upgrades = upgrades;
    }
    guy.add();

    // queue up next level
    currentLevelNumber = (levelNumber === undefined) ? currentLevelNumber + 1 : levelNumber;
    currentLevel = levels[currentLevelNumber];
    currentLevel.nextBaddie = 0;
    badGuyCount = 0;

    // calculate with the correct zz
    zz = zzTarget;
    precalculateLineSegments(currentLevel);

    // add first bad guys
    for (var i = 0; i < currentLevel.spawnStart; i++) {
      newBadGuy();
    }

    // clear zz for start up
    zz = 0;
  }

  function plusScore(val) {
    score += val;
    scoreNode.innerHTML = score;
  }
  function showScore() {
    scoreNode.innerHTML = score;
    scoreNode.style.display = 'block';
  }

  function renderCanvasHudElements() {
    if (extraGuys > 0) {
      renderExtraGuys();
    }
    if (pulseCount > 0) {
      renderPulse();
    }
  }

  function renderExtraGuys() {
    c.save();
    c.translate(maxRadius, maxRadius - 30);
    c.rotate(PI/2);
    for (var i = 0; i < extraGuys; i++) {
      c.drawImage(Guy.canvas, 0, 0);
      c.translate(0, guy.halfWidth * 3);
    }
    c.restore();
  }

  function renderPulse() {
    c.save();
    c.translate(-20 - maxRadius , maxRadius - 60);
    c.drawImage(Pulse.canvas, 0, 0);
    c.drawImage(Pulse.canvas, 10, 0);
    c.restore();
  }

  function renderGameOver(delta) {
    var opacity = GAME_OVER_LENGTH - levelTimeout;
    if (opacity > 1000) {
      opacity = 1000;
    }
    gameOverNode.style.opacity = opacity / 1000;
  }


  //////////////
  /// Levels ///
  //////////////

  var levels = [
    {
      f: function (t) {
        // four curve
        return maxRadius * Math.cos(Math.sin(t * zz)) - 20;
      },
      spawnStart: 3,
      badaSize: 2,
      eggCount: 1,
      baddies: [Spider, Bada, Bada, Pickup, Bada, Bada]
    },

    {
      f: function (t) {
        // eight curve
        return maxRadius * Math.cos(Math.sin(2 * t * zz)) - 20;
      },
      spawnStart: 3,
      badaSize: 3,
      eggCount: 1,
      baddies: [Jelly, Spider, Bada, Pickup, Bada, Bada]
    },

    {
      f: function (t) {
        // four leaf clover
        return Math.sin(t * zz) * maxRadius;
      },
      spawnStart: 3,
      badaSize: 3,
      eggCount: 1,
      baddies: [Jelly, Spider, Bada, Pickup, Bada, Bada]
    },

    {
      f: function (t) {
        // inner loop
        return (zz * maxRadius / 3.4*(1 + Math.sin(t))) - 100;
      },
      spawnStart: 2,
      badaSize: 3,
      eggCount: 1,
      baddies: [Seeker, Spider, Spider, Bada, Pickup, Bada, Bada]
    },
 
    {
      f: function (t) {
        // knot with warp
        return (Math.cos(t / zz) - Math.sin(t)) * maxRadius;
      },
      spawnStart: 6,
      badaSize: 3,
      eggCount: 1,
      baddies: [Jelly, Jelly, Jelly, Jelly, Jelly, Jelly, Pickup, Jelly, Jelly, Jelly, Jelly]
    },

    {
      f: function (t) {
        // heart
        return (zz * maxRadius / 4.2*(1 + Math.cos(t)));
      },
      spawnStart: 3,
      badaSize: 3,
      eggCount: 2,
      baddies: [Jelly, Spider, Bada, Bada, Pickup, Bada, Bada, Seeker]
    },

    {
      f: function (t) {
        // three leaf overlapped clover
        return maxRadius * Math.sin(t + t * zz);
      },
      spawnStart: 3,
      badaSize: 2,
      eggCount: 2,
      baddies: [Seeker, Seeker, Seeker, Seeker, Seeker, Seeker, Seeker, Seeker]
    },

    {
      f: function (t) {
        // eight leaf clover
        return Math.sin(2*t + t * zz) * maxRadius;
      },
      spawnStart: 3,
      badaSize: 4,
      eggCount: 2,
      baddies: [Jelly, Spider, Bada, Bada, Bada, Pickup, Bada]
    },

    {
      f: function (t) {
        // eight leaf with fat and small leaves
        return maxRadius * Math.cos(3*Math.sin(t * zz));
      },
      spawnStart: 3,
      badaSize: 3,
      eggCount: 2,
      baddies: [Jelly, Spider, Bada, Bada, Pickup, Bada, Bada]
    },

    {
      f: function (t) {
        // offset circle
        return maxRadius * Math.cos(Math.sin(t / zz)) - 20;
      },
      spawnStart: 4,
      badaSize: 4,
      eggCount: 2,
      baddies: [Jelly, Spider, Bada, Pickup, Bada, Bada, Bada, Seeker, Bada, Seeker]
    },

    {
      f: function (t) {
        // eight leaf with smaller inset petals
        return maxRadius * Math.cos(2*Math.sin(t * zz));
      },
      spawnStart: 4,
      badaSize: 3,
      eggCount: 2,
      baddies: [Jelly, Jelly, Spider, Bada, Bada, Pickup, Bada, Bada, Seeker, Seeker]
    }

  ];

  //////////////
  /// States ///
  //////////////

  var states = {
    waitToBegin: function (elapsed) {
      menuNode.style.display = 'block';
      instructionsNode.style.display = 'block';

      Titles.renderTitle(elapsed) &&
      Titles.renderInstructions(elapsed);
      
      if (KEYS.space || KEYS.x || KEYS.enter) {
        currentState = states.begin;
      }
    },
    begin: function () {
      score = 0;
      extraGuys = 2;
      menuNode.style.display = 'none';
      instructionsNode.style.display = 'none';
      zz = 0;
      guy = null;
      showScore();
      startNewLevel(0);
      currentState = states.startLevel;
    },
    startLevel: function (elapsed) {
      if (zz < zzTarget) {
        zz += elapsed / 800;
      } else {
        zz = zzTarget;
        pulseCount = 1;
        currentState = states.runLevel;
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      renderCanvasHudElements();
    },
    runLevel: function (elapsed) {
      if (badGuyCount === 0 && currentLevelNumber+1 < levels.length) {
        levelTimeout = 1500;
        currentState = states.runOutLevel;
      }
      if (!guy.alive) {
        currentState = states.guyDie;
      }
      handleControls(elapsed);
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      runSprites(elapsed);
      renderCanvasHudElements();
    },
    runOutLevel: function (elapsed) {
      if (levelTimeout > 0) {
        levelTimeout -= elapsed;
        handleControls(elapsed);
        integrateLine();
        renderLine(currentLevel.f,zz,rot);
        runSprites(elapsed);
        renderCanvasHudElements();
      } else {
        currentState = states.finishLevel;
        sfx.levelOut.play();
      }
    },
    finishLevel: function (elapsed) {
      if (zz < zzTarget*2) {
        zz += elapsed / 800;
      } else {
        startNewLevel();
        currentState = states.startLevel;
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      renderCanvasHudElements();
    },
    guyDie: function (elapsed) {
      if (extraGuys > 0) {
        levelTimeout = 3000;
        currentState = states.waitToRestart;
      } else {
        levelTimeout = GAME_OVER_LENGTH;
        gameOverNode.style.opacity = 0;
        gameOverNode.style.display = 'block';
        currentState = states.gameOver;
      }
    },
    waitToRestart: function (elapsed) {
      if (levelTimeout > 0) {
        levelTimeout -= elapsed;
      } else {
        extraGuys--;
        // create new guy
        guy = new Guy();
        guy.tick(elapsed);
        guy.add();
        currentState = states.runLevel;
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      runSprites(elapsed);
      renderCanvasHudElements();
    },
    gameOver: function (elapsed) {
      if (levelTimeout > 0) {
        levelTimeout -= elapsed;
      } else {
        gameOverNode.style.display = 'none';
        currentState = states.waitToBegin;
      }
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      runSprites(elapsed);
      renderGameOver(elapsed);
    }
  };
  var currentState = states.waitToBegin;


  /////////////////
  /// Main Loop ///
  /////////////////

  function loop() {
    var thisFrame = timestamp(),
        elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;

    if (elapsed > 100) {
      elapsed = 100; // cap it at 10 FPS
    }

    c.clearRect(-305, -305, 610, 610);

    currentState(elapsed);

    if (running) {
      requestAnimFrame(loop, canvas);
    }
  }
  loop();

})();
