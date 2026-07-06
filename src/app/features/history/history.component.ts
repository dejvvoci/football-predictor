import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { from, of, switchMap, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PredictionService } from '../../core/services/prediction.service';
import { MatchService } from '../../core/services/match.service';
import { Match } from '../../core/models/match.model';
import { Prediction } from '../../core/models/prediction.model';
import { HistoryItemComponent } from './history-item/history-item.component';

interface PredictionWithMatch {
  prediction: Prediction;
  match?: Match;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [HistoryItemComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  private authService = inject(AuthService);
  private predictionService = inject(PredictionService);
  private matchService = inject(MatchService);

  searchTerm = signal('');

  private recentPredictions$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.predictionService.getUserPredictions(user.uid, 20) : of([])))
  );

  private allPredictions$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.predictionService.getAllUserPredictions(user.uid) : of([])))
  );

  private recentWithMatches = toSignal(this.joinMatches(this.recentPredictions$), { initialValue: undefined });
  private allWithMatches = toSignal(this.joinMatches(this.allPredictions$), { initialValue: undefined });

  loading = computed(() => {
    const term = this.searchTerm().trim();
    return term ? this.allWithMatches() === undefined : this.recentWithMatches() === undefined;
  });

  results = computed<PredictionWithMatch[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();

    if (!term) {
      return this.recentWithMatches() ?? [];
    }

    const items = this.allWithMatches() ?? [];
    return items.filter(({ match }) => {
      if (!match) return false;
      return (
        match.homeTeam.toLowerCase().includes(term) ||
        match.awayTeam.toLowerCase().includes(term) ||
        match.competition.toLowerCase().includes(term)
      );
    });
  });

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
  }

  private joinMatches(predictions$: typeof this.recentPredictions$) {
    return predictions$.pipe(
      switchMap((predictions) =>
        from(this.matchService.getMatchesByIdsOnce(predictions.map((p) => p.matchId))).pipe(
          map((matches) => {
            const matchById = new Map(matches.map((m) => [m.id, m]));
            return predictions.map((prediction) => ({
              prediction,
              match: matchById.get(prediction.matchId)
            }));
          })
        )
      )
    );
  }
}
