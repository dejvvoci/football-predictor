import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { Match } from '../../../core/models/match.model';
import { PredictionChoice } from '../../../core/models/prediction.model';
import { PredictionService } from '../../../core/services/prediction.service';

interface PredictionLike {
  choice: PredictionChoice;
  exactScore?: { home: number; away: number };
  overUnder?: 'over' | 'under';
  htFt?: string;
  btts?: boolean;
  redCard?: boolean;
  firstGoalscorer?: string;
  points?: number;
}

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './match-card.component.html',
  styleUrl: './match-card.component.css'
})
export class MatchCardComponent implements OnInit {
  @Input({ required: true }) match!: Match;
  @Input() groupId?: string;

  private predictionService = inject(PredictionService);
  private destroyRef = inject(DestroyRef);

  prediction = signal<PredictionLike | undefined>(undefined);
  choice = signal<PredictionChoice | null>(null);
  exactHome = signal<number | null>(null);
  exactAway = signal<number | null>(null);
  overUnder = signal<'over' | 'under' | null>(null);
  htFt = signal<string | null>(null);
  btts = signal<boolean | null>(null);
  redCard = signal<boolean | null>(null);
  firstGoalscorer = signal<string>('');
  firstGoalscorerSuggestions = signal<string[]>([]);
  firstGoalscorerLoading = signal(false);
  saving = signal(false);
  errorMessage = signal<string | null>(null);
  savedMessage = signal(false);
  showIncompleteScoreWarning = signal(false);
  showBonusPanel = signal(false);
  editMode = signal(false);

  locked = computed(() => this.match.status !== 'scheduled' || this.match.kickoff <= Date.now());

  ngOnInit(): void {
    const prediction$: Observable<PredictionLike | undefined> = this.groupId
      ? this.predictionService.getGroupPredictionForMatch(this.groupId, this.match.id)
      : this.predictionService.getPredictionForMatch(this.match.id);

    prediction$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((existing) => {
      this.prediction.set(existing);
      if (existing) {
        this.choice.set(existing.choice);
        this.exactHome.set(existing.exactScore?.home ?? null);
        this.exactAway.set(existing.exactScore?.away ?? null);
        this.overUnder.set(existing.overUnder ?? null);
        this.htFt.set(existing.htFt ?? null);
        this.btts.set(existing.btts ?? null);
        this.redCard.set(existing.redCard ?? null);
        this.firstGoalscorer.set((existing as any).firstGoalscorer ?? '');
        this.showBonusPanel.set(true);
      }
    });
  }

  selectChoice(c: PredictionChoice): void {
    this.choice.set(c);
    // Clear htFt if FT part doesn't match new choice
    const current = this.htFt();
    if (current && !current.endsWith('/' + c)) {
      this.htFt.set(null);
    }
  }

  pointsFor(c: PredictionChoice): number {
    const odds = c === '1' ? this.match.odds.home : c === 'X' ? this.match.odds.draw : this.match.odds.away;
    return Math.floor(odds);
  }

  choiceLabel(c: PredictionChoice): string {
    if (c === '1') return this.match.homeTeam;
    if (c === '2') return this.match.awayTeam;
    return 'Draw';
  }

  onExactHomeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.exactHome.set(value === '' ? null : Number(value));
    this.autoSelectChoiceFromScore();
  }

  onExactAwayChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.exactAway.set(value === '' ? null : Number(value));
    this.autoSelectChoiceFromScore();
  }

  ouLockedByScore = computed(() =>
    this.exactHome() !== null && this.exactAway() !== null && !!this.match.ouOdds
  );

  bttsLockedByScore = computed(() =>
    this.exactHome() !== null && this.exactAway() !== null
  );

  private autoSelectChoiceFromScore(): void {
    const home = this.exactHome();
    const away = this.exactAway();
    if (home === null || away === null) return;

    const derived: PredictionChoice = home > away ? '1' : home < away ? '2' : 'X';
    this.selectChoice(derived);

    // Auto-derive over/under from total goals vs the line
    if (this.match.ouOdds) {
      const total = home + away;
      this.overUnder.set(total > this.match.ouOdds.line ? 'over' : 'under');
    }

    // Auto-derive BTTS from exact score
    this.btts.set(home > 0 && away > 0);
  }

  // HT/FT: only combos whose FT part matches the current choice are enabled
  isHtFtEnabled(combo: string): boolean {
    const c = this.choice();
    return !!c && combo.endsWith('/' + c);
  }

  toggleHtFt(combo: string): void {
    this.htFt.set(this.htFt() === combo ? null : combo);
  }

  ouPointsFor(c: 'over' | 'under'): number {
    if (!this.match.ouOdds) return 0;
    return Math.floor(c === 'over' ? this.match.ouOdds.over : this.match.ouOdds.under);
  }

  readonly choices: PredictionChoice[] = ['1', 'X', '2'];

  readonly htFtCombinations = [
    ['1/1', '1/X', '1/2'],
    ['X/1', 'X/X', 'X/2'],
    ['2/1', '2/X', '2/2'],
  ] as const;

  async submit(): Promise<void> {
    const choice = this.choice();
    if (!choice) {
      this.errorMessage.set('Select Home / Draw / Away first.');
      return;
    }

    const home = this.exactHome();
    const away = this.exactAway();

    if ((home !== null) !== (away !== null)) {
      this.showIncompleteScoreWarning.set(true);
      return;
    }

    const exactScore = home !== null && away !== null ? { home, away } : undefined;
    const overUnder = this.overUnder() ?? undefined;
    const htFt = this.htFt() ?? undefined;
    const btts = this.btts() !== null ? this.btts()! : undefined;
    const redCard = this.redCard() !== null ? this.redCard()! : undefined;

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      if (this.groupId) {
        await this.predictionService.submitGroupPrediction(this.groupId, this.match.id, choice, exactScore);
      } else {
        await this.predictionService.submitPrediction(
          this.match.id, choice, exactScore, overUnder, htFt, btts, redCard,
          this.firstGoalscorer().trim() || undefined
        );
      }
      this.editMode.set(false);
      this.showBonusPanel.set(false);
    } catch {
      this.errorMessage.set("Couldn't save prediction. Please try again.");
    } finally {
      this.saving.set(false);
    }
  }

  getHtFt(p: PredictionLike): string | undefined { return (p as any).htFt; }
  getOverUnder(p: PredictionLike): 'over' | 'under' | undefined { return (p as any).overUnder; }
  getBtts(p: PredictionLike): boolean | undefined { return (p as any).btts; }
  getRedCard(p: PredictionLike): boolean | undefined { return (p as any).redCard; }
  getFirstGoalscorer(p: PredictionLike): string | undefined { return (p as any).firstGoalscorer; }

  async onFirstGoalscorerInput(event: Event): Promise<void> {
    const val = (event.target as HTMLInputElement).value;
    this.firstGoalscorer.set(val);
    this.firstGoalscorerSuggestions.set([]);
    if (val.length < 2) return;
    this.firstGoalscorerLoading.set(true);
    try {
      const res = await fetch(
        `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(val)}`
      );
      const data = await res.json() as { players?: { strPlayer: string }[] };
      this.firstGoalscorerSuggestions.set(
        (data.players ?? []).map(p => p.strPlayer).slice(0, 5)
      );
    } catch { /* silent */ } finally {
      this.firstGoalscorerLoading.set(false);
    }
  }

  selectGoalscorer(name: string): void {
    this.firstGoalscorer.set(name);
    this.firstGoalscorerSuggestions.set([]);
  }

  closeWarning(): void {
    this.showIncompleteScoreWarning.set(false);
  }
}