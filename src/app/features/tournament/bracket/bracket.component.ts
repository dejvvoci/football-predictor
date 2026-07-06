import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { of, switchMap, map } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StatisticsService } from '../../../core/services/statistics.service';
import { BracketService } from '../../../core/services/bracket.service';
import { Bracket, BracketMatchup, BracketRoundName, BRACKET_ROUND_LABELS } from '../../../core/models/bracket.model';
import { buildBracketRounds, cleanBracketPicks, isBracketComplete } from '../../../core/utils/bracket-utils';

@Component({
  selector: 'app-bracket',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './bracket.component.html',
  styleUrl: './bracket.component.css'
})
export class BracketComponent {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);
  private statisticsService = inject(StatisticsService);
  private bracketService = inject(BracketService);
  private destroyRef = inject(DestroyRef);

  bracketId = this.route.snapshot.paramMap.get('id')!;

  isAdmin$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.statisticsService.getProfile(user.uid) : of(null))),
    map((profile) => profile?.isAdmin === true)
  );

  bracket = toSignal(this.bracketService.getBracket(this.bracketId), { initialValue: undefined });
  myPrediction = toSignal(this.bracketService.getMyPrediction(this.bracketId), { initialValue: undefined });

  roundLabels = BRACKET_ROUND_LABELS;
  activeTab = signal<'bracket' | 'leaderboard'>('bracket');
  picks = signal<Record<string, string>>({});
  saving = signal(false);
  claiming = signal(false);
  grading = signal<BracketRoundName | null>(null);
  errorMessage = signal<string | null>(null);
  savedMessage = signal(false);
  private initialisedFor: string | null = null;

  locked = computed(() => {
    const b = this.bracket();
    return !b || b.deadline <= Date.now() || b.status !== 'open';
  });

  displayRounds = computed<BracketMatchup[][]>(() => {
    const b = this.bracket();
    if (!b) return [];
    const source = this.locked() ? (this.myPrediction()?.picks ?? {}) : this.picks();
    return buildBracketRounds(b, source);
  });

  complete = computed(() => {
    const b = this.bracket();
    if (!b) return false;
    return isBracketComplete(b, this.picks());
  });

  leaderboard$ = this.bracketService.getLeaderboard(this.bracketId);

  constructor() {
    // Fillo formularin lokal me picks e ruajtura, herën e parë që mbërrijnë
    this.bracketService.getMyPrediction(this.bracketId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((pred) => {
      if (pred && this.initialisedFor !== this.bracketId) {
        this.picks.set(pred.picks);
        this.initialisedFor = this.bracketId;
      }
    });
  }

  selectWinner(matchup: BracketMatchup, teamName: string): void {
    if (this.locked()) return;
    const b = this.bracket();
    if (!b) return;
    const next = { ...this.picks(), [matchup.id]: teamName };
    this.picks.set(cleanBracketPicks(b, next));
  }

  async submit(): Promise<void> {
    if (!this.complete() || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    this.savedMessage.set(false);
    try {
      await this.bracketService.submitBracket(this.bracketId, this.picks());
      this.savedMessage.set(true);
    } catch (e) {
      this.errorMessage.set(e instanceof Error ? e.message : "S'u ruajt dot bracket-i.");
    } finally {
      this.saving.set(false);
    }
  }

  async claim(): Promise<void> {
    const pred = this.myPrediction();
    if (!pred || !pred.totalPoints || this.claiming()) return;
    this.claiming.set(true);
    try {
      await this.bracketService.claimPoints(pred.id, pred.totalPoints);
    } finally {
      this.claiming.set(false);
    }
  }

  async gradeRound(round: BracketRoundName): Promise<void> {
    if (this.grading()) return;
    this.grading.set(round);
    try {
      await this.bracketService.gradeRound(this.bracketId, round);
    } finally {
      this.grading.set(null);
    }
  }

  isResolved(round: BracketRoundName): boolean {
    return (this.bracket()?.resolvedRounds ?? []).includes(round);
  }

  roundOf(round: BracketMatchup[]): BracketRoundName {
    return round[0].round;
  }
}
