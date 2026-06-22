import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TournamentService } from '../../../core/services/tournament.service';

@Component({
  selector: 'app-create-challenge',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-challenge.component.html',
  styleUrl: './create-challenge.component.css'
})
export class CreateChallengeComponent {
  private fb = inject(FormBuilder);
  private tournamentService = inject(TournamentService);
  private router = inject(Router);

  form = this.fb.nonNullable.group({
    title:        ['', [Validators.required, Validators.minLength(5)]],
    competition:  ['', [Validators.required]],
    optionsRaw:   ['', [Validators.required]], // opsionet, të ndara me presje
    pointsReward: [10, [Validators.required, Validators.min(1)]],
    deadline:     ['', [Validators.required]]  // datetime-local input
  });

  loading = signal(false);
  error = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const { title, competition, optionsRaw, pointsReward, deadline } = this.form.getRawValue();
    const options = optionsRaw.split(',').map((o) => o.trim()).filter(Boolean);

    if (options.length < 2) {
      this.error.set('Vendos të paktën 2 opsione, të ndara me presje.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await this.tournamentService.createChallenge({
        title,
        competition,
        options,
        pointsReward,
        deadline: new Date(deadline).getTime()
      });
      this.router.navigateByUrl('/tournament');
    } catch {
      this.error.set("S'u krijua dot sfida. Provo përsëri.");
    } finally {
      this.loading.set(false);
    }
  }
}