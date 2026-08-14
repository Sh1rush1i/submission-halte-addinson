import { Component, OnInit, signal } from '@angular/core';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { Sidebars } from './component/misc/sidebars/sidebars';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { Router } from '@angular/router';
import { AuthService } from './service/auth.service';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ToastModule } from 'primeng/toast';
// import { PrimeNG } from 'primeng/config';
// import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebars, SidebarModule, ButtonModule, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  providers: [MessageService],
})
export class App {
  protected readonly title = signal('Halte 🥀');
  private loginSub!: Subscription;
  private authFailedSub!: Subscription;

  firstSegment() {
    const url = window.location.pathname;
    const segments = url.split('/').filter((segment) => segment.length > 0);
    // console.log('firstSegment', segments.length > 0 ? segments[0] : '');
    return segments.length > 0 ? segments[0] : '';
  }

  constructor(
    // private config: PrimeNG,
    // private translateService: TranslateService,
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService,
  ) {}

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
  }

  newLogin() {
    this.loginSub = this.authService.loginSuccess$.subscribe(() => {
      this.invokeToast('Login success.', 'success');
    });
  }

  onAuthFailed() {
    this.authFailedSub = this.authService.authFailed$.subscribe(() => {
      this.invokeToast('Session has expired or you are not logged in.', 'error');
    });
  }

  ngOnDestroy() {
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

  // translate(lang: string) {
  //   this.translateService.use(lang);
  //   this.translateService.get('primeng').subscribe((res) => this.primeng.setTranslation(res));
  // }
}
