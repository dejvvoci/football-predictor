import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatchService } from '../../core/services/match.service';
import { MatchCardComponent } from './match-card/match-card.component';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [MatchCardComponent],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.css'
})
export class MatchesComponent {
  private matchService = inject(MatchService);

  private matches = toSignal(this.matchService.getTodayMatches(), { initialValue: null });

  selectedCompetition = signal<string>('all');

  /** Lista e kompeticioneve të pranishme sot, e nxjerrë nga vetë ndeshjet — gjithmonë e përditësuar */
  competitions = computed(() => {
    const matches = this.matches();
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.competition))).sort();
  });

  filteredMatches = computed(() => {
    const matches = this.matches();
    if (!matches) return null;

    const selected = this.selectedCompetition();
    return selected === 'all' ? matches : matches.filter((m) => m.competition === selected);
  });

  selectCompetition(value: string): void {
    this.selectedCompetition.set(value);
  }
}