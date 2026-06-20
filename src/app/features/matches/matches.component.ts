import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatchService } from '../../core/services/match.service';
import { MatchCardComponent } from './match-card/match-card.component';

@Component({
  selector: 'app-matches',
  standalone: true,
  imports: [AsyncPipe, MatchCardComponent],
  templateUrl: './matches.component.html',
  styleUrl: './matches.component.css'
})
export class MatchesComponent {
  private matchService = inject(MatchService);

  matches$ = this.matchService.getTodayMatches();
}