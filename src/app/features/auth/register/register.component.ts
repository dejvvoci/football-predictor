import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { mapFirebaseAuthError } from '../../../core/utils/firebase-error.util';

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{3,20}$/;

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

  signupMethod = signal<'email' | 'username'>('email');

  form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    username: [''],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);
  returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  setMethod(method: 'email' | 'username'): void {
    this.signupMethod.set(method);

    if (method === 'email') {
      this.form.controls.email.setValidators([Validators.required, Validators.email]);
      this.form.controls.username.clearValidators();
    } else {
      this.form.controls.username.setValidators([Validators.required, Validators.pattern(USERNAME_PATTERN)]);
      this.form.controls.email.clearValidators();
    }
    this.form.controls.email.updateValueAndValidity();
    this.form.controls.username.updateValueAndValidity();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const { displayName, email, username, password } = this.form.getRawValue();

    try {
      if (this.signupMethod() === 'username') {
        await this.authService.registerWithUsername(username, password, displayName);
      } else {
        await this.authService.register(email, password, displayName);
      }
      this.router.navigateByUrl(this.returnUrl ?? '/matches');
    } catch (err) {
      let code = (err as { code?: string })?.code;
      // Username-et përkthehen në një email fiktiv nga i njëjti string, kështu që Firebase Auth
      // e kap dublimin si "email-already-in-use" — riemërto mesazhin që t'i përshtatet kontekstit.
      if (this.signupMethod() === 'username' && code === 'auth/email-already-in-use') {
        code = 'username/taken';
      }
      this.errorMessage.set(mapFirebaseAuthError(code));
    } finally {
      this.loading.set(false);
    }
  }
}