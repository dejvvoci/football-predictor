import { OddsEntry } from './odds-client';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Koeficentë "fallback", gjeneruar kur the-odds-api.com s'ka të dhëna për një ndeshje
 * (kompeticion i pambuluar, emra skuadrash që s'përputhen, etj.) — që aplikacioni
 * të mos ngecë pa koeficentë fare.
 */
export function generateFallbackOdds(): OddsEntry {
  return {
    home: round2(1.5 + Math.random() * 2.5), // 1.50 – 4.00
    draw: round2(2.8 + Math.random() * 1.5), // 2.80 – 4.30
    away: round2(1.5 + Math.random() * 2.5) // 1.50 – 4.00
  };
}