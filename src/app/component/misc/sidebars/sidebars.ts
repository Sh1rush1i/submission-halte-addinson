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
      items: [{ icon: 'pi pi-file-o', label: 'Trip', route: '/trip' }],
    },
    // {
    //   label: 'Traffic',
    //   items: [
    //     { icon: 'pi pi-file-o', label: 'Traffic 1', route: '/red-light' },
    //     { icon: 'pi pi-cloud', label: 'Traffic 2', route: '/green-light' },
    //   ],
    // },
    {
      label: 'Form',
      items: [{ icon: 'pi pi-file-plus', label: 'Trip Form', route: '/trip/new' }],
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

  ngOnInit() {
    this.getDataNumber();
  }

  getDataNumber() {
    const departure = localStorage.getItem('departureRecords');
    const arrival = localStorage.getItem('arrivalRecords');
    const traffic = localStorage.getItem('trafficRecords');

    const departureCount = departure ? JSON.parse(departure).length : 0;
    const arrivalCount = arrival ? JSON.parse(arrival).length : 0;
    const trafficCount = traffic ? JSON.parse(traffic).length : 0;

    this.menuGroups.update((groups) =>
      groups.map((group) => {
        if (group.label === 'Halte') {
          return {
            ...group,
            items: group.items.map((item) =>
              item.label === 'Departure'
                ? { ...item, badge: departureCount }
                : item.label === 'Arrival'
                  ? { ...item, badge: arrivalCount }
                  : item,
            ),
          };
        }
        if (group.label === 'Traffic') {
          return {
            ...group,
            items: group.items.map((item) =>
              item.label === 'Traffic 1' ? { ...item, badge: trafficCount } : item,
            ),
          };
        }
        return group;
      }),
    );
  }

  onNavClick() {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }
}
