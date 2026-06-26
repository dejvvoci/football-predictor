import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { combineLatest } from 'rxjs';
import { TablePredictionService } from '../../core/services/table-prediction.service';
import { TablePrediction, TableSeason, TableTeam, COMP_FLAGS } from '../../core/models/table-prediction.model';

@Component({
  selector: 'app-predict-table-detail',
  standalone: true,
  imports: [RouterLink, AsyncPipe, DatePipe, DragDropModule],
  templateUrl: './predict-table-detail.component.html',
  styleUrl: './predict-table-detail.component.css'
})
export class PredictTableDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private service = inject(TablePredictionService);
  private destroyRef = inject(DestroyRef);

  flags = COMP_FLAGS;

  season = signal<TableSeason | null | undefined>(undefined);
  myPrediction = signal<TablePrediction | null | undefined>(undefined);

  // Mutable ordered list for drag-and-drop
  orderedTeams = signal<TableTeam[]>([]);

  activeTab = signal<'predict' | 'standings' | 'leaderboard'>('predict');
  saving = signal(false);
  saved = signal(false);

  code = '';
  seasonYear = 0;

  isOpen = computed(() => {
    const s = this.season();
    return s ? Date.now() < s.deadline : false;
  });

  // Comparison: predicted position vs actual
  comparison = computed(() => {
    const pred = this.myPrediction();
    const s = this.season();
    if (!pred || !s || s.currentStandings.length === 0) return [];

    return s.currentStandings.map((entry) => {
      const predictedPos = pred.prediction.findIndex(
        n => n.toLowerCase() === entry.teamShortName.toLowerCase()
      ) + 1;
      const diff = predictedPos - entry.position;
      return { ...entry, predictedPos, diff };
    });
  });

  leaderboard$ = computed(() =>
    this.service.getLeaderboard(this.code, this.seasonYear)
  );

  ngOnInit(): void {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.seasonYear = Number(this.route.snapshot.paramMap.get('season') ?? 0);

    combineLatest([
      this.service.getSeason(this.code, this.seasonYear),
      this.service.getMyPrediction(this.code, this.seasonYear)
    ]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([season, pred]) => {
      this.season.set(season ?? null);
      this.myPrediction.set(pred ?? null);

      if (season && this.orderedTeams().length === 0) {
        if (pred) {
          // Restore saved order
          const ordered = pred.prediction
            .map(name => season.teams.find(t => t.shortName === name))
            .filter((t): t is TableTeam => !!t);
          // Add any teams not in prediction (shouldn't happen but safety)
          const rest = season.teams.filter(t => !ordered.includes(t));
          this.orderedTeams.set([...ordered, ...rest]);
        } else {
          this.orderedTeams.set([...season.teams]);
        }
      }
    });
  }

  onDrop(event: CdkDragDrop<TableTeam[]>): void {
    const arr = [...this.orderedTeams()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.orderedTeams.set(arr);
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const arr = [...this.orderedTeams()];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.orderedTeams.set(arr);
  }

  moveDown(index: number): void {
    const arr = this.orderedTeams();
    if (index === arr.length - 1) return;
    const copy = [...arr];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    this.orderedTeams.set(copy);
  }

  async save(): Promise<void> {
    const s = this.season();
    if (!s || this.saving()) return;
    this.saving.set(true);
    try {
      await this.service.savePrediction(s, this.orderedTeams().map(t => t.shortName));
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } finally {
      this.saving.set(false);
    }
  }

  diffLabel(diff: number): string {
    if (diff === 0) return '=';
    return diff > 0 ? `▼${diff}` : `▲${Math.abs(diff)}`;
  }

  diffClass(diff: number): string {
    if (diff === 0) return 'same';
    return diff > 0 ? 'below' : 'above';
  }
}
