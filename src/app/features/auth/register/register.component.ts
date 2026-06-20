import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { mapFirebaseAuthError } from '../../../core/utils/firebase-error.util';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { displayName, email, password } = this.form.getRawValue();

    try {
      await this.authService.register(email, password, displayName);
      this.router.navigateByUrl(this.returnUrl ?? '/matches');
    } catch (err) {
      const code = (err as { code?: string })?.code;
      this.errorMessage.set(mapFirebaseAuthError(code));
    } finally {
      this.loading.set(false);
    }
  }
}