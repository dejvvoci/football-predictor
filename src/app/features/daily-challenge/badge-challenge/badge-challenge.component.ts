import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ChallengeService } from '../../../core/services/challenge.service';
import { BadgeChallengeData, DailyChallengeV2 } from '../../../core/models/challenge.model';
import { Subscription } from 'rxjs';

const MAX_ATTEMPTS = 6;
const CLUES: { label: string; key: keyof BadgeChallengeData }[] = [
  { label: '🌍 Country',     key: 'country' },
  { label: '🏆 Competition', key: 'competition' },
  { label: '📅 Founded',     key: 'founded' },
  { label: '🏟 Stadium',     key: 'venue' },
];

@Component({
  selector: 'app-badge-challenge',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './badge-challenge.component.html',
  styleUrl: './badge-challenge.component.css'
})
export class BadgeChallengeComponent implements OnInit, OnDestroy {
  private service = inject(ChallengeService);
  private sub?: Subscription;

  challenge = signal<DailyChallengeV2<BadgeChallengeData> | null | undefined>(undefined);
  leaderboard$ = this.service.getLeaderboard('badge');

  guesses = signal<string[]>([]);
  inputValue = signal('');
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  restoredAttempts = signal(0);
  activeTab = signal<'game' | 'leaderboard'>('game');
  startTime = Date.now();

  wrongGuesses = computed(() => {
    const answer = this.challenge()?.data.teamName ?? '';
    return this.guesses().filter(g => !this.service.isCorrect(g, answer));
  });

  cluesRevealed = computed(() => Math.min(this.wrongGuesses().length, CLUES.length));
  blurAmount = computed(() => {
    const wrongs = this.wrongGuesses().length;
    return Math.max(0, 16 - wrongs * 4); // 16→12→8→4→0px
  });

  clues = CLUES;
  attemptsArray = Array.from({ length: MAX_ATTEMPTS });

  displayAttempts = computed(() =>
    this.guesses().length > 0 ? this.guesses().length : this.restoredAttempts()
  );

  displayWrong = computed(() => {
    if (this.guesses().length > 0) return this.wrongGuesses().length;
    const state = this.gameState();
    const n = this.restoredAttempts();
    if (state === 'lost') return n;
    if (state === 'won') return Math.max(0, n - 1);
    return 0;
  });

  ngOnInit(): void {
    this.sub = this.service.getChallenge<BadgeChallengeData>('badge').subscribe(async (ch) => {
      this.challenge.set(ch ?? null);
    });
    this.service.getMyResult('badge').subscribe((r) => {
      if (r) { this.gameState.set(r.solved ? 'won' : 'lost'); this.restoredAttempts.set(r.attempts ?? 0); }
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async guess(): Promise<void> {
    const input = this.inputValue().trim();
    if (!input || this.gameState() !== 'playing') return;
    const answer = this.challenge()?.data.teamName ?? '';
    if (this.guesses().some(g => this.service.normalise(g) === this.service.normalise(input))) return;

    const newGuesses = [...this.guesses(), input];
    this.guesses.set(newGuesses);
    this.inputValue.set('');

    const correct = this.service.isCorrect(input, answer);
    if (correct) {
      this.gameState.set('won');
      await this.service.submitResult('badge', true, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult('badge', false, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    }
  }

  onKeydown(e: KeyboardEvent): void { if (e.key === 'Enter') this.guess(); }
  onInput(e: Event): void { this.inputValue.set((e.target as HTMLInputElement).value); }

  isWrongGuess(g: string): boolean {
    return !this.service.isCorrect(g, this.challenge()?.data.teamName ?? '');
  }
}