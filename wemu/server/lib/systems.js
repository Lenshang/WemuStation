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
    aliases: ['pce', 'tg16', 'turbografx16', 'turbografx', 'pcecd', 'pcenginecd'],
    fullName: 'PC Engine / TurboGrafx-16',
    shortName: 'PC Engine',
    manufacturer: 'NEC',
    releaseYear: '1987',
    ejsCore: 'pce',
    themeDir: 'pcengine',
    extensions: ['pce', 'cue', 'ccd', 'zip', '7z']
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
  }
];

export function getSystem(id) {
  return SYSTEMS.find((s) => s.id === id);
}
