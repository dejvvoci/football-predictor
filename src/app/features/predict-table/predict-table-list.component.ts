import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TablePredictionService } from '../../core/services/table-prediction.service';
import { COMP_FLAGS, TableSeason } from '../../core/models/table-prediction.model';

@Component({
  selector: 'app-predict-table-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './predict-table-list.component.html',
  styleUrl: './predict-table-list.component.css'
})
export class PredictTableListComponent {
  private service = inject(TablePredictionService);
  flags = COMP_FLAGS;

  activeTab = signal<'open' | 'history'>('open');

  private seasons = toSignal(this.service.getActiveSeasons(), { initialValue: undefined });

  openSeasons = computed(() => (this.seasons() ?? []).filter((s) => this.isOpen(s.deadline)));
  historySeasons = computed(() =>
    (this.seasons() ?? [])
      .filter((s) => !this.isOpen(s.deadline))
      .sort((a, b) => b.deadline - a.deadline)
  );

  loading = computed(() => this.seasons() === undefined);

  isOpen(deadline: number): boolean {
    return Date.now() < deadline;
  }

  isFinished(s: TableSeason): boolean {
    if (s.currentStandings.length === 0) return false;
    const totalRounds = (s.teams.length - 1) * 2;
    return s.currentStandings.every((t) => t.playedGames >= totalRounds);
  }
}
