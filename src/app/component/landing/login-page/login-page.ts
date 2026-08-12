import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FloatLabelModule } from 'primeng/floatlabel';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { InputPasswordModule } from 'primeng/inputpassword';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AuthService } from '../../../service/auth-service';
import { Router } from '@angular/router';
import { AuthVisual } from '../../misc/auth-visual/auth-visual';

@Component({
  selector: 'app-login-page',
  imports: [
    AuthVisual,
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    FloatLabelModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    InputPasswordModule,
    ToastModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  providers: [MessageService],
})
export class LoginPage {
  private fb = inject(FormBuilder);

  isLogin: boolean = true;

  loading = false;
  submitted = false;
  mask: boolean = true;

  constructor(
    private messageService: MessageService,
    private authService: AuthService,
    private router: Router,
  ) {}

  login = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [false],
  });

  register = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, this.passwordRequirementsValidator]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.matchPasswords },
  );

  value: string = '';

  requirements = [
    { id: 'minLength', label: 'At least 12 characters', test: (v: string) => v.length >= 12 },
    { id: 'uppercase', label: 'Contains uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
    { id: 'lowercase', label: 'Contains lowercase letter', test: (v: string) => /[a-z]/.test(v) },
    { id: 'number', label: 'Contains number', test: (v: string) => /[0-9]/.test(v) },
    {
      id: 'symbol',
      label: 'Contains special character',
      test: (v: string) => /[^a-zA-Z0-9]/.test(v),
    },
  ];

  passwordRequirementsValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value ?? '';

    const rules = [
      { id: 'minLength', test: (v: string) => v.length >= 12 },
      { id: 'uppercase', test: (v: string) => /[A-Z]/.test(v) },
      { id: 'lowercase', test: (v: string) => /[a-z]/.test(v) },
      { id: 'number', test: (v: string) => /[0-9]/.test(v) },
      { id: 'symbol', test: (v: string) => /[^a-zA-Z0-9]/.test(v) },
    ];

    const failed = rules.filter((r) => !r.test(value)).map((r) => r.id);

    return failed.length ? { passwordRequirements: failed } : null;
  }

  private matchPasswords(group: AbstractControl): ValidationErrors | null {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  get email() {
    return this.login.controls.email;
  }

  get password() {
    return this.login.controls.password;
  }

  get emailRegister() {
    return this.register.controls.email;
  }

  get passwordRegister() {
    return this.register.controls.password;
  }

  get confirmPassword() {
    return this.register.controls.confirmPassword;
  }

  toggleLogin() {
    this.isLogin = !this.isLogin;
    this.submitted = false;
    this.login.reset();
    this.register.reset();
  }

  onSubmit(): void {
    this.submitted = true;

    if (this.login.invalid) {
      this.login.markAllAsTouched();
      this.invokeToast('Please fill in all required fields correctly.', 'error');
      return;
    }

    this.loading = true;

    this.authService
      .login(this.login.value.email ?? '', this.login.value.password ?? '')
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          this.invokeToast('Login successful!', 'success');

          localStorage.setItem('access_token', response.access_token);
          localStorage.setItem('id_token', response.id_token);

          this.authService.triggerLoginSuccess();
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading = false;
          const errorMsg = err.error?.error_description || 'Login failed';
          this.invokeToast(errorMsg, 'error');
        },
      });
  }

  onRegister(): void {
    this.submitted = true;

    if (this.register.invalid) {
      this.register.markAllAsTouched();
      this.invokeToast('Please fill in all required fields correctly.', 'error');
      return;
    }

    this.loading = true;
    const { email, password } = this.register.value;

    this.authService.register(email ?? '', password ?? '').subscribe({
      next: (response: any) => {
        this.loading = false;

        this.invokeToast('Registration successful! Please log in.', 'success');

        this.toggleLogin();
      },
      error: (err) => {
        this.loading = false;
        const errorMsg = err.error?.description || err.error?.message || 'Registration failed';
        this.invokeToast(errorMsg, 'error');
      },
    });
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
