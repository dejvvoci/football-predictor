import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { of, switchMap, map, combineLatest } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { AuthService } from '../../core/services/auth.service';
import { SeasonService } from '../../core/services/season.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { Season } from '../../core/models/season.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.css'
})
export class LeaderboardComponent {
  private leaderboardService = inject(LeaderboardService);
  private authService = inject(AuthService);
  private seasonService = inject(SeasonService);
  private statisticsService = inject(StatisticsService);

  leaderboard$ = this.leaderboardService.getGlobalLeaderboard();
  user$ = this.authService.user$;
  seasons$ = this.seasonService.getAllSeasons();

  isAdmin$ = this.authService.user$.pipe(
    switchMap((user) => user ? this.statisticsService.getProfile(user.uid) : of(null)),
    map((profile) => profile?.isAdmin === true)
  );

  activeTab = signal<'current' | 'hof'>('current');
  selectedSeasonId = signal<string | null>(null);

  hallOfFame$ = combineLatest([
    toObservable(this.selectedSeasonId),
    this.seasons$
  ]).pipe(
    switchMap(([selectedId, seasons]) => {
      const id = selectedId ?? seasons.filter((s) => !s.isActive)[0]?.id;
      if (!id) return of([]);
      return this.seasonService.getHallOfFame(id);
    })
  );

  newSeasonName = signal('');
  startingSeason = signal(false);
  endingSeasonId = signal<string | null>(null);
  seasonMsg = signal<string | null>(null);

  onNameInput(e: Event): void {
    this.newSeasonName.set((e.target as HTMLInputElement).value);
  }

  pastSeasons(seasons: Season[]): Season[] {
    return seasons.filter((s) => !s.isActive);
  }

  isSelectedSeason(id: string, seasons: Season[]): boolean {
    const sel = this.selectedSeasonId();
    if (sel) return sel === id;
    return this.pastSeasons(seasons)[0]?.id === id;
  }

  async startSeason(): Promise<void> {
    const name = this.newSeasonName().trim();
    if (!name) return;
    this.startingSeason.set(true);
    try {
      await this.seasonService.startNewSeason(name);
      this.newSeasonName.set('');
      this.seasonMsg.set(`✓ Sezoni "${name}" filloi.`);
    } finally {
      this.startingSeason.set(false);
    }
  }

  async endSeason(season: Season): Promise<void> {
    if (!confirm(`Mbyll "${season.name}"? Kjo resetar totalPoints për të gjithë!`)) return;
    this.endingSeasonId.set(season.id);
    try {
      const count = await this.seasonService.endSeason(season.id);
      this.seasonMsg.set(`✓ Sezoni u mbyll. ${count} lojtarë u regjistruan te Hall of Fame.`);
    } finally {
      this.endingSeasonId.set(null);
    }
  }
}