import { Component, computed, OnInit, Signal, signal, DestroyRef } from '@angular/core';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { Sidebars } from './component/misc/sidebars/sidebars';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { MessageService } from 'primeng/api';
import { filter, Subscription } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { User } from '@auth0/auth0-angular';
import * as AOS from 'aos';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { jwtDecode } from 'jwt-decode';
import { PopoverModule } from 'primeng/popover';
import { DatePipe } from '@angular/common';

// import { PrimeNG } from 'primeng/config';
// import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Sidebars,
    SidebarModule,
    ButtonModule,
    ToastModule,
    PopoverModule,
    DatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  providers: [MessageService],
})
export class App {
  protected readonly title = signal('Halte 🥀');
  private loginSub!: Subscription;
  private authFailedSub!: Subscription;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  readonly tokenCountdown = signal<string | null>(null);
  readonly isExpiringSoon = signal<boolean>(false);

  readonly tokenIssuedAt = signal<Date | null>(null);
  readonly tokenExpiresAt = signal<Date | null>(null);

  username: string = '';

  private currentUser!: Signal<User | null>;
  private currentUrl!: Signal<NavigationEnd | null>;

  firstSegment() {
    const url = window.location.pathname;
    const segments = url.split('/').filter((segment) => segment.length > 0);
    return segments.length > 0 ? segments[0] : '';
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService,
    private destroyRef: DestroyRef,
  ) {
    this.currentUser = this.authService.currentUser;
    this.currentUrl = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)), {
      initialValue: null,
    });
  }

  viewState = signal('Desktop');

  handleSidebarState(isMobile: boolean) {
    if (isMobile) {
      this.viewState.set('Mobile');
    } else {
      this.viewState.set('Desktop');
    }
  }

  ngOnInit() {
    this.newLogin();
    this.onAuthFailed();
    this.startTokenCountdown();

    const user = this.currentUser();
    if (user?.name) {
      this.getUserName(user.name);
    }

    AOS.init({
      duration: 1000,
      once: false,
      easing: 'ease-in-out',
      mirror: true,
    });
  }

  readonly pageLabel = computed(() => {
    this.currentUrl();

    const url = this.router.url;
    const firstSegment = url.split('/').filter(Boolean)[0];

    if (!firstSegment) return 'Dashboard';

    const clean = firstSegment.split('?')[0].split('#')[0];
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  });

  getUserName(name: string) {
    this.username = name;
  }

  startTokenCountdown(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.updateTokenCountdown();
    this.timerInterval = setInterval(() => {
      this.updateTokenCountdown();
    }, 1000);
  }

  private updateTokenCountdown(): void {
    const token = localStorage.getItem('id_token') || localStorage.getItem('access_token');
    if (!token) {
      this.resetTokenInfo();
      return;
    }

    try {
      const decoded: { exp?: number; iat?: number } = jwtDecode(token);
      if (!decoded?.exp) {
        this.resetTokenInfo();
        return;
      }

      const expMs = decoded.exp * 1000;
      this.tokenExpiresAt.set(new Date(expMs));
      this.tokenIssuedAt.set(decoded.iat ? new Date(decoded.iat * 1000) : null);

      const diffMs = expMs - Date.now();

      if (diffMs <= 0) {
        this.tokenCountdown.set('00:00:00');
        this.isExpiringSoon.set(true);
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this.authService.logout();
        this.authService.triggerAuthFailed();
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (n: number) => n.toString().padStart(2, '0');
      this.tokenCountdown.set(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      this.isExpiringSoon.set(totalSeconds < 300);
    } catch {
      this.resetTokenInfo();
    }
  }

  private resetTokenInfo(): void {
    this.tokenCountdown.set(null);
    this.tokenIssuedAt.set(null);
    this.tokenExpiresAt.set(null);
  }

  newLogin() {
    this.loginSub = this.authService.loginSuccess$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.invokeToast('Login success.', 'success');
        this.startTokenCountdown();
      });
  }

  onAuthFailed() {
    this.authFailedSub = this.authService.authFailed$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.invokeToast('Session has expired or you are not logged in.', 'error');
        this.router.navigate(['/login']);
      });
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.loginSub) {
      this.loginSub.unsubscribe();
    }
    if (this.authFailedSub) {
      this.authFailedSub.unsubscribe();
    }
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }

  openRickRoll(event: Event): void {
    event.preventDefault();

    const videoId = 'dQw4w9WgXcQ';
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const appUrl = `vnd.youtube://watch?v=${videoId}`;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

    if (isMobile) {
      window.location.href = appUrl;

      setTimeout(() => {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
      }, 500);
    } else {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }
  }

  // translate(lang: string) {
  //   this.translateService.use(lang);
  //   this.translateService.get('primeng').subscribe((res) => this.primeng.setTranslation(res));
  // }
}
