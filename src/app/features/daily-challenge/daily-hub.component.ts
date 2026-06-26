import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { combineLatest } from 'rxjs';
import { ChallengeService } from '../../core/services/challenge.service';
import { DailyChallengeService } from '../../core/services/daily-challenge.service';

interface HubCard {
  type: string;
  route: string;
  icon: string;
  title: string;
  description: string;
  available: boolean;
  solved?: boolean;
  attempts?: number;
}

@Component({
  selector: 'app-daily-hub',
  standalone: true,
  imports: [RouterLink, DatePipe, AsyncPipe],
  templateUrl: './daily-hub.component.html',
  styleUrl: './daily-hub.component.css'
})
export class DailyHubComponent implements OnInit {
  private challengeService = inject(ChallengeService);
  private dailyService = inject(DailyChallengeService);

  today = this.challengeService.today();

  cards = signal<HubCard[]>([
    { type: 'player',    route: '/daily/player',    icon: '⚽', title: 'Player of the Day',
      description: 'Guess the mystery footballer from progressive clues', available: false },
    { type: 'badge',     route: '/daily/badge',     icon: '🛡️', title: 'Club Badge',
      description: 'Identify the club from its blurred badge', available: false },
    { type: 'flashback', route: '/daily/flashback', icon: '⚡', title: 'Score Flashback',
      description: 'Remember the score from a historic match', available: false },
    { type: 'topscorer', route: '/daily/topscorer', icon: '🥇', title: 'Top Scorer',
      description: 'Who topped the scoring charts that season?', available: false },
  ]);

  ngOnInit(): void {
    // Check availability and results for each challenge
    ['badge', 'flashback', 'topscorer'].forEach((type) => {
      this.challengeService.getChallenge(type as any).subscribe((ch) => {
        this.updateCard(type, { available: !!ch });
      });
      this.challengeService.getMyResult(type as any).subscribe((r) => {
        if (r) this.updateCard(type, { solved: r.solved, attempts: r.attempts });
      });
    });

    // Player of the day
    this.dailyService.getTodaysChallenge().subscribe((ch) => {
      this.updateCard('player', { available: !!ch });
    });
    this.dailyService.getMyResult().subscribe((r) => {
      if (r) this.updateCard('player', { solved: r.solved, attempts: r.attempts });
    });
  }

  private updateCard(type: string, update: Partial<HubCard>): void {
    this.cards.update(cards =>
      cards.map(c => c.type === type ? { ...c, ...update } : c)
    );
  }
}