let current: HTMLAudioElement | null = null;

export function playMusic(path: string, { loop = true, volume = 0.4 } = {}) {
  stopMusic();
  current = new Audio(path);
  current.loop = loop;
  current.volume = volume;
  current.play().catch(() => {});
}

export function fadeOutMusic(duration = 1000) {
  if (!current) return;
  const start = current.volume;
  const step = 50;
  let t = 0;
  const fade = setInterval(() => {
    t += step;
    current!.volume = Math.max(0, start * (1 - t / duration));
    if (t >= duration) {
      clearInterval(fade);
      stopMusic();
    }
  }, step);
}

export function stopMusic() {
  if (current) {
    current.pause();
    current = null;
  }
}
