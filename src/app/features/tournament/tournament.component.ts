import { Component, DestroyRef, inject, signal } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TournamentService } from '../../core/services/tournament.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { TournamentChallenge, TournamentPrediction } from '../../core/models/tournament-challenge.model';

interface ChallengeRow {
  challenge: TournamentChallenge;
  prediction?: TournamentPrediction;
}

@Component({
  selector: 'app-tournament',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './tournament.component.html',
  styleUrl: './tournament.component.css'
})
export class TournamentComponent {
  private authService = inject(AuthService);
  private tournamentService = inject(TournamentService);
  private statisticsService = inject(StatisticsService);
  private destroyRef = inject(DestroyRef);

  isAdmin$ = this.authService.user$.pipe(
    switchMap((user) => user ? this.statisticsService.getProfile(user.uid) : of(null)),
    map((profile) => profile?.isAdmin === true)
  );

  rows$ = combineLatest([
    this.tournamentService.getChallenges(),
    this.tournamentService.getMyPredictions()
  ]).pipe(
    map(([challenges, predictions]): ChallengeRow[] => {
      const predMap = new Map(predictions.map((p) => [p.challengeId, p]));
      return challenges.map((c) => ({ challenge: c, prediction: predMap.get(c.id) }));
    })
  );

  selecting = signal<string | null>(null);    // challengeId ku po zgjedhim
  selectedChoice = signal<string>('');
  saving = signal(false);
  claiming = signal<string | null>(null);     // predictionId duke u pretenduar
  resolvingId = signal<string | null>(null);
  resolveChoice = signal<string>('');
  resolveResult = signal<{ winners: number; challengeId: string } | null>(null);

  isLocked(challenge: TournamentChallenge): boolean {
    return challenge.status !== 'open' || challenge.deadline <= Date.now();
  }

  startSelect(challengeId: string): void {
    this.selecting.set(challengeId);
    this.selectedChoice.set('');
  }

  async submitPrediction(challengeId: string): Promise<void> {
    if (!this.selectedChoice()) return;
    this.saving.set(true);
    try {
      await this.tournamentService.submitPrediction(challengeId, this.selectedChoice());
      this.selecting.set(null);
    } finally {
      this.saving.set(false);
    }
  }

  async claimPoints(prediction: TournamentPrediction): Promise<void> {
    this.claiming.set(prediction.id);
    try {
      await this.tournamentService.claimPoints(prediction.id, prediction.tournamentPoints!);
    } finally {
      this.claiming.set(null);
    }
  }

  startResolve(challengeId: string): void {
    this.resolvingId.set(challengeId);
    this.resolveChoice.set('');
  }

  async confirmResolve(challengeId: string): Promise<void> {
    if (!this.resolveChoice()) return;
    this.saving.set(true);
    try {
      const winners = await this.tournamentService.resolveChallenge(challengeId, this.resolveChoice());
      this.resolveResult.set({ winners, challengeId });
      this.resolvingId.set(null);
    } finally {
      this.saving.set(false);
    }
  }
}