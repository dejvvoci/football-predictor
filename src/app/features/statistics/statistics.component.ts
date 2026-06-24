import { Component, inject, signal, computed } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { of, switchMap, combineLatest, map } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { StatisticsService, UserStatistics } from '../../core/services/statistics.service';
import { ALL_ACHIEVEMENTS } from '../../core/models/achievement.model';
import { UserProfile } from '../../core/models/user.model';

@Component({
  selector: 'app-statistics',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './statistics.component.html',
  styleUrl: './statistics.component.css'
})
export class StatisticsComponent {
  private authService = inject(AuthService);
  private statisticsService = inject(StatisticsService);

  myUid$ = this.authService.user$.pipe(map((u) => u?.uid ?? null));

  stats$ = this.myUid$.pipe(
    switchMap((uid) => uid ? this.statisticsService.getUserStatistics(uid) : of(null))
  );

  profile$ = this.myUid$.pipe(
    switchMap((uid) => uid ? this.statisticsService.getProfile(uid) : of(null))
  );

  weeklyForm$ = this.myUid$.pipe(
    switchMap((uid) => uid ? this.statisticsService.getWeeklyForm(uid) : of([]))
  );

  // Head-to-head
  allUsers$ = this.statisticsService.getAllUsers();
  searchQuery = signal('');
  selectedUserId = signal<string | null>(null);

  filteredUsers$ = combineLatest([this.allUsers$, this.myUid$]).pipe(
    map(([users, myUid]) => {
      const q = this.searchQuery().toLowerCase().trim();
      if (!q) return [];
      return users
        .filter((u) => u.uid !== myUid && u.displayName?.toLowerCase().includes(q))
        .slice(0, 6);
    })
  );

  compareStats$ = this.selectedUserId() !== null
    ? this.statisticsService.getUserStatistics(this.selectedUserId()!)
    : of(null);

  compareProfile$ = combineLatest([
    toObservable(this.selectedUserId),
    this.allUsers$
  ]).pipe(
    switchMap(([uid, users]) => {
      if (!uid) return of(null);
      return this.statisticsService.getProfile(uid);
    })
  );

  h2hStats$ = combineLatest([
    toObservable(this.selectedUserId),
    this.stats$
  ]).pipe(
    switchMap(([uid, myStats]) => {
      if (!uid || !myStats) return of(null);
      return this.statisticsService.getUserStatistics(uid).pipe(
        map((theirStats) => ({ mine: myStats, theirs: theirStats }))
      );
    })
  );

  allAchievements = ALL_ACHIEVEMENTS;
  activeTab = signal<'overview' | 'form' | 'h2h' | 'achievements'>('overview');

  onSearch(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
    this.selectedUserId.set(null);
  }

  selectUser(uid: string): void {
    this.selectedUserId.set(uid);
    this.searchQuery.set('');
  }

  isEarned(achievementId: string, earnedIds: string[]): boolean {
    return earnedIds.includes(achievementId);
  }

  // SVG chart helpers
  chartWidth = 320;
  chartHeight = 120;
  chartPadding = { top: 8, right: 8, bottom: 24, left: 30 };

  barX(index: number, total: number): number {
    const innerW = this.chartWidth - this.chartPadding.left - this.chartPadding.right;
    const barW = innerW / total;
    return this.chartPadding.left + index * barW + barW * 0.1;
  }

  barWidth(total: number): number {
    const innerW = this.chartWidth - this.chartPadding.left - this.chartPadding.right;
    return (innerW / total) * 0.8;
  }

  barHeight(points: number, maxPoints: number): number {
    if (maxPoints === 0) return 0;
    const innerH = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    return (points / maxPoints) * innerH;
  }

  barY(points: number, maxPoints: number): number {
    const innerH = this.chartHeight - this.chartPadding.top - this.chartPadding.bottom;
    return this.chartPadding.top + innerH - this.barHeight(points, maxPoints);
  }
}