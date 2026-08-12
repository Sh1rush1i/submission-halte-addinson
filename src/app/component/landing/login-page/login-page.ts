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

@Component({
  selector: 'app-login-page',
  imports: [
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

  constructor(private messageService: MessageService) {}

  login = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    remember: [false],
  });

  register = this.fb.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: this.matchPasswords },
  );

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

    this.invokeToast('Sign in successful!', 'success');

    setTimeout(() => {
      this.loading = false;
      console.log('Sign in payload', this.login.value);
    }, 900);
  }

  onRegister(): void {
    this.submitted = true;

    if (this.register.invalid) {
      this.register.markAllAsTouched();
      this.invokeToast('Please fill in all required fields correctly.', 'error');

      return;
    }

    this.loading = true;

    this.invokeToast('Registration successful!', 'success');

    setTimeout(() => {
      this.loading = false;
      console.log('Sign up payload', this.register.value);
    }, 900);
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
