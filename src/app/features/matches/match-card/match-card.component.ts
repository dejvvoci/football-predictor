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
  /** Kur jepet, parashikimi është i veçantë për këtë grup (pikët shkojnë vetëm te leaderboard i tij) */
  @Input() groupId?: string;

  private predictionService = inject(PredictionService);
  private destroyRef = inject(DestroyRef);

  prediction = signal<PredictionLike | undefined>(undefined);
  choice = signal<PredictionChoice | null>(null);
  exactHome = signal<number | null>(null);
  exactAway = signal<number | null>(null);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

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
      }
    });
  }

  selectChoice(choice: PredictionChoice): void {
    this.choice.set(choice);
  }

  pointsFor(choice: PredictionChoice): number {
    const odds =
      choice === '1' ? this.match.odds.home : choice === 'X' ? this.match.odds.draw : this.match.odds.away;
    return Math.floor(odds);
  }

  /** Kthen '1'/'X'/'2' në emrin real të skuadrës (ose "Barazim") — për mesazhin "Parashikimi yt: ..." */
  choiceLabel(choice: PredictionChoice): string {
    if (choice === '1') return this.match.homeTeam;
    if (choice === '2') return this.match.awayTeam;
    return 'Barazim';
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

  /** Kur të dyja fushat e rezultatit të saktë janë plotësuara, zgjedh vetë 1/X/2 përkatësisht */
  private autoSelectChoiceFromScore(): void {
    const home = this.exactHome();
    const away = this.exactAway();
    if (home === null || away === null) return;

    if (home > away) {
      this.choice.set('1');
    } else if (home < away) {
      this.choice.set('2');
    } else {
      this.choice.set('X');
    }
  }

  async submit(): Promise<void> {
    const choice = this.choice();
    if (!choice) {
      this.errorMessage.set('Zgjidh 1, X ose 2 para se të dërgosh.');
      return;
    }

    const home = this.exactHome();
    const away = this.exactAway();
    const exactScore = home !== null && away !== null && home >= 0 && away >= 0 ? { home, away } : undefined;

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      if (this.groupId) {
        await this.predictionService.submitGroupPrediction(this.groupId, this.match.id, choice, exactScore);
      } else {
        await this.predictionService.submitPrediction(this.match.id, choice, exactScore);
      }
    } catch {
      this.errorMessage.set("S'u ruajt dot parashikimi. Provo përsëri.");
    } finally {
      this.saving.set(false);
    }
  }
}