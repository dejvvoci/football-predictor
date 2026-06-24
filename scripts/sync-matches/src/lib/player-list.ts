export interface FallbackPlayer {
  name: string;
  nationality: string;
  nationalityEmoji: string;
  position: string;
  club: string;
  birthYear: number;
  wikiTitle: string; // exact Wikipedia article title for image lookup
}

export const FAMOUS_PLAYERS: FallbackPlayer[] = [
  { name: 'Lionel Messi',       nationality: 'Argentinian', nationalityEmoji: '🇦🇷', position: 'Forward',    club: 'Inter Miami CF',   birthYear: 1987, wikiTitle: 'Lionel_Messi' },
  { name: 'Cristiano Ronaldo',  nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Forward',    club: 'Al Nassr',         birthYear: 1985, wikiTitle: 'Cristiano_Ronaldo' },
  { name: 'Kylian Mbappé',      nationality: 'French',      nationalityEmoji: '🇫🇷', position: 'Forward',    club: 'Real Madrid',      birthYear: 1998, wikiTitle: 'Kylian_Mbappé' },
  { name: 'Erling Haaland',     nationality: 'Norwegian',   nationalityEmoji: '🇳🇴', position: 'Forward',    club: 'Manchester City',  birthYear: 2000, wikiTitle: 'Erling_Haaland' },
  { name: 'Jude Bellingham',    nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 2003, wikiTitle: 'Jude_Bellingham' },
  { name: 'Vinicius Junior',    nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Real Madrid',      birthYear: 2000, wikiTitle: 'Vinícius_Júnior' },
  { name: 'Kevin De Bruyne',    nationality: 'Belgian',     nationalityEmoji: '🇧🇪', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1991, wikiTitle: 'Kevin_De_Bruyne' },
  { name: 'Luka Modric',        nationality: 'Croatian',    nationalityEmoji: '🇭🇷', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 1985, wikiTitle: 'Luka_Modrić' },
  { name: 'Mohamed Salah',      nationality: 'Egyptian',    nationalityEmoji: '🇪🇬', position: 'Forward',    club: 'Liverpool',        birthYear: 1992, wikiTitle: 'Mohamed_Salah' },
  { name: 'Robert Lewandowski', nationality: 'Polish',      nationalityEmoji: '🇵🇱', position: 'Forward',    club: 'Barcelona',        birthYear: 1988, wikiTitle: 'Robert_Lewandowski' },
  { name: 'Harry Kane',         nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Forward',    club: 'Bayern Munich',    birthYear: 1993, wikiTitle: 'Harry_Kane' },
  { name: 'Neymar Jr',          nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Al Hilal',         birthYear: 1992, wikiTitle: 'Neymar' },
  { name: 'Antoine Griezmann',  nationality: 'French',      nationalityEmoji: '🇫🇷', position: 'Forward',    club: 'Atletico Madrid',  birthYear: 1991, wikiTitle: 'Antoine_Griezmann' },
  { name: 'Pedri',              nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Barcelona',        birthYear: 2002, wikiTitle: 'Pedri' },
  { name: 'Rodri',              nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1996, wikiTitle: 'Rodri_(footballer,_born_1996)' },
  { name: 'Phil Foden',         nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Manchester City',  birthYear: 2000, wikiTitle: 'Phil_Foden' },
  { name: 'Jamal Musiala',      nationality: 'German',      nationalityEmoji: '🇩🇪', position: 'Midfielder',  club: 'Bayern Munich',    birthYear: 2003, wikiTitle: 'Jamal_Musiala' },
  { name: 'Bukayo Saka',        nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Forward',    club: 'Arsenal',          birthYear: 2001, wikiTitle: 'Bukayo_Saka' },
  { name: 'Virgil van Dijk',    nationality: 'Dutch',       nationalityEmoji: '🇳🇱', position: 'Defender',   club: 'Liverpool',        birthYear: 1991, wikiTitle: 'Virgil_van_Dijk' },
  { name: 'Marc-André ter Stegen', nationality: 'German',  nationalityEmoji: '🇩🇪', position: 'Goalkeeper', club: 'Barcelona',        birthYear: 1992, wikiTitle: 'Marc-André_ter_Stegen' },
  { name: 'Thibaut Courtois',   nationality: 'Belgian',     nationalityEmoji: '🇧🇪', position: 'Goalkeeper', club: 'Real Madrid',      birthYear: 1992, wikiTitle: 'Thibaut_Courtois' },
  { name: 'Trent Alexander-Arnold', nationality: 'English', nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Defender',  club: 'Real Madrid',      birthYear: 1998, wikiTitle: 'Trent_Alexander-Arnold' },
  { name: 'Federico Valverde',  nationality: 'Uruguayan',   nationalityEmoji: '🇺🇾', position: 'Midfielder',  club: 'Real Madrid',      birthYear: 1998, wikiTitle: 'Federico_Valverde' },
  { name: 'Bernardo Silva',     nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Midfielder',  club: 'Manchester City',  birthYear: 1994, wikiTitle: 'Bernardo_Silva' },
  { name: 'Ruben Dias',         nationality: 'Portuguese',  nationalityEmoji: '🇵🇹', position: 'Defender',   club: 'Manchester City',  birthYear: 1997, wikiTitle: 'Rúben_Dias' },
  { name: 'Gavi',               nationality: 'Spanish',     nationalityEmoji: '🇪🇸', position: 'Midfielder',  club: 'Barcelona',        birthYear: 2004, wikiTitle: 'Gavi_(footballer)' },
  { name: 'Raphinha',           nationality: 'Brazilian',   nationalityEmoji: '🇧🇷', position: 'Forward',    club: 'Barcelona',        birthYear: 1996, wikiTitle: 'Raphinha' },
  { name: 'Florian Wirtz',      nationality: 'German',      nationalityEmoji: '🇩🇪', position: 'Midfielder',  club: 'Bayer Leverkusen', birthYear: 2003, wikiTitle: 'Florian_Wirtz' },
  { name: 'Declan Rice',        nationality: 'English',     nationalityEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', position: 'Midfielder',  club: 'Arsenal',          birthYear: 1999, wikiTitle: 'Declan_Rice' },
  { name: 'Martin Odegaard',    nationality: 'Norwegian',   nationalityEmoji: '🇳🇴', position: 'Midfielder',  club: 'Arsenal',          birthYear: 1998, wikiTitle: 'Martin_Ødegaard' },
];

export function pickPlayerForDate(dateStr: string): FallbackPlayer {
  const seed = parseInt(dateStr.replace(/-/g, ''), 10);
  const index = seed % FAMOUS_PLAYERS.length;
  return FAMOUS_PLAYERS[index];
}