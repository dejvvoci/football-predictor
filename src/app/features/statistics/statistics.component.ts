import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { StatisticsService } from '../../core/services/statistics.service';
import { ALL_ACHIEVEMENTS, resolveAchievements } from '../../core/models/achievement.model';

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

  stats$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.statisticsService.getUserStatistics(user.uid) : of(null)))
  );

  profile$ = this.authService.user$.pipe(
    switchMap((user) => (user ? this.statisticsService.getProfile(user.uid) : of(null)))
  );

  allAchievements = ALL_ACHIEVEMENTS;

  isEarned(achievementId: string, earnedIds: string[]): boolean {
    return earnedIds.includes(achievementId);
  }
}
