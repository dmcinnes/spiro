(function () {

  var GUY    = 1;
  var BOLT = 2;
  var PULSE  = 4;
  var BADA   = 8;
  var SEEKER = 16;
  var SPIDER = 32;

  var GOOD_GUYS = GUY + BOLT + PULSE;
  var BAD_GUYS  = BADA + SEEKER + SPIDER;

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
  var segmentCount = 360;
  var step = TAU/segmentCount;
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
  var levelTimeout = 0;
  var currentLevel;
  var pulseCount = 1;
  var badGuyCount;
  var guy;
  var framerate = false;
  var score = 0;
  var scoreNode = document.getElementById('s');
  var menuNode  = document.getElementById('u');
  var titleOffset = 0;

  var savedLine;
  var savedLineCanvas = document.createElement('canvas');
  savedLineCanvas.width  = canvas.width;
  savedLineCanvas.height = canvas.height;

  c.translate(305, 305);
  c.lineWidth = 2;

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

  /////////////////
  //// SPRITES ////
  /////////////////

  var Bada = function (group) {
    this.group = group;
    this.ani = 0;
    this.dist = 0;
    this.scale = 0.1;
  };
  Bada.prototype = {
    tick: function (delta) {
      this.ani += delta / 100;
      this.ani %= 5;
      var speed = this.group.dir * delta / 10000;

      if (this.scale < 1) {
        this.scale += delta / 1000;
      } else if (this.scale > 1) {
        this.scale = 1;
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
      c.strokeStyle='#06276F';
      c.shadowBlur = 4;
      c.shadowColor='#2A4580';
      c.lineWidth = 3/this.scale;
      c.moveTo(-10 + this.ani, 0);
      c.lineTo(0, -8 - this.ani);
      c.lineTo(10 - this.ani, 0);
      c.lineTo(0, 8 + this.ani);
      c.closePath();
      c.stroke();
    },
    collide: function (other) {
      plusScore(other.type === GUY ? 25 : 50);
      this.remove();
      var p = new Particles(5);
      p.x = this.x;
      p.y = this.y;
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
    this.x = 0;
    this.y = 0;
    this.scale = 0;
    this.dir = PI/2;
    this.rot = 0;
  };
  Seeker.prototype = {
    tick: function (delta) {
      if (this.scale < 1) {
        this.scale += delta / 1000;
      } else if (this.scale > 1) {
        this.scale = 1;
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
      c.scale(this.scale,this.scale);
      c.rotate(this.rot);
      c.drawImage(Seeker.canvas, -25, -25);
    },
    collide: function (other) {
      plusScore(other.type === GUY ? 250 : 500);
      this.remove();
      var p = new Particles(5);
      p.x = this.x;
      p.y = this.y;
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
    con.shadowBlur = 5;
    con.shadowColor='#2A4580';
    con.stroke();
  })();


  var Spider = function (size) {
    this.ani   = 0;
    this.dist  = 0;
    this.scale = 0;
    this.dir   = 1;
    this.size  = size || 3;
    this.egg   = false;
  };
  Spider.prototype = {
    tick: function (delta) {
      if (this.egg) {
        this.scale = this.size / 3;
        this.x += this.velX * delta;
        this.y += this.velY * delta;
        if (this.outside()) {
          this.remove();
        }
        this.hatchTime -= delta;
        this.angle = Math.atan2(this.y, this.x) - rot;
        this.dist = currentLevel.f(this.angle);
        var d = Math.sqrt(this.x * this.x + this.y * this.y);
        if (this.hatchTime < 0) {
          if (Math.abs(d - this.dist) < this.halfWidth * 2) {
            this.egg = false;
          }
        }
        // egg is attracted to the line
        var angle = this.angle;
        if (d > this.dist) {
          angle += PI;
        }
        var change = delta / 500;
        var dir = Math.atan2(this.velY, this.velX);
        var diff = centerClamp(angle - dir);
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
      c.shadowColor='#2A4580';
      c.shadowBlur = 4;
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
      var ani = 10 * Math.sin(this.ani + aniOffset);
      // reach is 20..40
      var reach = 30 + ani;
      var dist = 0;
      var i = this.index;
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
      var rtheta = i * step;
      var rdist = currentLevel.f(rtheta);
      var x = Math.cos(rot + rtheta) * rdist;
      var y = Math.sin(rot + rtheta) * rdist;
      // calculate the angle between the spider and this
      // new segment
      var angle = Math.atan2(y - this.y, x - this.x);
      if (face === -1) {
        angle += PI;
      }

      var halfReach = reach/2;
      // outer leg is 30
      var knuckle = Math.sqrt(30 * 30 - halfReach * halfReach);

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
    eggDirections: [-PI/4, -3*PI/4, PI/4, 3*PI/4],
    collide: function (other) {
      // smaller eggs worth more
      var score = this.egg ? 4 - this.size : this.size;
      plusScore((other.type === GUY ? 50 : 100) * score);

      this.remove();
      var size = this.size - 1;
      if (!this.egg && size > 0) {
        var tan = this.segment.tangent;
        var dirStart = Math.floor(Math.random() * 4);
        for (var i = 0; i < 3; i++) {
          var s = new Spider(size);
          var dir = tan + this.eggDirections[(dirStart + i) % 4];
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
        var p = new Particles(5);
        p.x = this.x;
        p.y = this.y;
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


  var Guy = function () {
    this.angle = 0;
    this.rot = 0;
    this.x = 0;
    this.y = 0;
  };
  Guy.prototype = {
    tick: function (delta) {
      this.dist = currentLevel.f(this.angle);

      this.angle = rot;

      this.segment = segmentForAngle(this.angle);
      this.rot = this.segment.tangent;

      this.updateSpriteCartesian();
    },

    render: function (c) {
      c.translate(this.x, this.y);
      c.rotate(rot + this.rot);
      c.drawImage(Guy.canvas, -15, -10);
    },

    collide: function (other) {
      // var p = new Particles(10);
      // p.x = this.x;
      // p.y = this.y;
      // p.add();
      // this.remove();
    },

    halfWidth: 10,

    type: GUY,

    collidesWith: BAD_GUYS
  };
  Sprite(Guy);

  // create guy sprite
  (function () {
    var path = [-15, 0, -10, -8, -5, -8, -2, -10, -2, -8, 2, -8, 2, -10, 5, -8, 10, -8, 15, 0, 10, 8, 5, 8, 2, 10, 2, 8, -2, 8, -2, 10, -5, 8, -10, 8, -15, 0];
    Guy.canvas = document.createElement('canvas');
    Guy.canvas.width=30;
    Guy.canvas.height=20;
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

    halfWidth: 14,

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
      c.beginPath();
      c.fillStyle='#FFBE40';
      c.shadowColor='#FFCF73';
      c.shadowBlur='30';
      c.arc(0,0,10,0,TAU);
      c.closePath();
      c.fill();
    },
    derezz: function () {
      var p = new Particles(3);
      p.x = this.x;
      p.y = this.y;
      p.add();
    },

    halfWidth: 5,

    type: PULSE,

    collidesWidth: BAD_GUYS
  };
  Sprite(Pulse);

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
      c.fillStyle = "#FFCF73";
      for (var i = 0; i < count; i+=2) {
        var particleX = this.particleDirections[i];
        var particleY = this.particleDirections[i+1];
        c.fillRect(particleX * this.life/8, particleY * this.life/8,2,2);
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
    switch (e.keyCode) {
      case 80: // p
        pause();
        break;
      case 70: // f
        framerate = !framerate;
        break;
    }
    keyDown = true;
  }, false);
  window.addEventListener('keyup', function (e) {
    KEYS[KEY_CODES[e.keyCode]] = false;
    keyDown = false;
  }, false);

  document.getElementById('start').addEventListener('click', function (e) {
    // start game
    currentState = states.begin;
  });



  function checkBoltCollision(bolt, sprite) {
    var boltNormal = bolt.rot;
    var normX = -bolt.velY;
    var normY = bolt.velX;
    var boltNormProj = bolt.x * normX + bolt.y * normY;
    var spriteNormProj = sprite.x * normX + sprite.y * normY;
    var dirX = sprite.x - bolt.x;
    var dirY = sprite.y - bolt.y;
    var boltProj = dirX * bolt.velX + dirY * bolt.velY;
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
      if (sprite.alive && sprite.type & canidate.collidesWith) {
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

  function fire(direction) {
    if (Bolt.freeBolts.length) {
      var bolt = Bolt.freeBolts.pop();
      bolt.x = guy.x;
      bolt.y = guy.y;
      var angle = guy.rot + rot;
      if (direction === 'up') {
        angle -= PI/2;
      } else {
        angle -= 3*PI/2;
      }
      bolt.rot = guy.rot + rot;
      bolt.velX = Math.cos(angle) * 3;
      bolt.velY = Math.sin(angle) * 3;
      bolt.add();
    }
  }

  function pause() {
    running = !running;
    if (running) {
      loop();
    }
  }

  function integrateLine() {
    var index = segmentIndex(rot);
    var segmentLength = (currentLevel.segments) ? currentLevel.segments[index].length : 1;
    var currentMaxVel = 4 * maxRot/segmentLength;
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
    var segments = [];
    var f = level.f;
    var z = zzTarget;
    var length;
    var position = 0;
    var i=0;
    var w = f(0,z);
    var x1 = Math.cos(0)*w;
    var y1 = Math.sin(0)*w;
    var angle=step;
    var x2, y2, x, y;
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

  // get precalculated tangent
  function tangentAngle(theta) {
    return segmentForAngle(theta).tangent;
  }

  function segmentForAngle(theta) {
    var i = segmentIndex(theta);
    return currentLevel.segments[i];
  }

  function segmentIndex(theta) {
    return Math.floor(segmentCount * clamp(theta) / TAU);
  }

  function addBada(position, length) {
    var group = {
      dir: (Math.random() > 0.5) ? 1 : -1,
      count: length
    };
    for (var i = 0; i < length; i++) {
      var bada = new Bada(group);
      bada.angle = position + i/20;
      bada.ani = i;
      bada.add();
    }
  }

  function findAFreeSpot() {
    var bucketCount = 20;
    var bucketLength = Math.round(currentLevel.totalLength / bucketCount);
    var buckets = [];
    var sprite = headSprite;
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

  function renderTitle(delta) {
    if (titleOffset > -120) {
      if (titleOffset < -60) {
        var cos = Math.cos(-(titleOffset + 60) * PI/120);
        titleOffset -= cos * delta / 10;
        menuNode.style.opacity = 1-cos;
      } else {
        titleOffset -= delta / 10;
      }
    }

    c.save();
    c.translate(0, titleOffset);
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
      // rotAcc = -rotVel / 10;
      if (pulseCount-- > 0) {
        (new Pulse(guy.angle, 1)).add();
        (new Pulse(guy.angle, -1)).add();
      }
    }
    if (KEYS.x) {
      Bolt.currentBoltFireTimeout -= elapsed;
      if (Bolt.currentBoltFireTimeout < 0) {
        Bolt.currentBoltFireTimeout = Bolt.BOLT_FIRE_TIMEOUT;
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

      checkCollisions(sprite, elapsed);

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
    // remove existing sprites
    var sprite = tailSprite;
    while (sprite) {
      sprite.unlink();
      sprite = tailSprite;
    }

    // create new guy
    guy = new Guy();
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
    for (var i = 0; i < currentLevel.bgcc; i++) {
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
  function hideScore() {
    scoreNode.style.display = 'none';
  }


  //////////////
  /// Levels ///
  //////////////

  var levels = [
    {
      f: function (t) {
        return maxRadius * Math.cos(Math.sin(t * zz)) - 20;
      },
      bgcc: 3,
      badaSize: 2,
      baddies: [Spider, Bada, Bada, Bada, Bada]
    },

    {
      f: function (t) {
        return (zz * maxRadius / 4.2*(1 + Math.cos(t)));
      },
      bgcc: 3,
      badaSize: 3,
      baddies: [Spider, Bada, Bada, Bada, Bada, Seeker]
    },

    {
      f: function (t) {
        return Math.sin(t * zz) * maxRadius;
      },
      bgcc: 4,
      badaSize: 4,
      baddies: [Spider, Bada, Bada, Bada, Bada, Seeker]
    },

    {
      f: function (t) {
        return maxRadius * Math.cos(Math.sin(2 * t * zz)) - 20;
      },
      bgcc: 4,
      badaSize: 4,
      baddies: [Spider, Bada, Bada, Bada, Bada, Seeker, Bada, Seeker]
    },

    {
      f: function (t) {
        return maxRadius * Math.cos(2*Math.sin(t * zz));
      },
      bgcc: 4,
      badaSize: 3,
      baddies: [Spider, Bada, Bada, Bada, Bada, Seeker]
    },

    {
      f: function (t) {
        return maxRadius * Math.sin(t + t * zz);
      },
      bgcc: 3,
      badaSize: 2,
      baddies: [Spider, Bada, Bada, Bada, Bada]
    }
  ];

  startNewLevel(0);

  //////////////
  /// States ///
  //////////////

  var states = {
    waitToBegin: function (elapsed) {
      renderTitle(elapsed);
    },
    begin: function () {
      menuNode.style.display = 'none';
      zz = 0;
      showScore();
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
    },
    runOutLevel: function (elapsed) {
      if (levelTimeout > 0) {
        levelTimeout -= elapsed;
        handleControls(elapsed);
        integrateLine();
        renderLine(currentLevel.f,zz,rot);
        runSprites(elapsed);
      } else {
        currentState = states.finishLevel;
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
    },
    guyDie: function (elapsed) {
      currentState = states.waitToRestart;
    },
    waitToRestart: function (elapsed) {
      integrateLine();
      renderLine(currentLevel.f,zz,rot);
      runSprites(elapsed);
    },
    gameOver: function () {
    }
  };
  var currentState = states.waitToBegin;


  /////////////////
  /// Main Loop ///
  /////////////////

  function loop() {
    var thisFrame = timestamp();
    var elapsed = thisFrame - lastFrame;
    lastFrame = thisFrame;

    if (elapsed > 100) {
      elapsed = 100; // cap it at 10 FPS
    }

    c.clearRect(-305, -305, 610, 610);

    currentState(elapsed);

    if (framerate) {
      renderFramerate(elapsed);
    }

    if (running) {
      requestAnimFrame(loop, canvas);
    }
  }
  loop();

})();
