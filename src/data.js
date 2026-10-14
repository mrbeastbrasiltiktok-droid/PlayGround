// Character + ability canonical data. Single source of truth for UI + combat.
export const CHARACTERS = {
  phoenix: {
    id: 'phoenix', name: 'PHOENIX', tag: 'FOGO CÓSMICO',
    color: 0xff6a1f, color2: 0xffc93c, accent: '#ff6a1f',
    desc: 'Avatar do fogo cósmico. Queima com dano contínuo, drena vida em um agarrão cinematográfico, ergue escudo de chamas e — uma vez por luta — renasce das cinzas.',
    stats: { Poder: 82, Defesa: 62, Mobilidade: 70, Controle: 55 },
    hp: 1050, energy: 100, speed: 6.2, basicDmg: 46,
    abilities: [
      { key: '1', icon: '🔥', name: 'Rajada Ígnea', cost: 20, cd: 6, range: 16,
        desc: 'Rajada concentrada: 90 de dano + queimadura (15/s por 3s). Chamas envolvem o alvo.' },
      { key: '2', icon: '🌀', name: 'Dreno de Vida', cost: 35, cd: 14, range: 7,
        desc: 'Avança e puxa o alvo para um tornado de fogo. Agarrão pelo pescoço: 120 de dano progressivo e cura 50%.' },
      { key: '3', icon: '🛡️', name: 'Escudo de Chamas', cost: 25, cd: 16, range: 0,
        desc: 'Envolve o corpo em chamas por 6s: -45% dano recebido. Reage visualmente a cada bloqueio.' },
      { key: '4', icon: '🐦', name: 'Renascer da Fênix', cost: 50, cd: 60, range: 0,
        desc: 'Proteção flamejante por 10s. Se derrotada, renasce 1x com 35% da vida + explosão de 120 em área.' },
    ]
  },
  iw: {
    id: 'iw', name: 'INVISIBLE WOMAN', tag: 'CAMPOS DE FORÇA',
    color: 0x4fc3ff, color2: 0xbfeaff, accent: '#4fc3ff',
    desc: 'Mestra dos campos de força e do espaço de combate. Sufoca, arremessa barreiras, aprisiona poderes e some para atacar com vantagem.',
    stats: { Poder: 68, Defesa: 78, Mobilidade: 66, Controle: 95 },
    hp: 980, energy: 100, speed: 6.0, basicDmg: 40,
    abilities: [
      { key: '1', icon: '◍', name: 'Sufocamento', cost: 25, cd: 10, range: 15,
        desc: 'Campo invisível na cabeça do alvo: 60 de dano + silencia habilidades por 2s + drena energia.' },
      { key: '2', icon: '▣', name: 'Barreira Projetada', cost: 22, cd: 8, range: 16,
        desc: 'Lança um campo do tamanho de um lutador: 80 de dano + empurrão forte + raiz breve.' },
      { key: '3', icon: '⬢', name: 'Prisão de Força', cost: 30, cd: 15, range: 13,
        desc: 'Aprisiona o rival em bolha transparente por 3s: bloqueia habilidades. Feedback visual total.' },
      { key: '4', icon: '👁', name: 'Invisibilidade Tática', cost: 30, cd: 20, range: 0,
        desc: 'Some por 4s (rastro sutil de distorção). Próximo ataque: +50% dano ou atordoa 1.2s.' },
    ]
  },
  chaos: {
    id: 'chaos', name: 'CHAOS', tag: 'REALIDADE / CAOS',
    color: 0xff2b5e, color2: 0x7a0f2e, accent: '#ff2b5e',
    desc: 'Anomalia da realidade em vermelho profundo e preto. Rajadas instáveis, telecinese, zonas de lentidão e um colapso caótico devastador em área.',
    stats: { Poder: 92, Defesa: 55, Mobilidade: 74, Controle: 80 },
    hp: 1000, energy: 100, speed: 6.5, basicDmg: 50,
    abilities: [
      { key: '1', icon: '✸', name: 'Raj. Caótica', cost: 20, cd: 6, range: 17,
        desc: 'Rajadas de energia caótica: 100 de dano + distorção do ar + fragmentos energéticos.' },
      { key: '2', icon: '⤴', name: 'Telecinese', cost: 32, cd: 13, range: 12,
        desc: 'Suspende o inimigo por 1.2s e o arremessa: 90 de dano de impacto + knockback direcional.' },
      { key: '3', icon: '◎', name: 'Zona de Distorção', cost: 25, cd: 14, range: 12,
        desc: 'Dobra o espaço ao redor do alvo por 5s: -45% velocidade e esquivas com janela menor.' },
      { key: '4', icon: '💥', name: 'Colapso Caótico', cost: 55, cd: 28, range: 0,
        desc: '1s de carga visível → onda expansiva em área: 150 de dano + empurrão massivo.' },
    ]
  }
};
export const CHAR_IDS = Object.keys(CHARACTERS);
