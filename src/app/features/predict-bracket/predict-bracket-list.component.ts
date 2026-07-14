import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BracketService } from '../../core/services/bracket.service';

@Component({
  selector: 'app-predict-bracket-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './predict-bracket-list.component.html',
  styleUrl: './predict-bracket-list.component.css'
})
export class PredictBracketListComponent {
  private bracketService = inject(BracketService);

  brackets$ = this.bracketService.getBrackets();
}
