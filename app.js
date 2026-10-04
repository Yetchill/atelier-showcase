(() => {
  const sprite = document.getElementById('catSprite');
  const catToggle = document.getElementById('catToggle');
  const catStage = sprite.closest('.cat-stage');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let catPaused = reducedMotion.matches;

  const setCatPaused = (paused) => {
    catPaused = paused;
    catStage.classList.toggle('paused', paused);
    catToggle.textContent = paused ? '播放动画' : '暂停动画';
    catToggle.setAttribute('aria-pressed', String(!paused));
    catToggle.setAttribute('aria-label', paused ? '播放橘猫动画' : '暂停橘猫动画');
  };

  setCatPaused(catPaused);
  catToggle.addEventListener('click', () => setCatPaused(!catPaused));
  reducedMotion.addEventListener?.('change', (event) => {
    if (event.matches) setCatPaused(true);
  });

  const audios = [...document.querySelectorAll('audio')];
  const stopAudio = () => {
    for (const audio of audios) {
      audio.pause();
      audio.currentTime = 0;
    }
    document.querySelectorAll('.play-button').forEach((button) => {
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '▶ <span>播放</span>';
    });
  };

  document.querySelectorAll('.play-button').forEach((button) => {
    button.addEventListener('click', async () => {
      const audio = document.getElementById(`audio-${button.dataset.audio}`);
      if (!audio) return;
      if (!audio.paused && !audio.ended) {
        stopAudio();
        return;
      }
      stopAudio();
      try {
        await audio.play();
        button.setAttribute('aria-pressed', 'true');
        button.innerHTML = '■ <span>停止</span>';
      } catch {
        button.setAttribute('aria-label', '音频无法播放，请使用 WAV 下载');
      }
    });
    const audio = document.getElementById(`audio-${button.dataset.audio}`);
    audio.addEventListener('ended', stopAudio);
  });

  document.getElementById('stopAudio').addEventListener('click', stopAudio);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAudio();
  });
  window.addEventListener('pagehide', stopAudio);
})();
