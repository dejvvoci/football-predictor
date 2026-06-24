import { Injectable } from '@angular/core';
import { Match } from '../models/match.model';

export interface SharePrediction {
  choice: '1' | 'X' | '2';
  exactScore?: { home: number; away: number };
  points?: number;
  ouPoints?: number;
  htFtPoints?: number;
  bttsPoints?: number;
  redCardPoints?: number;
  htFt?: string;
  overUnder?: 'over' | 'under';
  btts?: boolean;
  redCard?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ShareService {

  async downloadPredictionCard(match: Match, prediction: SharePrediction, displayName: string): Promise<void> {
    const W = 400, H = 580;
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);

    // Pre-load crests
    const [homeCrest, awayCrest] = await Promise.all([
      match.homeCrest ? this.loadImage(match.homeCrest) : Promise.resolve(null),
      match.awayCrest ? this.loadImage(match.awayCrest) : Promise.resolve(null),
    ]);

    // ── Background gradient ──
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a6b3a');
    bg.addColorStop(1, '#0d3d20');
    ctx.fillStyle = bg;
    ctx.roundRect(0, 0, W, H, 16);
    ctx.fill();

    // ── Top stripe ──
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, 0, W, 56);

    // ── App name ──
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚽ PREDICTOR', 20, 35);

    // ── Competition ──
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(match.competition.toUpperCase(), W - 20, 35);

    // ── Teams ──
    const midY = 130;
    const crestSize = 56;
    const homeX = W / 2 - 90;
    const awayX = W / 2 + 90;

    // Home crest
    this.drawCrest(ctx, homeCrest, match.homeTeam, homeX, midY, crestSize / 2);

    // Away crest
    this.drawCrest(ctx, awayCrest, match.awayTeam, awayX, midY, crestSize / 2);

    // Team names
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.truncate(match.homeTeam, 14), homeX, midY + 40);
    ctx.fillText(this.truncate(match.awayTeam, 14), awayX, midY + 40);

    // ── Result or vs ──
    if (match.result) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${match.result.homeGoals} – ${match.result.awayGoals}`, W / 2, midY + 14);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('FINAL SCORE', W / 2, midY + 30);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('vs', W / 2, midY + 10);
    }

    // ── Divider ──
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, midY + 62);
    ctx.lineTo(W - 24, midY + 62);
    ctx.stroke();

    // ── My prediction section ──
    let y = midY + 90;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MY PREDICTION', 24, y);

    y += 26;
    const choiceLabel = prediction.choice === '1' ? match.homeTeam
      : prediction.choice === '2' ? match.awayTeam : 'Draw';
    const isCorrect = prediction.points !== undefined && prediction.points > 0;

    ctx.fillStyle = isCorrect ? '#4ADE80' : (prediction.points === 0 ? '#F87171' : '#ffffff');
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(choiceLabel + (isCorrect ? ' ✓' : prediction.points === 0 ? ' ✗' : ''), 24, y);

    if (prediction.exactScore) {
      y += 24;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`Score: ${prediction.exactScore.home}–${prediction.exactScore.away}`, 24, y);
    }
    if (prediction.htFt) {
      y += 24;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`HT/FT: ${prediction.htFt}`, 24, y);
    }
    if (prediction.overUnder !== undefined) {
      y += 24;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px system-ui, sans-serif';
      const line = match.ouOdds?.line ?? 2.5;
      ctx.fillText(`Goals: ${prediction.overUnder === 'over' ? 'Over' : 'Under'} ${line}`, 24, y);
    }
    if (prediction.btts !== undefined) {
      y += 24;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`BTTS: ${prediction.btts ? 'Yes' : 'No'}`, 24, y);
    }
    if (prediction.redCard !== undefined) {
      y += 24;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`Red card: ${prediction.redCard ? 'Yes' : 'No'}`, 24, y);
    }

    // ── Points earned ──
    if (prediction.points !== undefined) {
      const totalPts = (prediction.points ?? 0) + (prediction.ouPoints ?? 0)
        + (prediction.htFtPoints ?? 0) + (prediction.bttsPoints ?? 0) + (prediction.redCardPoints ?? 0);
      y += 36;
      const ptsBg = ctx.createLinearGradient(0, y - 20, 0, y + 28);
      ptsBg.addColorStop(0, 'rgba(74,222,128,0.25)');
      ptsBg.addColorStop(1, 'rgba(74,222,128,0.08)');
      ctx.fillStyle = ptsBg;
      ctx.roundRect(16, y - 22, W - 32, 48, 10);
      ctx.fill();
      ctx.fillStyle = '#4ADE80';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${totalPts} pts`, W / 2, y + 14);
    }

    // ── Footer ──
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${displayName} · lloto-website.web.app`, W / 2, H - 18);

    // ── Download ──
    const link = document.createElement('a');
    link.download = `prediction-${match.homeTeam.replace(/\s+/g, '-')}-vs-${match.awayTeam.replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  private async loadImage(src: string): Promise<HTMLImageElement | null> {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      return new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload  = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
        img.src = objectUrl;
      });
    } catch {
      return null;
    }
  }

  /** Draws crest image or falls back to a circle with 3-letter team abbreviation */
  private drawCrest(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    teamName: string,
    cx: number,
    cy: number,
    radius: number
  ): void {
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
    } else {
      // Fallback: circle + 3-letter abbreviation
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(radius * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(teamName.slice(0, 3).toUpperCase(), cx, cy);
      ctx.textBaseline = 'alphabetic';
    }
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }
}