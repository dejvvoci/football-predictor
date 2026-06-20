import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { PredictionService } from '../../../core/services/prediction.service';
import { MatchService } from '../../../core/services/match.service';
import { Prediction } from '../../../core/models/prediction.model';
import { Match } from '../../../core/models/match.model';

interface NotificationItem {
  predictionId: string;
  homeTeam: string;
  awayTeam: string;
  choice: string;
  points: number;
}

@Component({
  selector: 'app-grading-popup',
  standalone: true,
  templateUrl: './grading-popup.component.html',
  styleUrl: './grading-popup.component.css'
})
export class GradingPopupComponent implements OnInit {
  private authService = inject(AuthService);
  private predictionService = inject(PredictionService);
  private matchService = inject(MatchService);
  private destroyRef = inject(DestroyRef);

  items = signal<NotificationItem[]>([]);
  visible = signal(false);

  ngOnInit(): void {
    this.authService.user$
      .pipe(
        switchMap((user) => (user ? this.predictionService.getUnseenGradedPredictions(user.uid) : of([]))),
        switchMap((predictions) => {
          if (predictions.length === 0) return of([] as { prediction: Prediction; match: Match | undefined }[]);

          const withMatches$ = predictions.map((p) =>
            this.matchService.getMatchById(p.matchId).pipe(map((match) => ({ prediction: p, match })))
          );
          return combineLatest(withMatches$);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((pairs) => {
        const items: NotificationItem[] = pairs
          .filter((pair) => !!pair.match)
          .map(({ prediction, match }) => ({
            predictionId: prediction.id,
            homeTeam: match!.homeTeam,
            awayTeam: match!.awayTeam,
            choice: prediction.choice,
            points: prediction.points ?? 0
          }));

        if (items.length > 0) {
          this.items.set(items);
          this.visible.set(true);
        }
      });
  }

  async dismiss(): Promise<void> {
    const ids = this.items().map((i) => i.predictionId);
    this.visible.set(false);
    await this.predictionService.markPredictionsSeen(ids);
  }
}