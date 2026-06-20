import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { Prediction } from '../../../core/models/prediction.model';
import { Match } from '../../../core/models/match.model';
import { MatchService } from '../../../core/services/match.service';

@Component({
  selector: 'app-history-item',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './history-item.component.html',
  styleUrl: './history-item.component.css'
})
export class HistoryItemComponent implements OnInit {
  @Input({ required: true }) prediction!: Prediction;

  private matchService = inject(MatchService);
  private destroyRef = inject(DestroyRef);

  match = signal<Match | undefined>(undefined);

  ngOnInit(): void {
    this.matchService
      .getMatchById(this.prediction.matchId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((match) => this.match.set(match));
  }
}