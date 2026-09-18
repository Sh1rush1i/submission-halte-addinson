import {
  Component,
  computed,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
  effect,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { TripRecord, TripService } from '../../../service/trip.service';
import { AuthService } from '../../../service/auth.service';
import { FullPageLoading } from '../../misc/full-page-loading/full-page-loading';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';

Chart.register(...registerables);

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    FullPageLoading,
    ToastModule,
    TableModule,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  providers: [MessageService, DialogService],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barCanvas') barCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly today = new Date();
  readonly isLoading = signal(true);
  readonly trips = signal<TripRecord[]>([]);
  private viewReady = signal(false);

  // ── Derived stats ────────────────────────────────────────────────────────────
  readonly totalTrips = computed(() => this.trips().length);

  readonly completedTrips = computed(
    () => this.trips().filter((t) => this.getProgress(t) === 100).length,
  );

  readonly inProgressTrips = computed(
    () => this.trips().filter((t) => this.getProgress(t) > 0 && this.getProgress(t) < 100).length,
  );

  readonly recentTrips = computed(() =>
    [...this.trips()]
      .sort((a, b) => new Date(b.hariTanggal).getTime() - new Date(a.hariTanggal).getTime())
      .slice(0, 5),
  );

  readonly vehicleStats = computed(() => {
    const map = new Map<string, number>();
    for (const t of this.trips()) {
      map.set(t.nomorKendaraan, (map.get(t.nomorKendaraan) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([vehicle, count]) => ({ vehicle, count }));
  });

  /**
   * Data multi-line chart (Perjalanan tiap Surveyor)
   * X = Nama Halte (semua 56 rute)
   * Y = Waktu / Jam
   */
  readonly chartData = computed(() => {
    const trips = this.trips();
    if (!trips.length) return null;

    // 1. Ambil 56 halte sebagai Master Urutan (X-Axis labels)
    // Menambahkan nomor urut (i + 1) supaya namanya unik dan Chart.js tidak menumpuk halte dengan nama sama.
    let masterHaltes: string[] = [];
    for (const t of trips) {
      if ((t.haltes?.length ?? 0) > masterHaltes.length) {
        masterHaltes = t.haltes!.map((h, i) => `${i + 1}. ${h.namaHalte}`);
      }
    }

    // 2. Bangun Dataset garis untuk masing-masing surveyor
    const datasets = trips
      .filter((t) => t.haltes?.some((h) => h.waktuKedatangan || h.waktuKeberangkatan))
      .map((trip, idx) => {
        const data: any[] = [];
        let previousHour = -1;

        // Loop melalui seluruh 56 halte di trip ini
        trip.haltes!.forEach((h, i) => {
          const timeStr = h.waktuKedatangan || h.waktuKeberangkatan;

          if (timeStr) {
            const d = new Date(timeStr);
            let hour = d.getHours() + d.getMinutes() / 60;

            // Jika waktu lompat mundur drastis, tambah 24 jam agar garis tidak patah ke bawah
            if (previousHour !== -1 && hour < previousHour - 6) {
              hour += 24;
            }
            previousHour = Math.max(previousHour, hour);

            data.push({
              x: `${i + 1}. ${h.namaHalte}`, // Harus persis sama dengan masterHaltes
              y: Math.round(hour * 100) / 100,
              rawTime: d,
            });
          }
        });

        const hue = (idx * 137.5) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;

        return {
          label: trip.namaSurveyor || trip.kodeTrip,
          data: data,
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: false,
        };
      });

    return { labels: masterHaltes, datasets };
  });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Good Morning';
    if (hour < 15) return 'Good Afternoon';
    if (hour < 18) return 'Good Evening';
    return 'Good Night';
  });

  readonly userName = computed(() => this.authService.currentUser()?.name ?? 'Surveyor');

  private chartInstance: Chart | null = null;

  // STRICTLY Constructor Dependency Injection (no inject() syntax)
  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private dialogService: DialogService,
  ) {
    effect(() => {
      const data = this.chartData();
      const ready = this.viewReady();
      if (!ready) return;

      if (!data || data.datasets.length === 0) {
        this.chartInstance?.destroy();
        this.chartInstance = null;
        return;
      }
      this.drawLineChart(data);
    });
  }

  ngOnInit(): void {
    this.tripService
      .getAllTrips()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (trips) => {
          const mapped = (trips ?? []).map((t) => ({
            ...t,
            hariTanggal: t.hariTanggal ? new Date(t.hariTanggal) : new Date(),
            haltes: (t.haltes ?? []).map((h) => ({
              ...h,
              waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
              waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
            })),
          }));
          this.trips.set(mapped);
        },
        error: () => this.trips.set([]),
      });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
  }

  ngOnDestroy(): void {
    this.chartInstance?.destroy();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  getProgress(t: TripRecord): number {
    if (!t.haltes?.length) return 0;
    const filled = t.haltes.filter((h) => h.waktuKedatangan || h.waktuKeberangkatan).length;
    return Math.round((filled / t.haltes.length) * 100);
  }

  getProgressBarClass(pct: number): string {
    if (pct === 100) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-amber-400';
    if (pct > 0) return 'bg-orange-400';
    return 'bg-gray-600';
  }

  getStatusLabel(pct: number): { text: string; cls: string } {
    if (pct === 100)
      return {
        text: 'Finished',
        cls: 'text-emerald-400 bg-emerald-900/30 border border-emerald-800',
      };
    if (pct > 0)
      return {
        text: 'On Road',
        cls: 'text-amber-300 bg-amber-900/30 border border-amber-800',
      };
    return { text: 'Not yet started', cls: 'text-gray-400 bg-gray-800/50 border border-gray-700' };
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  vehicleBadgeClass(i: number): string {
    const classes = [
      'bg-sky-500/20 text-sky-300',
      'bg-emerald-500/20 text-emerald-300',
      'bg-amber-500/20 text-amber-300',
      'bg-purple-500/20 text-purple-300',
      'bg-rose-500/20 text-rose-300',
    ];
    return classes[i % classes.length];
  }

  vehicleBarClass(i: number): string {
    const classes = [
      'bg-sky-400',
      'bg-emerald-400',
      'bg-amber-400',
      'bg-purple-400',
      'bg-rose-400',
    ];
    return classes[i % classes.length];
  }

  // ── Chart.js line chart ───────────────────────
  private drawLineChart(chartData: any): void {
    const canvas = this.barCanvasRef?.nativeElement;
    if (!canvas) return;

    this.chartInstance?.destroy();

    this.chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#1a1d24',
            titleColor: '#fff',
            bodyColor: '#e5e7eb',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              // Menambahkan "as any" untuk melewati Type Error 'unknown'
              title: (items) => (items[0].raw as any).x,
              label: (item) => {
                const dsLabel = item.dataset.label;
                const rawData = item.raw as any;
                const d = rawData.rawTime as Date;
                const timeStr = d.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return `${dsLabel} · Tiba: ${timeStr}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Nama Halte',
              color: 'rgba(255,255,255,0.45)',
              font: { size: 10 },
            },
            ticks: {
              color: 'rgba(255,255,255,0.45)',
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 45,
              autoSkip: false, // Memaksa semua 56 label tampil tanpa ada yang dilewati
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: 'Waktu (Jam)',
              color: 'rgba(255,255,255,0.45)',
              font: { size: 10 },
            },
            ticks: {
              color: 'rgba(255,255,255,0.35)',
              font: { size: 10 },
              stepSize: 1,
              callback: (val: any) => {
                const h = Math.floor(val) % 24;
                return `${h.toString().padStart(2, '0')}:00`;
              },
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
        },
      },
    });
  }
}
