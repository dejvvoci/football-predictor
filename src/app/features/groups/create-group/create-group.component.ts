import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create-group.component.html',
  styleUrl: './create-group.component.css'
})
export class CreateGroupComponent {
  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private router = inject(Router);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const groupId = await this.groupService.createGroup(this.form.getRawValue().name);
      this.router.navigate(['/groups', groupId]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Diçka shkoi keq.');
    } finally {
      this.loading.set(false);
    }
  }
}