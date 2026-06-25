import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { ChallengeService } from '../../../core/services/challenge.service';
import { CareerPathData, DailyChallengeV2 } from '../../../core/models/challenge.model';
import { Subscription } from 'rxjs';

const MAX_ATTEMPTS = 6;

@Component({
  selector: 'app-career-challenge',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './career-challenge.component.html',
  styleUrl: './career-challenge.component.css'
})
export class CareerChallengeComponent implements OnInit, OnDestroy {
  private service = inject(ChallengeService);
  private sub?: Subscription;

  challenge = signal<DailyChallengeV2<CareerPathData> | null | undefined>(undefined);
  leaderboard$ = this.service.getLeaderboard('career');
  guesses = signal<string[]>([]);
  inputValue = signal('');
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  activeTab = signal<'game' | 'leaderboard'>('game');
  startTime = Date.now();
  attemptsArray = Array.from({ length: MAX_ATTEMPTS });

  wrongGuesses = computed(() => {
    const answer = this.challenge()?.data.playerName ?? '';
    return this.guesses().filter(g => !this.service.isCorrect(g, answer));
  });

  // Clubs revealed progressively after each wrong guess
  clubsRevealed = computed(() => {
    const clubs = this.challenge()?.data.clubs ?? [];
    const revealed = Math.min(this.wrongGuesses().length + 2, clubs.length);
    if (this.gameState() !== 'playing') return clubs.length;
    return revealed;
  });

  ngOnInit(): void {
    this.sub = this.service.getChallenge<CareerPathData>('career').subscribe(ch => {
      this.challenge.set(ch ?? null);
    });
    this.service.getMyResult('career').subscribe(r => {
      if (r) this.gameState.set(r.solved ? 'won' : 'lost');
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async guess(): Promise<void> {
    const input = this.inputValue().trim();
    if (!input || this.gameState() !== 'playing') return;
    const answer = this.challenge()?.data.playerName ?? '';
    if (this.guesses().some(g => this.service.normalise(g) === this.service.normalise(input))) return;

    const newGuesses = [...this.guesses(), input];
    this.guesses.set(newGuesses);
    this.inputValue.set('');

    if (this.service.isCorrect(input, answer)) {
      this.gameState.set('won');
      await this.service.submitResult('career', true, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    } else if (newGuesses.length >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult('career', false, newGuesses.length, Math.floor((Date.now() - this.startTime) / 1000));
    }
  }

  onKeydown(e: KeyboardEvent): void { if (e.key === 'Enter') this.guess(); }
  onInput(e: Event): void { this.inputValue.set((e.target as HTMLInputElement).value); }
  isWrongGuess(g: string): boolean { return !this.service.isCorrect(g, this.challenge()?.data.playerName ?? ''); }
}
