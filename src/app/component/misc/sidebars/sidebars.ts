import { Component, Output, signal, EventEmitter, effect } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  badge?: string;
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
      label: 'Menu',
      items: [
        { icon: 'pi pi-home', label: 'Home', route: '/dashboard' },
        { icon: 'pi pi-inbox', label: 'Inbox', route: '/inbox', badge: '3' },
        { icon: 'pi pi-search', label: 'Search', route: '/search' },
        { icon: 'pi pi-users', label: 'Team', route: '/team' },
        { icon: 'pi pi-bell', label: 'Notifications', route: '/notifications' },
        { icon: 'pi pi-cog', label: 'Settings', route: '/settings' },
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
