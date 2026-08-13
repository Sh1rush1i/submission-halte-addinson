import { Component, Output, signal, EventEmitter, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [AvatarModule, SidebarModule, ButtonModule, RouterModule],
  templateUrl: './sidebars.html',
  styleUrl: './sidebars.css',
})
export class Sidebars {
  @Output() sidebarState = new EventEmitter<boolean>();

  isMobile = signal(false);
  sidebarOpen = signal(true);

  menuGroups = signal<NavGroup[]>([
    {
      label: 'Home',
      items: [{ icon: 'pi pi-home', label: 'Home', route: '/dashboard' }],
    },
    {
      label: 'Halte',
      items: [
        { icon: 'pi pi-file-o', label: 'Departure', route: '/departure', badge: 3 },
        { icon: 'pi pi-cloud', label: 'Arrival', route: '/arrival' },
      ],
    },
    {
      label: 'Traffic',
      items: [
        { icon: 'pi pi-file-o', label: 'Traffic 1', route: '/red-light', badge: 3 },
        { icon: 'pi pi-cloud', label: 'Traffic 2', route: '/green-light' },
      ],
    },
    {
      label: 'Form',
      items: [
        { icon: 'pi pi-file-plus', label: 'Form Departure', route: '/form-1' },
        { icon: 'pi pi-file-plus', label: 'Form Arrival', route: '/form-2' },
        { icon: 'pi pi-file-plus', label: 'Form Traffic', route: '/form-3' },
        { icon: 'pi pi-file-plus', label: 'Form Traffic 2', route: '/form-4' },
      ],
    },
  ]);

  constructor() {
    effect(() => {
      this.sidebarState.emit(this.isMobile());
    });

    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 1023px)');

    this.isMobile.set(mql.matches);
    this.sidebarOpen.set(!mql.matches);

    mql.addEventListener('change', (e) => {
      this.isMobile.set(e.matches);
      this.sidebarOpen.set(!e.matches);
    });
  }

  onNavClick() {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }
}
