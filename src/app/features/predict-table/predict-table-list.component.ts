import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { TablePredictionService } from '../../core/services/table-prediction.service';
import { COMP_FLAGS } from '../../core/models/table-prediction.model';

@Component({
  selector: 'app-predict-table-list',
  standalone: true,
  imports: [RouterLink, AsyncPipe, DatePipe],
  templateUrl: './predict-table-list.component.html',
  styleUrl: './predict-table-list.component.css'
})
export class PredictTableListComponent {
  private service = inject(TablePredictionService);
  seasons$ = this.service.getActiveSeasons();
  flags = COMP_FLAGS;

  isOpen(deadline: number): boolean {
    return Date.now() < deadline;
  }
}
