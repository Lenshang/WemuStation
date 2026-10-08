// Supported systems. `ejsCore` is the EmulatorJS system id (drives which libretro
// core is loaded), `themeDir` is the directory name inside an ES-DE theme.
export const SYSTEMS = [
  {
    id: 'nes',
    aliases: ['fc', 'famicom', 'familycomputer'],
    fullName: 'Nintendo Entertainment System',
    shortName: 'NES',
    manufacturer: 'Nintendo',
    releaseYear: '1983',
    ejsCore: 'nes',
    themeDir: 'nes',
    extensions: ['nes', 'fds', 'unf', 'unif', 'zip', '7z']
  },
  {
    id: 'n64',
    aliases: ['nintendo-64'],
    fullName: 'Nintendo 64',
    shortName: 'N64',
    manufacturer: 'Nintendo',
    releaseYear: '1996',
    themeDir: 'n64',
    extensions: ['z64', 'v64', 'n64', 'zip', '7z']
  },
  {
    id: 'nds',
    aliases: ['nintendo-ds'],
    fullName: 'Nintendo DS',
    shortName: 'NDS',
    manufacturer: 'Nintendo',
    releaseYear: '2004',
    themeDir: 'nds',
    extensions: ['nds', 'zip', '7z']
  },
  {
    id: 'snes',
    aliases: ['sfc', 'superfamicom', 'super-nintendo'],
    fullName: 'Super Nintendo Entertainment System',
    shortName: 'SNES',
    manufacturer: 'Nintendo',
    releaseYear: '1990',
    ejsCore: 'snes',
    themeDir: 'snes',
    extensions: ['smc', 'sfc', 'swc', 'fig', 'zip', '7z']
  },
  {
    id: 'megadrive',
    aliases: ['md', 'genesis', 'segagenesis', 'mega-drive'],
    fullName: 'Sega Mega Drive / Genesis',
    shortName: 'Mega Drive',
    manufacturer: 'Sega',
    releaseYear: '1988',
    ejsCore: 'segaMD',
    themeDir: 'megadrive',
    extensions: ['md', 'smd', 'gen', 'bin', '68k', 'zip', '7z']
  },
  {
    id: 'pcengine',
    aliases: ['pce', 'tg16', 'turbografx16', 'turbografx'],
    fullName: 'PC Engine / TurboGrafx-16',
    shortName: 'PC Engine',
    manufacturer: 'NEC',
    releaseYear: '1987',
    ejsCore: 'pce',
    themeDir: 'pcengine',
    extensions: ['pce', 'cue', 'ccd', 'zip', '7z']
  },
  {
    id: 'pcenginecd',
    aliases: ['pce-cd', 'pcecd', 'pcengine-cd', 'tg16cd'],
    fullName: 'PC Engine CD',
    shortName: 'PC Engine CD',
    manufacturer: 'NEC',
    releaseYear: '1988',
    themeDir: 'pcenginecd',
    extensions: ['cue', 'chd', 'iso', 'toc']
  },
  {
    id: 'gba',
    aliases: ['gameboyadvance', 'agb'],
    fullName: 'Game Boy Advance',
    shortName: 'GBA',
    manufacturer: 'Nintendo',
    releaseYear: '2001',
    ejsCore: 'gba',
    themeDir: 'gba',
    extensions: ['gba', 'zip', '7z']
  },
  {
    id: 'gb',
    aliases: ['gameboy', 'dmg'],
    fullName: 'Game Boy / Game Boy Color',
    shortName: 'Game Boy',
    manufacturer: 'Nintendo',
    releaseYear: '1989',
    ejsCore: 'gb',
    themeDir: 'gb',
    extensions: ['gb', 'gbc', 'zip', '7z']
  },
  {
    id: 'psx',
    aliases: ['ps1', 'playstation', 'sonyplaystation', 'psone'],
    fullName: 'Sony PlayStation',
    shortName: 'PlayStation',
    manufacturer: 'Sony',
    releaseYear: '1994',
    ejsCore: 'psx',
    themeDir: 'psx',
    extensions: ['bin', 'cue', 'pbp', 'chd', 'iso', 'img', 'zip', '7z']
  },
  {
    id: 'psp',
    aliases: ['playstationportable', 'pspgo'],
    fullName: 'PlayStation Portable',
    shortName: 'PSP',
    manufacturer: 'Sony',
    releaseYear: '2004',
    themeDir: 'psp',
    extensions: ['iso', 'cso', 'pbp', 'chd', 'elf']
  },
  {
    id: 'gbc',
    aliases: ['gameboycolor', 'cgb'],
    fullName: 'Game Boy Color',
    shortName: 'Game Boy Color',
    manufacturer: 'Nintendo',
    releaseYear: '1998',
    themeDir: 'gbc',
    extensions: ['gbc', 'cgb', 'zip', '7z']
  },
  {
    id: 'gamegear',
    aliases: ['gg', 'segagamegear'],
    fullName: 'Sega Game Gear',
    shortName: 'Game Gear',
    manufacturer: 'Sega',
    releaseYear: '1990',
    themeDir: 'gamegear',
    extensions: ['gg', 'bin', 'zip', '7z']
  },
  {
    id: 'fbneo',
    aliases: ['fba', 'finalburnneo', 'arcade'],
    fullName: 'Arcade (FinalBurn Neo)',
    shortName: 'Arcade',
    manufacturer: 'Arcade',
    releaseYear: '1978',
    themeDir: 'fbneo',
    extensions: ['zip', '7z']
  },
  {
    id: 'neogeo',
    aliases: ['neo-geo', 'snk-neogeo'],
    fullName: 'Neo Geo Arcade',
    shortName: 'Neo Geo',
    manufacturer: 'SNK',
    releaseYear: '1990',
    themeDir: 'neogeo',
    extensions: ['zip', '7z']
  },
  {
    id: 'neogeocd',
    aliases: ['neo-geo-cd', 'neogeocd'],
    fullName: 'Neo Geo CD',
    shortName: 'Neo Geo CD',
    manufacturer: 'SNK',
    releaseYear: '1994',
    themeDir: 'neogeocd',
    extensions: ['chd', 'cue', 'iso', 'toc']
  },
  {
    id: 'cps1',
    aliases: ['cps-1', 'capcomcps1'],
    fullName: 'Arcade (CPS-1)',
    shortName: 'CPS-1',
    manufacturer: 'Capcom',
    releaseYear: '1988',
    themeDir: 'cps1',
    extensions: ['zip', '7z']
  },
  {
    id: 'cps2',
    aliases: ['cps-2', 'capcomcps2'],
    fullName: 'Arcade (CPS-2)',
    shortName: 'CPS-2',
    manufacturer: 'Capcom',
    releaseYear: '1993',
    themeDir: 'cps2',
    extensions: ['zip', '7z']
  },
  {
    id: 'cps3',
    aliases: ['cps-3', 'capcomcps3'],
    fullName: 'Arcade (CPS-3)',
    shortName: 'CPS-3',
    manufacturer: 'Capcom',
    releaseYear: '1996',
    themeDir: 'cps3',
    extensions: ['zip', '7z']
  },
  {
    id: 'mame',
    aliases: ['mame2003', 'mame2003plus', 'mame4all'],
    fullName: 'Arcade (MAME 2003 Plus)',
    shortName: 'MAME',
    manufacturer: 'MAME Team',
    releaseYear: '1978',
    themeDir: 'mame',
    extensions: ['zip', '7z']
  },
  {
    id: 'ngp',
    aliases: ['neogeopocket'],
    fullName: 'Neo Geo Pocket',
    shortName: 'Neo Geo Pocket',
    manufacturer: 'SNK',
    releaseYear: '1998',
    themeDir: 'ngp',
    extensions: ['ngp', 'zip', '7z']
  },
  {
    id: 'ngpc',
    aliases: ['neogeopocketcolor'],
    fullName: 'Neo Geo Pocket Color',
    shortName: 'Neo Geo Pocket Color',
    manufacturer: 'SNK',
    releaseYear: '1999',
    themeDir: 'ngpc',
    extensions: ['ngp', 'ngc', 'zip', '7z']
  },
  {
    id: 'virtualboy',
    aliases: ['vb', 'nintendovirtualboy', 'virtual boy'],
    fullName: 'Nintendo Virtual Boy',
    shortName: 'Virtual Boy',
    manufacturer: 'Nintendo',
    releaseYear: '1995',
    themeDir: 'virtualboy',
    extensions: ['vb', 'vboy', 'bin', 'zip', '7z']
  },
  {
    id: 'wonderswan',
    aliases: ['ws', 'wonderswan-mono'],
    fullName: 'Bandai WonderSwan',
    shortName: 'WonderSwan',
    manufacturer: 'Bandai',
    releaseYear: '1999',
    themeDir: 'wonderswan',
    extensions: ['ws', 'zip', '7z']
  },
  {
    id: 'wonderswancolor',
    aliases: ['wsc'],
    fullName: 'Bandai WonderSwan Color',
    shortName: 'WonderSwan Color',
    manufacturer: 'Bandai',
    releaseYear: '2000',
    themeDir: 'wonderswancolor',
    extensions: ['ws', 'wsc', 'zip', '7z']
  },
  {
    id: 'gameandwatch',
    aliases: ['gw', 'gnw', 'nintendogame-watch'],
    fullName: 'Nintendo Game & Watch',
    shortName: 'Game & Watch',
    manufacturer: 'Nintendo',
    releaseYear: '1980',
    themeDir: 'gameandwatch',
    extensions: ['gw', 'mgw', 'zip']
  },
  {
    id: 'sms',
    fullName: 'Sega Master System',
    shortName: 'Master System',
    manufacturer: 'Sega',
    releaseYear: '1985',
    themeDir: 'sms',
    aliases: ['mastersystem', 'segamastersystem', 'sega-master-system'],
    extensions: ['sms', 'zip', '7z']
  },
  {
    id: 'sg1000',
    aliases: ['sg-1000', 'sc-3000'],
    fullName: 'SG-1000',
    shortName: 'SG-1000',
    manufacturer: 'Sega',
    releaseYear: '1983',
    themeDir: 'sg-1000',
    extensions: ['sg', 'sc', 'bin', 'zip', '7z']
  },
  {
    id: 'segacd',
    aliases: ['sega-cd', 'megacd', 'mega-cd'],
    fullName: 'Sega CD',
    shortName: 'Sega CD',
    manufacturer: 'Sega',
    releaseYear: '1991',
    themeDir: 'segacd',
    extensions: ['cue', 'chd', 'iso', 'toc']
  },
  {
    id: 'sega32x',
    aliases: ['32x', 'mega32x', 'sega-32x'],
    fullName: 'Sega 32X',
    shortName: '32X',
    manufacturer: 'Sega',
    releaseYear: '1994',
    themeDir: 'sega32x',
    extensions: ['32x', 'bin', 'zip', '7z']
  },
  {
    id: 'msx2',
    aliases: ['msx', 'msx2+'],
    fullName: 'MSX2',
    shortName: 'MSX2',
    manufacturer: 'Microsoft',
    releaseYear: '1985',
    themeDir: 'msx2',
    extensions: ['rom', 'mx1', 'mx2', 'dsk', 'cas', 'zip', '7z']
  },
  {
    id: 'pc98',
    aliases: ['pc-98', 'pc9821'],
    fullName: 'PC-98',
    shortName: 'PC-98',
    manufacturer: 'NEC',
    releaseYear: '1982',
    themeDir: 'pc98',
    extensions: ['hdi', 'd88', 'd98', 'fdi', 'thd', 'nfd', 'cmd', 'zip', '7z']
  },
  {
    id: 'lynx',
    aliases: ['atarilynx', 'atari-lynx'],
    fullName: 'Atari Lynx',
    shortName: 'Lynx',
    manufacturer: 'Atari',
    releaseYear: '1989',
    themeDir: 'atarilynx',
    extensions: ['lnx', 'lyx', 'zip', '7z']
  },
  {
    id: '3do',
    fullName: '3DO Interactive Multiplayer',
    shortName: '3DO',
    manufacturer: 'The 3DO Company',
    releaseYear: '1993',
    themeDir: '3do',
    extensions: ['iso', 'chd', 'cue', 'zip']
  },
  // DOS: dosbox_pure 的 emscripten 构建上游已损坏/移除（内容初始化死锁），
  // 待上游恢复后取消注释即可。详见 README。
  //   {
  //     id: 'dos',
  //     fullName: 'DOS (DOSBox Pure)',
  //     shortName: 'DOS',
  //     manufacturer: 'IBM PC Compatible',
  //     releaseYear: '1981',
  //     themeDir: 'dos',
  //     aliases: ['dosbox', 'msdos'],
  //     extensions: ['zip', 'exe', 'com']
  //   },
  {
    id: 'atari2600',
    fullName: 'Atari 2600',
    shortName: 'Atari 2600',
    manufacturer: 'Atari',
    releaseYear: '1977',
    themeDir: 'atari2600',
    aliases: ['a2600', 'atari'],
    extensions: ['a26', '7z', 'zip', 'bin']
  },
  {
    id: 'atari5200',
    fullName: 'Atari 5200',
    shortName: 'Atari 5200',
    manufacturer: 'Atari',
    releaseYear: '1982',
    themeDir: 'atari5200',
    aliases: ['a5200'],
    extensions: ['a52', '7z', 'zip', 'bin']
  },
  {
    id: 'atari7800',
    fullName: 'Atari 7800 ProSystem',
    shortName: 'Atari 7800',
    manufacturer: 'Atari',
    releaseYear: '1986',
    themeDir: 'atari7800',
    aliases: ['a7800'],
    extensions: ['a78', '7z', 'zip', 'bin']
  }
];

export function getSystem(id) {
  return SYSTEMS.find((s) => s.id === id);
}
