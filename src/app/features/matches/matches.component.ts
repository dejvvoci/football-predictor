import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatchService } from '../../core/services/match.service';
import { MatchCardComponent } from './match-card/match-card.component';
import { Match } from '../../core/models/match.model';

interface MatchGroup {
  competition: string;
  matches: Match[];
}

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [MatchCardComponent],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.css'
})
export class MatchesComponent {
  private matchService = inject(MatchService);

  private matches = toSignal(this.matchService.getUpcomingMatches(), { initialValue: null });

  selectedCompetition = signal<string>('all');

  /** Lista e kompeticioneve të pranishme, e nxjerrë nga vetë ndeshjet — gjithmonë e përditësuar */
  competitions = computed(() => {
    const matches = this.matches();
    if (!matches) return [];
    return Array.from(new Set(matches.map((m) => m.competition))).sort();
  });

  private filteredMatches = computed(() => {
    const matches = this.matches();
    if (!matches) return null;

    const selected = this.selectedCompetition();
    return selected === 'all' ? matches : matches.filter((m) => m.competition === selected);
  });

  /** Ndeshjet e filtruara, të grupuara sipas kompeticionit (gjithmonë me kompeticionin
   *  që luan më parë të parin — matches vjen tashmë i renditur sipas kickoff nga query) */
  groupedMatches = computed<MatchGroup[] | null>(() => {
    const matches = this.filteredMatches();
    if (!matches) return null;

    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const list = groups.get(m.competition) ?? [];
      list.push(m);
      groups.set(m.competition, list);
    }

    return Array.from(groups.entries()).map(([competition, groupMatches]) => ({
      competition,
      matches: groupMatches
    }));
  });

  isEmpty = computed(() => (this.filteredMatches()?.length ?? 0) === 0);

  selectCompetition(value: string): void {
    this.selectedCompetition.set(value);
  }
}
