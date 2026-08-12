import { Component, OnInit, signal } from '@angular/core';
import { NavigationEnd, RouterOutlet } from '@angular/router';
import { Sidebars } from './component/misc/sidebars/sidebars';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
import { Router } from '@angular/router';
// import { PrimeNG } from 'primeng/config';
// import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebars, SidebarModule, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('Halte 🥀');

  firstSegment() {
    const url = window.location.pathname;
    const segments = url.split('/').filter((segment) => segment.length > 0);
    console.log('firstSegment', segments.length > 0 ? segments[0] : '');
    return segments.length > 0 ? segments[0] : '';
  }

  constructor(
    // private config: PrimeNG,
    // private translateService: TranslateService,
    private router: Router,
  ) {}

  viewState = signal('Desktop');

  handleSidebarState(isMobile: boolean) {
    if (isMobile) {
      this.viewState.set('Mobile');
    } else {
      this.viewState.set('Desktop');
    }
  }

  //
  // ngOnInit() {
  //   this.translateService.setDefaultLang('en');
  // }
  // translate(lang: string) {
  //   this.translateService.use(lang);
  //   this.translateService.get('primeng').subscribe((res) => this.primeng.setTranslation(res));
  // }
}
