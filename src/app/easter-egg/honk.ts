interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

/** Buzina curta de duas notas, sintetizada sob demanda — sem assets, sem estado global. */
export function playHonk() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    [
      { offset: 0, freq: 320, duration: 0.16 },
      { offset: 0.14, freq: 260, duration: 0.18 },
    ].forEach(({ offset, freq, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + offset + duration,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + duration + 0.02);
    });

    setTimeout(() => ctx.close(), 600);
  } catch {}
}
