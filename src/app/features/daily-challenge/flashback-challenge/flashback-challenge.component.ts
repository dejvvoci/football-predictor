import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ChallengeService } from '../../../core/services/challenge.service';
import { FlashbackData, DailyChallengeV2 } from '../../../core/models/challenge.model';
import { Subscription } from 'rxjs';

const MAX_ATTEMPTS = 6;

@Component({
  selector: 'app-flashback-challenge',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './flashback-challenge.component.html',
  styleUrl: './flashback-challenge.component.css'
})
export class FlashbackChallengeComponent implements OnInit, OnDestroy {
  private service = inject(ChallengeService);
  private sub?: Subscription;

  challenge = signal<DailyChallengeV2<FlashbackData> | null | undefined>(undefined);
  leaderboard$ = this.service.getLeaderboard('flashback');

  homeInput = signal<number | null>(null);
  awayInput = signal<number | null>(null);
  guesses = signal<{ home: number; away: number }[]>([]);
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  activeTab = signal<'game' | 'leaderboard'>('game');
  startTime = Date.now();
  attemptsArray = Array.from({ length: MAX_ATTEMPTS });

  wrongGuesses = computed(() =>
    this.guesses().filter(g => {
      const d = this.challenge()?.data;
      return !d || g.home !== d.homeGoals || g.away !== d.awayGoals;
    })
  );

  // Hints revealed after each wrong guess
  showTotalGoals = computed(() => this.wrongGuesses().length >= 1 || this.gameState() !== 'playing');
  showOutcome    = computed(() => this.wrongGuesses().length >= 2 || this.gameState() !== 'playing');
  showHtScore    = computed(() => this.wrongGuesses().length >= 3 || this.gameState() !== 'playing');
  showHomeGoals  = computed(() => this.wrongGuesses().length >= 4 || this.gameState() !== 'playing');

  outcome(d: FlashbackData): string {
    if (d.homeGoals > d.awayGoals) return `${d.homeTeam} won`;
    if (d.homeGoals < d.awayGoals) return `${d.awayTeam} won`;
    return 'Draw';
  }

  ngOnInit(): void {
    this.sub = this.service.getChallenge<FlashbackData>('flashback').subscribe(ch => {
      this.challenge.set(ch ?? null);
    });
    this.service.getMyResult('flashback').subscribe(r => {
      if (r) this.gameState.set(r.solved ? 'won' : 'lost');
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  onHomeInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.homeInput.set(v === '' ? null : +v);
  }

  onAwayInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.awayInput.set(v === '' ? null : +v);
  }

  async guess(): Promise<void> {
    const home = this.homeInput();
    const away = this.awayInput();
    if (home === null || away === null || this.gameState() !== 'playing') return;

    const d = this.challenge()?.data;
    if (!d) return;

    const newGuesses = [...this.guesses(), { home, away }];
    this.guesses.set(newGuesses);
    this.homeInput.set(null);
    this.awayInput.set(null);

    const correct = home === d.homeGoals && away === d.awayGoals;
    if (correct) {
      this.gameState.set('won');
      await this.service.submitResult('flashback', true, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult('flashback', false, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    }
  }

  isWrongGuess(g: { home: number; away: number }): boolean {
    const d = this.challenge()?.data;
    return !d || g.home !== d.homeGoals || g.away !== d.awayGoals;
  }
}
