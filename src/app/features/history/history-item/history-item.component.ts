import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { PredictionChoice, ExactScoreGuess } from '../../../core/models/prediction.model';
import { Match } from '../../../core/models/match.model';
import { MatchService } from '../../../core/services/match.service';

export interface PredictionLike {
  matchId: string;
  choice: PredictionChoice;
  exactScore?: ExactScoreGuess;
  points?: number;
  htFt?: string;
  htFtPoints?: number;
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
  private destroyRef = inject(DestroyRef);

  match = signal<Match | undefined>(undefined);

  ngOnInit(): void {
    this.matchService
      .getMatchById(this.prediction.matchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((match) => this.match.set(match));
  }

  /** Kthen '1'/'X'/'2' në emrin real të skuadrës (ose "Barazim") */
  choiceLabel(choice: PredictionChoice, match: Match): string {
    if (choice === '1') return match.homeTeam;
    if (choice === '2') return match.awayTeam;
    return 'Barazim';
  }

  isOutcomeCorrect(match: Match): boolean {
    if (!match.result) return false;
    const actual =
      match.result.homeGoals > match.result.awayGoals ? '1' : match.result.homeGoals < match.result.awayGoals ? '2' : 'X';
    return actual === this.prediction.choice;
  }

  isHtFtCorrect(match: Match): boolean {
    if (!this.prediction.htFt || !match.result || !match.halfTimeResult) return false;
    const htOutcome = match.halfTimeResult.homeGoals > match.halfTimeResult.awayGoals ? '1'
      : match.halfTimeResult.homeGoals < match.halfTimeResult.awayGoals ? '2' : 'X';
    const ftOutcome = match.result.homeGoals > match.result.awayGoals ? '1'
      : match.result.homeGoals < match.result.awayGoals ? '2' : 'X';
    return this.prediction.htFt === `${htOutcome}/${ftOutcome}`;
  }

  isExactCorrect(match: Match): boolean {
    if (!match.result || !this.prediction.exactScore) return false;
    return (
      this.prediction.exactScore.home === match.result.homeGoals &&
      this.prediction.exactScore.away === match.result.awayGoals
    );
  }
}