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

TAU = 2*Math.PI;
maxRadius = 300;
canvas = document.getElementById('c');
c = canvas.getContext('2d');
c.strokeStyle='black';
c.translate(305,305);
c.lineWidth = 2;
step = TAU/360;
running = true;

function pause() {
  running = !running;
  if (running) {
    loop();
  }
}

KEY_CODES = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  32: 'space'
};

KEYS = {};

window.addEventListener('keydown', function (e) {
  KEYS[KEY_CODES[e.keyCode]] = true;
  if (e.keyCode === 80) {
    pause();
  }
}, false);
window.addEventListener('keyup', function (e) {
  KEYS[KEY_CODES[e.keyCode]] = false;
}, false);

function renderLine(f,z) {
  i=0;
  c.beginPath();
  c.moveTo(f(0,z),0);
  while (i<TAU) {
    w = f(i,z);
    c.lineTo(Math.cos(i)*w,Math.sin(i)*w);
    i+=step;
  }
  c.stroke();
}

function f(t,z) {
  return Math.sin(t * z) * maxRadius;
}

function tangentAngle(t,z) {
  t1 = f(t,z);
  x1 = Math.cos(t)*t1;
  y1 = Math.sin(t)*t1;
  t2 = f(t+step,z);
  x2 = Math.cos(t+step)*t2;
  y2 = Math.sin(t+step)*t2;
  x = x2 - x1;
  y = y2 - y1;
  return Math.atan2(y, x); // radians
}


offset = 0;
zz = 0;
zzTarget = 3;
lastFrame = timestamp();
rotAcc = 0;
rotVel = 0;
rot = 0;
maxRot = 0.04;

function loop() {
  thisFrame = timestamp();
  elapsed = thisFrame - lastFrame;
  if (elapsed > 100) {
    elapsed = 100; // cap it at 10 FPS
  }

  lastFrame = thisFrame;
  c.clearRect(-305, -305, 610, 610);
  c.save();
  c.translate(-200, -200);
  c.scale(2, 2);
  c.fillText(Math.round(1000/elapsed), 0, 0);
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
  }

  rotVel += rotAcc;
  if (Math.abs(rotVel) > maxRot) {
    rotVel = maxRot * Math.abs(rotVel)/rotVel;
  }

  rot += rotVel;
  rotAcc = 0;

  c.save();
  c.rotate(rot);
  renderLine(f,zz);
  c.restore();

  c.save();
  w = f(rot,zz);
  c.rotate(rot);
  c.translate(Math.cos(rot)*w,Math.sin(rot)*w);
  c.rotate(tangentAngle(rot,zz));
  c.fillStyle='red';
  c.fillRect(-10, -10, 20, 20);
  c.restore();

  if (running) {
    requestAnimFrame(loop, canvas);
  }
}
loop();
