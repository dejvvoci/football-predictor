import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-join-group',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './join-group.component.html',
  styleUrl: './join-group.component.css'
})
export class JoinGroupComponent implements OnInit {
  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    inviteCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const codeFromLink = this.route.snapshot.queryParamMap.get('code');
    if (codeFromLink) {
      this.form.patchValue({ inviteCode: codeFromLink.toUpperCase() });
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const groupId = await this.groupService.joinGroup(this.form.getRawValue().inviteCode);
      this.router.navigate(['/groups', groupId]);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      this.loading.set(false);
    }
  }
}