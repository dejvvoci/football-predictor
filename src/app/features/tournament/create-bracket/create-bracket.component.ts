import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { JsonPipe } from '@angular/common';
import { BracketService } from '../../../core/services/bracket.service';
import {
  BracketRoundName,
  BRACKET_ROUND_ORDER,
  BRACKET_ROUND_LABELS,
  DEFAULT_POINTS_PER_ROUND
} from '../../../core/models/bracket.model';

@Component({
  selector: 'app-create-bracket',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, JsonPipe],
  templateUrl: './create-bracket.component.html',
  styleUrl: './create-bracket.component.css'
})
export class CreateBracketComponent {
  private fb = inject(FormBuilder);
  private bracketService = inject(BracketService);
  private router = inject(Router);

  roundOptions = BRACKET_ROUND_ORDER;
  roundLabels = BRACKET_ROUND_LABELS;

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    competition: ['', [Validators.required]],
    startRound: this.fb.nonNullable.control<BracketRoundName>('LAST_16', [Validators.required]),
    pointsLast16: [DEFAULT_POINTS_PER_ROUND.LAST_16, [Validators.required, Validators.min(1)]],
    pointsQuarter: [DEFAULT_POINTS_PER_ROUND.QUARTER_FINALS, [Validators.required, Validators.min(1)]],
    pointsSemi: [DEFAULT_POINTS_PER_ROUND.SEMI_FINALS, [Validators.required, Validators.min(1)]],
    pointsFinal: [DEFAULT_POINTS_PER_ROUND.FINAL, [Validators.required, Validators.min(1)]]
  });

  loading = signal(false);
  error = signal<string | null>(null);

  roundsFrom(startRound: BracketRoundName): BracketRoundName[] {
    return BRACKET_ROUND_ORDER.slice(BRACKET_ROUND_ORDER.indexOf(startRound));
  }

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { title, competition, startRound, pointsLast16, pointsQuarter, pointsSemi, pointsFinal } =
      this.form.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    try {
      const bracketId = await this.bracketService.createBracketFromMatches({
        title,
        competition,
        startRound,
        pointsPerRound: {
          LAST_16: pointsLast16,
          QUARTER_FINALS: pointsQuarter,
          SEMI_FINALS: pointsSemi,
          FINAL: pointsFinal
        }
      });
      this.router.navigateByUrl(`/tournament/bracket/${bracketId}`);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : "S'u krijua dot bracket-i.");
    } finally {
      this.loading.set(false);
    }
  }
}
