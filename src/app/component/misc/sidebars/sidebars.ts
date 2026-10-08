import { Component, Output, signal, EventEmitter, effect, Input, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AvatarModule } from 'primeng/avatar';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { Popover } from 'primeng/popover';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../service/auth.service';
import { DynamicDialogServices } from '../../../service/dynamic-dialog.service';

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
  imports: [AvatarModule, SidebarModule, ButtonModule, RouterModule, Popover],
  templateUrl: './sidebars.html',
  styleUrl: './sidebars.css',
})
export class Sidebars {
  @Input() userName: string = 'Guest | Create new account with name';
  @Output() sidebarState = new EventEmitter<boolean>();

  isMobile = signal(false);
  sidebarOpen = signal(true);

  menuGroups = signal<NavGroup[]>([
    {
      label: 'Main',
      items: [
        { icon: 'pi pi-home', label: 'Home', route: '/dashboard' },
        { icon: 'pi pi-file-o', label: 'Trip', route: '/trip' },
        { icon: 'pi pi-user', label: 'About Developer', route: '/about' },
        { icon: 'pi pi-history', label: 'Update Log', route: '/update-log' },
      ],
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
    this.sidebarOpen.set(false);
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

  private authService = inject(AuthService);
  private router = inject(Router);
  private dynamicDialogServices = inject(DynamicDialogServices);
  private messageService = inject(MessageService);

  private hoverTimeout: any;

  onNavClick() {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

  onAvatarHover(event: Event, popover: Popover): void {
    clearTimeout(this.hoverTimeout);
    popover.show(event);
  }

  onAvatarLeave(popover: Popover): void {
    this.hoverTimeout = setTimeout(() => {
      popover.hide();
    }, 250);
  }

  cancelLeave(): void {
    clearTimeout(this.hoverTimeout);
  }

  onPopoverLeave(popover: Popover): void {
    popover.hide();
  }

  onSignOut(popover?: Popover): void {
    popover?.hide();
    const ref = this.dynamicDialogServices.confirmModal('Are you sure you want to sign out?');
    if (!ref) {
      this.performLogout();
      return;
    }
    ref.onClose.subscribe((result) => {
      if (result?.isValid) {
        this.performLogout();
      }
    });
  }

  private performLogout(): void {
    this.authService.logout();
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
    this.messageService.add({
      severity: 'info',
      summary: 'Signed Out',
      detail: 'You have been signed out successfully.',
    });
    this.router.navigate(['/login']);
  }
}
