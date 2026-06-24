import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { DailyChallengeService } from '../../core/services/daily-challenge.service';
import { DailyChallenge, DailyPlayer } from '../../core/models/daily-challenge.model';
import { Subscription } from 'rxjs';

const CLUE_ORDER: (keyof DailyPlayer)[] = ['nationality', 'position', 'club', 'birthYear'];
const MAX_ATTEMPTS = 6;

@Component({
  selector: 'app-daily-challenge',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  templateUrl: './daily-challenge.component.html',
  styleUrl: './daily-challenge.component.css'
})
export class DailyChallengeComponent implements OnInit, OnDestroy {
  private service = inject(DailyChallengeService);
  private sub?: Subscription;

  today = this.service.today();
  leaderboard$ = this.service.getLeaderboard();

  challenge = signal<DailyChallenge | null | undefined>(undefined);
  myResult$ = this.service.getMyResult();

  // Game state
  guesses = signal<string[]>([]);
  inputValue = signal('');
  suggestions = signal<string[]>([]);
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  startTime = Date.now();
  submitting = signal(false);
  activeTab = signal<'game' | 'leaderboard'>('game');

  wrongGuesses = computed(() => this.guesses().filter(g => {
    const player = this.challenge()?.player;
    return !player || g.toLowerCase() !== player.name.toLowerCase();
  }));

  cluesRevealed = computed(() => Math.min(this.wrongGuesses().length, CLUE_ORDER.length));
  photoRevealed = computed(() => this.wrongGuesses().length >= 5);
  photoBlurred = computed(() => this.wrongGuesses().length < 5);

  ngOnInit(): void {
    this.sub = this.service.getTodaysChallenge().subscribe((ch) => {
      this.challenge.set(ch ?? null);
    });

    // Restore previous result if exists
    this.service.getMyResult().subscribe((result) => {
      if (result) {
        this.gameState.set(result.solved ? 'won' : 'lost');
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async onInput(event: Event): Promise<void> {
    const val = (event.target as HTMLInputElement).value;
    this.inputValue.set(val);
    if (val.length >= 2) {
      const results = await this.service.searchPlayers(val);
      this.suggestions.set(results);
    } else {
      this.suggestions.set([]);
    }
  }

  selectSuggestion(name: string): void {
    this.inputValue.set(name);
    this.suggestions.set([]);
  }

  async guess(): Promise<void> {
    const input = this.inputValue().trim();
    if (!input || this.gameState() !== 'playing') return;

    const player = this.challenge()?.player;
    if (!player) return;

    // Prevent duplicate guesses
    if (this.guesses().some(g => g.toLowerCase() === input.toLowerCase())) return;

    const newGuesses = [...this.guesses(), input];
    this.guesses.set(newGuesses);
    this.inputValue.set('');
    this.suggestions.set([]);

    const correct = input.toLowerCase() === player.name.toLowerCase();
    const attempts = newGuesses.length;

    if (correct) {
      this.gameState.set('won');
      await this.service.submitResult(true, attempts, Math.floor((Date.now() - this.startTime) / 1000));
    } else if (attempts >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult(false, attempts, Math.floor((Date.now() - this.startTime) / 1000));
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.guess();
  }

  isCorrectGuess(g: string): boolean {
    return g.toLowerCase() === (this.challenge()?.player.name ?? '').toLowerCase();
  }

  getClueValue(player: DailyPlayer, index: number): string {
    const key = CLUE_ORDER[index];
    if (key === 'birthYear') return `Born in ${player.birthYear}`;
    return String(player[key]);
  }

  getClueLabel(index: number): string {
    const labels: Record<string, string> = {
      nationality: '🌍 Nationality',
      position: '📌 Position',
      club: '🏟 Club',
      birthYear: '🎂 Age'
    };
    return labels[CLUE_ORDER[index]] ?? '';
  }

  attemptsArray = Array.from({ length: MAX_ATTEMPTS });
}