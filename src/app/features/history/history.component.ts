import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PredictionService } from '../../core/services/prediction.service';
import { HistoryItemComponent } from './history-item/history-item.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [AsyncPipe, HistoryItemComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent {
  private authService = inject(AuthService);
  private predictionService = inject(PredictionService);

  predictions$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.predictionService.getUserPredictions(user.uid) : of([])))
  );
}