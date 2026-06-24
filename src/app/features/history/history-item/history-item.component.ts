import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { take, map } from 'rxjs';
import { PredictionChoice, ExactScoreGuess } from '../../../core/models/prediction.model';
import { Match } from '../../../core/models/match.model';
import { MatchService } from '../../../core/services/match.service';
import { ShareService } from '../../../core/services/share.service';
import { AuthService } from '../../../core/services/auth.service';

export interface PredictionLike {
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
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

@Component({
  selector: 'app-history-item',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './history-item.component.html',
  styleUrl: './history-item.component.css'
})
export class HistoryItemComponent implements OnInit {
  @Input({ required: true }) prediction!: PredictionLike;

  private matchService = inject(MatchService);
  private shareService = inject(ShareService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  match = signal<Match | undefined>(undefined);

  ngOnInit(): void {
    this.matchService
      .getMatchById(this.prediction.matchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((m) => this.match.set(m));
  }

  choiceLabel(choice: PredictionChoice, match: Match): string {
    if (choice === '1') return match.homeTeam;
    if (choice === '2') return match.awayTeam;
    return 'Draw';
  }

  isOutcomeCorrect(match: Match): boolean {
    if (!match.result) return false;
    const actual = match.result.homeGoals > match.result.awayGoals ? '1'
      : match.result.homeGoals < match.result.awayGoals ? '2' : 'X';
    return actual === this.prediction.choice;
  }

  isExactCorrect(match: Match): boolean {
    if (!match.result || !this.prediction.exactScore) return false;
    return this.prediction.exactScore.home === match.result.homeGoals
      && this.prediction.exactScore.away === match.result.awayGoals;
  }

  isHtFtCorrect(match: Match): boolean {
    if (!this.prediction.htFt || !match.result || !match.halfTimeResult) return false;
    const ht = match.halfTimeResult.homeGoals > match.halfTimeResult.awayGoals ? '1'
      : match.halfTimeResult.homeGoals < match.halfTimeResult.awayGoals ? '2' : 'X';
    const ft = match.result.homeGoals > match.result.awayGoals ? '1'
      : match.result.homeGoals < match.result.awayGoals ? '2' : 'X';
    return this.prediction.htFt === `${ht}/${ft}`;
  }

  totalPoints(): number {
    return (this.prediction.points ?? 0)
      + (this.prediction.ouPoints ?? 0)
      + (this.prediction.htFtPoints ?? 0)
      + (this.prediction.bttsPoints ?? 0)
      + (this.prediction.redCardPoints ?? 0);
  }

  share(): void {
    const m = this.match();
    if (!m) return;
    this.authService.user$.pipe(take(1), map((u) => u?.displayName ?? u?.email ?? 'Player'))
      .subscribe((name) => this.shareService.downloadPredictionCard(m, this.prediction, name));
  }
}