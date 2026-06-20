import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Match } from '../../../core/models/match.model';
import { Prediction, PredictionChoice } from '../../../core/models/prediction.model';
import { PredictionService } from '../../../core/services/prediction.service';

@Component({
  selector: 'app-match-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './match-card.component.html',
  styleUrl: './match-card.component.css'
})
export class MatchCardComponent implements OnInit {
  @Input({ required: true }) match!: Match;

  private predictionService = inject(PredictionService);
  private destroyRef = inject(DestroyRef);

  prediction = signal<Prediction | undefined>(undefined);
  choice = signal<PredictionChoice | null>(null);
  exactHome = signal<number | null>(null);
  exactAway = signal<number | null>(null);
  saving = signal(false);
  errorMessage = signal<string | null>(null);

  locked = computed(() => this.match.status !== 'scheduled' || this.match.kickoff <= Date.now());

  ngOnInit(): void {
    this.predictionService
      .getPredictionForMatch(this.match.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((existing) => {
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

  onExactHomeChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.exactHome.set(value === '' ? null : Number(value));
  }

  onExactAwayChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.exactAway.set(value === '' ? null : Number(value));
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
      await this.predictionService.submitPrediction(this.match.id, choice, exactScore);
    } catch {
      this.errorMessage.set("S'u ruajt dot parashikimi. Provo përsëri.");
    } finally {
      this.saving.set(false);
    }
  }
}