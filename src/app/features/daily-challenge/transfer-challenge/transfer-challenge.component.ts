import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ChallengeService } from '../../../core/services/challenge.service';
import { TransferQuizData, DailyChallengeV2 } from '../../../core/models/challenge.model';
import { Subscription } from 'rxjs';

const MAX_ATTEMPTS = 6;

@Component({
  selector: 'app-transfer-challenge',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './transfer-challenge.component.html',
  styleUrl: './transfer-challenge.component.css'
})
export class TransferChallengeComponent implements OnInit, OnDestroy {
  private service = inject(ChallengeService);
  private sub?: Subscription;

  challenge = signal<DailyChallengeV2<TransferQuizData> | null | undefined>(undefined);
  leaderboard$ = this.service.getLeaderboard('transfer');
  guesses = signal<string[]>([]);
  inputValue = signal('');
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  activeTab = signal<'game' | 'leaderboard'>('game');
  startTime = Date.now();
  attemptsArray = Array.from({ length: MAX_ATTEMPTS });

  wrongGuesses = computed(() => {
    const answer = this.challenge()?.data.player ?? '';
    return this.guesses().filter(g => !this.service.isCorrect(g, answer));
  });

  // Progressive hints: fee shown after 1st wrong, "free transfer" hint after 3rd
  showFee = computed(() => this.wrongGuesses().length >= 1 || this.gameState() !== 'playing');
  showExtra = computed(() => this.wrongGuesses().length >= 3 || this.gameState() !== 'playing');

  ngOnInit(): void {
    this.sub = this.service.getChallenge<TransferQuizData>('transfer').subscribe(ch => {
      this.challenge.set(ch ?? null);
    });
    this.service.getMyResult('transfer').subscribe(r => {
      if (r) this.gameState.set(r.solved ? 'won' : 'lost');
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async guess(): Promise<void> {
    const input = this.inputValue().trim();
    if (!input || this.gameState() !== 'playing') return;
    const answer = this.challenge()?.data.player ?? '';
    if (this.guesses().some(g => this.service.normalise(g) === this.service.normalise(input))) return;

    const newGuesses = [...this.guesses(), input];
    this.guesses.set(newGuesses);
    this.inputValue.set('');

    if (this.service.isCorrect(input, answer)) {
      this.gameState.set('won');
      await this.service.submitResult('transfer', true, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult('transfer', false, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    }
  }

  formatFee(fee: number): string {
    if (fee === 0) return 'Free transfer';
    return `€${fee}M`;
  }

  onKeydown(e: KeyboardEvent): void { if (e.key === 'Enter') this.guess(); }
  onInput(e: Event): void { this.inputValue.set((e.target as HTMLInputElement).value); }
  isWrongGuess(g: string): boolean { return !this.service.isCorrect(g, this.challenge()?.data.player ?? ''); }
}
