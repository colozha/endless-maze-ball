// Lazily create browser audio after user interaction.
function ensureAudioContext() {
  if (!gameState.audio.context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    gameState.audio.context = new AudioContextClass();
  }

  if (gameState.audio.context.state === "suspended") {
    gameState.audio.context.resume();
  }

  return gameState.audio.context;
}

function playSuccessSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(523.25, now, 0.11, "sine", 0.08);
  playTone(659.25, now + 0.1, 0.12, "sine", 0.08);
  playTone(783.99, now + 0.22, 0.18, "triangle", 0.1);
}

function playFailSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(196, now, 0.14, "sawtooth", 0.08);
  playTone(146.83, now + 0.11, 0.22, "sawtooth", 0.07);
  playNoise(now, 0.18, 0.04);
}

function playMoveSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(330, now, 0.045, "triangle", 0.035);
}

function playShieldPickupSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(440, now, 0.1, "triangle", 0.06);
  playTone(659.25, now + 0.08, 0.14, "sine", 0.08);
  playTone(987.77, now + 0.18, 0.18, "sine", 0.06);
}

function playShieldExpireSound() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  playTone(659.25, now, 0.1, "triangle", 0.045);
  playTone(493.88, now + 0.08, 0.14, "triangle", 0.04);
  playTone(329.63, now + 0.18, 0.18, "sine", 0.035);
}

function playTone(frequency, startTime, duration, type, volume) {
  const audioContext = gameState.audio.context;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playNoise(startTime, duration, volume) {
  const audioContext = gameState.audio.context;
  const bufferSize = audioContext.sampleRate * duration;
  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start(startTime);
}
