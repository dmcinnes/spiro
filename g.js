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
scale = 300;
canvas = document.getElementById('c');
c = canvas.getContext('2d');
c.strokeStyle='black';
c.translate(305,305);
c.lineWidth = 2;
step = TAU/360;

KEY_CODES = {
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down'
};

KEYS = {};

window.addEventListener('keydown', function (e) {
  KEYS[KEY_CODES[e.keyCode]] = true;
}, false);
window.addEventListener('keyup', function (e) {
  KEYS[KEY_CODES[e.keyCode]] = false;
}, false);

function renderLine(f,z) {
  i=0;
  c.beginPath();
  c.moveTo(f(0)*scale,0);
  while (i<TAU) {
    w = f(i,z) * scale;
    c.lineTo(Math.cos(i)*w,Math.sin(i)*w);
    i+=step;
  }
  c.stroke();
}

function f(x,z) {
  return Math.sin(x * z);
}

offset = 0;
zz = 1;
lastFrame = timestamp();
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

  if (KEYS.left) {
    offset -= elapsed / 10;
  }
  if (KEYS.right) {
    offset += elapsed / 10;
  }
  if (KEYS.up) {
    zz += elapsed / 1000;
  }
  if (KEYS.down) {
    zz -= elapsed / 1000;
  }

  c.save();
  c.rotate(offset/100);
  renderLine(f,zz);
  c.restore();
  requestAnimFrame(loop, canvas);
}
loop();
