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
  resolvedThumbnail = signal<string | null>(null);
  myResult$ = this.service.getMyResult();

  // Game state
  guesses = signal<string[]>([]);
  inputValue = signal('');
  suggestions = signal<string[]>([]);
  gameState = signal<'playing' | 'won' | 'lost'>('playing');
  restoredAttempts = signal(0);
  startTime = Date.now();
  submitting = signal(false);
  activeTab = signal<'game' | 'leaderboard'>('game');

  wrongGuesses = computed(() => this.guesses().filter(g => {
    const player = this.challenge()?.player;
    return !player || g.toLowerCase() !== player.name.toLowerCase();
  }));

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

  cluesRevealed = computed(() => Math.min(this.wrongGuesses().length, CLUE_ORDER.length));
  photoRevealed = computed(() => this.wrongGuesses().length >= 5);
  photoBlurred = computed(() => this.wrongGuesses().length < 5);

  ngOnInit(): void {
    this.sub = this.service.getTodaysChallenge().subscribe(async (ch) => {
      this.challenge.set(ch ?? null);
      // If game was already finished before this page load, load thumbnail now
      if (ch?.player && this.gameState() !== 'playing') {
        await this.tryLoadThumbnail(ch.player);
      }
    });

    this.service.getMyResult().subscribe(async (result) => {
      if (result) {
        this.gameState.set(result.solved ? 'won' : 'lost');
        this.restoredAttempts.set(result.attempts ?? 0);
        const player = this.challenge()?.player;
        if (player) await this.tryLoadThumbnail(player);
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
      await this.tryLoadThumbnail(player);
    } else if (attempts >= MAX_ATTEMPTS) {
      this.gameState.set('lost');
      await this.service.submitResult(false, attempts, Math.floor((Date.now() - this.startTime) / 1000));
      await this.tryLoadThumbnail(player);
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

  private async tryLoadThumbnail(player: DailyPlayer): Promise<void> {
    if (player.thumbnail) {
      this.resolvedThumbnail.set(player.thumbnail);
      return;
    }

    // 1. Try TheSportsDB
    try {
      const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(player.name)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { players?: Record<string, string>[] };
        const p = data.players?.[0];
        const img = p?.['strThumb'] || p?.['strCutout'] || p?.['strRender'] || p?.['strFanart1'];
        if (img) { this.resolvedThumbnail.set(img); return; }
      }
    } catch { /* try next */ }

    // 2. Try Wikipedia
    try {
      const wikiTitle = encodeURIComponent(player.name.replace(/ /g, '_'));
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${wikiTitle}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } };
        const pages = data.query?.pages ?? {};
        const page = Object.values(pages)[0];
        const img = page?.thumbnail?.source;
        if (img) { this.resolvedThumbnail.set(img); return; }
      }
    } catch { /* no photo available */ }
  }

  attemptsArray = Array.from({ length: MAX_ATTEMPTS });
}