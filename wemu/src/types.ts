export interface SystemInfo {
  id: string;
  fullName: string;
  shortName: string;
  manufacturer: string;
  releaseYear: string;
  themeDir: string;
  gameCount: number;
}

export interface GameEntry {
  fileName: string;
  name: string;
  desc: string;
  image: string;
  screenshot: string;
  marquee: string;
  video: string;
  releasedate: string;
  developer: string;
  publisher: string;
  genre: string;
  players: string;
  rating: number;
  favorite: boolean;
  playcount: number;
  lastplayed: string;
  size: number;
  url: string;
  /** 收藏/最近游玩条目携带真实系统 id(与列表所在系统可不同) */
  sysId?: string;
}

export interface AppConfig {
  theme: string;
  variant: string;
  player: 'retroarch' | 'emulatorjs';
  themePath: string;
}

// ---------- ES-DE theme types ----------

// A theme element: tag (image/text/...) + unique name + raw property values.
// Property values keep ${var} references unresolved until render time.
export interface ThemeElement {
  tag: string;
  name: string;
  props: Record<string, string>;
}

export interface ThemeLayout {
  themeRoot: string;               // URL base, e.g. /themes/slate-es-de/
  views: Record<string, Record<string, ThemeElement>>; // viewName -> elementName -> element
  variables: Record<string, string>;
  sounds: Record<string, string>;  // nav sound name -> raw path
}

export type NavButton =
  | 'up' | 'down' | 'left' | 'right'
  | 'accept' | 'cancel' | 'menu' | 'option'
  | 'search' | 'favorite';

export interface SystemExtraInfo {
  infoTexts: Record<string, string>; // info1..infoN from systeminfo.xml
}
