import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { AuthService } from '../../core/services/auth.service';

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

  leaderboard$ = this.leaderboardService.getGlobalLeaderboard();
  user$ = this.authService.user$;
}