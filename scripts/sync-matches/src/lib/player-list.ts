/** Listë e kuruar e lojtarëve të famshëm — fallback kur TheSportsDB nuk është i disponueshëm */

export interface FallbackPlayer {
  name: string;
  nationality: string;
  nationalityEmoji: string;
  position: string;
  club: string;
  birthYear: number;
}

export const FAMOUS_PLAYERS: FallbackPlayer[] = [
  { name: 'Lionel Messi',       nationality: 'Argentinian', nationalityEmoji: '🇦🇷', position: 'Forward',    club: 'Inter Miami CF',   birthYear: 1987 },
  { name: 'Cristiano Ronaldo',  nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Forward',    club: 'Al Nassr',         birthYear: 1985 },
  { name: 'Kylian Mbappé',      nationality: 'French',      nationalityEmoji: '🇫🇷', position: 'Forward',    club: 'Real Madrid',      birthYear: 1998 },
  { name: 'Erling Haaland',     nationality: 'Norwegian',   nationalityEmoji: '🇳🇴', position: 'Forward',    club: 'Manchester City',  birthYear: 2000 },
  { name: 'Jude Bellingham',    nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 2003 },
  { name: 'Vinicius Junior',    nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Real Madrid',      birthYear: 2000 },
  { name: 'Kevin De Bruyne',    nationality: 'Belgian',     nationalityEmoji: '🇧🇪', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1991 },
  { name: 'Luka Modric',        nationality: 'Croatian',    nationalityEmoji: '🇭🇷', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 1985 },
  { name: 'Mohamed Salah',      nationality: 'Egyptian',    nationalityEmoji: '🇪🇬', position: 'Forward',    club: 'Liverpool',        birthYear: 1992 },
  { name: 'Robert Lewandowski', nationality: 'Polish',      nationalityEmoji: '🇵🇱', position: 'Forward',    club: 'Barcelona',        birthYear: 1988 },
  { name: 'Harry Kane',         nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Forward',    club: 'Bayern Munich',    birthYear: 1993 },
  { name: 'Neymar Jr',          nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Al Hilal',         birthYear: 1992 },
  { name: 'Antoine Griezmann',  nationality: 'French',      nationalityEmoji: '🇫🇷', position: 'Forward',    club: 'Atletico Madrid',  birthYear: 1991 },
  { name: 'Pedri',              nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Barcelona',        birthYear: 2002 },
  { name: 'Rodri',              nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1996 },
  { name: 'Phil Foden',         nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Manchester City',  birthYear: 2000 },
  { name: 'Jamal Musiala',      nationality: 'German',      nationalityEmoji: '🇩🇪', position: 'Midfielder',  club: 'Bayern Munich',    birthYear: 2003 },
  { name: 'Bukayo Saka',        nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Forward',    club: 'Arsenal',          birthYear: 2001 },
  { name: 'Virgil van Dijk',    nationality: 'Dutch',       nationalityEmoji: '🇳🇱', position: 'Defender',   club: 'Liverpool',        birthYear: 1991 },
  { name: 'Marc-André ter Stegen', nationality: 'German',  nationalityEmoji: '🇩🇪', position: 'Goalkeeper', club: 'Barcelona',        birthYear: 1992 },
  { name: 'Thibaut Courtois',   nationality: 'Belgian',     nationalityEmoji: '🇧🇪', position: 'Goalkeeper', club: 'Real Madrid',      birthYear: 1992 },
  { name: 'Trent Alexander-Arnold', nationality: 'English', nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Defender',  club: 'Real Madrid',      birthYear: 1998 },
  { name: 'Federico Valverde',  nationality: 'Uruguayan',   nationalityEmoji: '🇺🇾', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 1998 },
  { name: 'Bernardo Silva',     nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1994 },
  { name: 'Ruben Dias',         nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Defender',   club: 'Manchester City',  birthYear: 1997 },
  { name: 'Gavi',               nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Barcelona',        birthYear: 2004 },
  { name: 'Raphinha',           nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Barcelona',        birthYear: 1996 },
  { name: 'Florian Wirtz',      nationality: 'German',      nationalityEmoji: '🇩🇪', position: 'Midfielder',  club: 'Bayer Leverkusen', birthYear: 2003 },
  { name: 'Declan Rice',        nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Arsenal',          birthYear: 1999 },
  { name: 'Martin Odegaard',    nationality: 'Norwegian',   nationalityEmoji: '🇳🇴', position: 'Midfielder',  club: 'Arsenal',          birthYear: 1998 },
];

/**
 * Zgjedh lojtarin e ditës bazuar mbi datën si seed — deterministic,
 * i njëjtë për të gjithë userat në të njëjtën ditë.
 */
export function pickPlayerForDate(dateStr: string): FallbackPlayer {
  const seed = parseInt(dateStr.replace(/-/g, ''), 10);
  const index = seed % FAMOUS_PLAYERS.length;
  return FAMOUS_PLAYERS[index];
}