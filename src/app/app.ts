import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebars } from './component/misc/sidebars/sidebars';
import { ButtonModule } from 'primeng/button';
import { SidebarModule } from 'primeng/sidebar';
// import { PrimeNG } from 'primeng/config';
// import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Sidebars, SidebarModule, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('submission-halte-addinson');

  // constructor(
  //   private config: PrimeNG,
  //   private translateService: TranslateService,
  // ) {}
  // ngOnInit() {
  //   this.translateService.setDefaultLang('en');
  // }
  // translate(lang: string) {
  //   this.translateService.use(lang);
  //   this.translateService.get('primeng').subscribe((res) => this.primeng.setTranslation(res));
  // }
}
