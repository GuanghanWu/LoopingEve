import './style.css';
import type { GameConfig } from './types';
import { Game } from './Game';

async function loadConfig(): Promise<GameConfig> {
  const res = await fetch('./Configs/config.json?t=' + Date.now());
  if (!res.ok) throw new Error('配置加载失败');
  return res.json();
}

function setupModals(game: Game): void {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        if (modal.id === 'gameOverModal') {
          game.restart();
        } else {
          modal.classList.remove('show');
        }
      }
    });
  });
}

loadConfig()
  .then(config => {
    const game = new Game(config);
    window.game = game;
    game.init();
    setupModals(game);
  })
  .catch(e => {
    alert('配置加载失败：' + e.message);
  });
