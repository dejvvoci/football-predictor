/**
 * Lidhja mes kodeve të kompeticioneve te football-data.org (plani falas, 12 kompeticione)
 * dhe "sport_key"-ve përkatëse te the-odds-api.com.
 *
 * Shënim: nëse the-odds-api ndryshon ndonjë sport_key, thjesht s'gjendet përputhje
 * dhe sistemi bie automatikisht mbrapa te koeficentët "fallback" (shih fallback-odds.ts) —
 * pra një gabim këtu s'e prish aplikacionin, vetëm e bën më pak të sakta koeficentët.
 * Verifiko sport_key-të reale te GET https://api.the-odds-api.com/v4/sports?apiKey=...
 */
export const COMPETITION_TO_SPORT_KEY: Record<string, string> = {
  PL: 'soccer_epl',
  PD: 'soccer_spain_la_liga',
  BL1: 'soccer_germany_bundesliga',
  SA: 'soccer_italy_serie_a',
  FL1: 'soccer_france_ligue_one',
  CL: 'soccer_uefa_champs_league',
  ELC: 'soccer_efl_champ',
  DED: 'soccer_netherlands_eredivisie',
  PPL: 'soccer_portugal_primeira_liga',
  BSA: 'soccer_brazil_campeonato',
  WC: 'soccer_fifa_world_cup',
  EC: 'soccer_uefa_european_championship'
};

/** 12 kompeticionet e mbuluara nga plani falas i football-data.org */
export const FREE_COMPETITIONS = Object.keys(COMPETITION_TO_SPORT_KEY);