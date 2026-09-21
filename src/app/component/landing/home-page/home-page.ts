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
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// Chart.js dan plugin Zoom
import { Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

import { TripRecord, TripService } from '../../../service/trip.service';
import { AuthService } from '../../../service/auth.service';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';

// Daftarkan semua komponen Chart.js beserta plugin Zoom
Chart.register(...registerables, zoomPlugin);

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
    ToastModule,
    TableModule,
    FormsModule,
    SelectModule,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  providers: [MessageService, DialogService],
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  // Hanya satu ViewChild yang tersisa dan strongly typed
  @ViewChild('barCanvas') barCanvasRef!: ElementRef<HTMLCanvasElement>;

  readonly today = new Date();
  readonly isLoading = signal(true);
  readonly trips = signal<TripRecord[]>([]);
  readonly chartType = signal<'line' | 'bar'>('line'); // Signal untuk tipe chart

  private viewReady = signal(false);
  private chartInstance: Chart | null = null;

  readonly recentTripsSkeletonRows: Partial<TripRecord>[] = Array.from({ length: 4 }, (_, i) => ({
    id: i,
  }));

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
   * Data multi-line/bar chart (Perjalanan tiap Surveyor)
   * X = Nama Halte
   * Y = Waktu / Jam
   */
  readonly chartData = computed(() => {
    const trips = this.trips();
    if (!trips.length) return null;

    let masterHaltes: string[] = [];
    for (const t of trips) {
      if ((t.haltes?.length ?? 0) > masterHaltes.length) {
        masterHaltes = t.haltes!.map((h, i) => `${i + 1}. ${h.namaHalte}`);
      }
    }

    const datasets = trips
      .filter((t) => t.haltes?.some((h) => h.waktuKedatangan || h.waktuKeberangkatan))
      .map((trip, idx) => {
        const data: any[] = [];
        let previousHour = -1;

        trip.haltes!.forEach((h, i) => {
          const timeStr = h.waktuKedatangan || h.waktuKeberangkatan;

          if (timeStr) {
            const d = new Date(timeStr);
            let hour = d.getHours() + d.getMinutes() / 60;

            if (previousHour !== -1 && hour < previousHour - 6) {
              hour += 24;
            }
            previousHour = Math.max(previousHour, hour);

            data.push({
              x: `${i + 1}. ${h.namaHalte}`,
              y: Math.round(hour * 100) / 100,
              rawTime: d,
            });
          }
        });

        // Random color for the surveyor line/bar, based on index
        const hue = (idx * 137.5) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;

        return {
          label: trip.namaSurveyor || trip.kodeTrip,
          data: data,
          borderColor: color,
          backgroundColor: color, // Penting saat chart berupa 'bar'
          pointBackgroundColor: color,
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
          fill: false,
          borderRadius: 4, // Efek lengkung untuk mode 'bar'
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

  constructor(
    private tripService: TripService,
    private authService: AuthService,
    private router: Router,
    private destroyRef: DestroyRef,
  ) {
    // Reaktif menggambar/memperbarui chart saat data berubah
    effect(() => {
      const data = this.chartData();
      const ready = this.viewReady();
      if (!ready) return;

      if (!data || data.datasets.length === 0) {
        if (this.chartInstance) {
          this.chartInstance.destroy();
          this.chartInstance = null;
        }
        return;
      }
      this.renderOrUpdateChart(data);
    });
  }

  ngOnInit(): void {
    this.tripService
      .getAllTrips()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (trips) => {
          const mapped = (trips ?? []).map((t) => {
            const hariTanggal = t.hariTanggal ? new Date(t.hariTanggal) : new Date();
            const haltes = (t.haltes ?? []).map((h) => ({
              ...h,
              waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
              waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
            }));

            const filled = haltes.filter((h) => h.waktuKedatangan || h.waktuKeberangkatan).length;
            const progressPct = haltes.length ? Math.round((filled / haltes.length) * 100) : 0;
            const statusText =
              progressPct === 100
                ? 'Finished'
                : progressPct > 0
                  ? 'On Road / Not Finished'
                  : 'Not yet started';

            return { ...t, hariTanggal, haltes, progressPct, statusText };
          });
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
        text: 'On Road / Not Finished',
        cls: 'text-amber-300 bg-amber-900/30 border border-amber-800',
      };
    return { text: 'Not yet started', cls: 'text-gray-400 bg-gray-800/50 border border-gray-700' };
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  // ── Chart Controls ──────────────────────────────────────────────────────────
  toggleChartType(): void {
    const newType = this.chartType() === 'line' ? 'bar' : 'line';
    this.chartType.set(newType);

    if (this.chartInstance) {
      (this.chartInstance.config as any).type = newType;
      this.chartInstance.update();
    }
  }

  resetZoom(): void {
    if (this.chartInstance) {
      this.chartInstance.resetZoom();
    }
  }

  // ── Chart.js Setup & Update ─────────────────────────────────────────────────
  private renderOrUpdateChart(chartData: any): void {
    const canvas = this.barCanvasRef?.nativeElement;
    if (!canvas) return;

    if (this.chartInstance) {
      this.chartInstance.data.labels = chartData.labels;
      this.chartInstance.data.datasets = chartData.datasets;
      (this.chartInstance.config as any).type = this.chartType();
      this.chartInstance.update();
      return;
    }

    this.chartInstance = new Chart(canvas, {
      type: this.chartType(),
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: 'easeOutQuart',
          // BARU: dipanggil Chart.js sendiri persis saat animasi ini selesai —
          // baru di titik itu kita matikan animasi untuk update/zoom selanjutnya
          onComplete: () => {
            if (this.chartInstance) {
              this.chartInstance.options.animation = false as any;
            }
          },
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: 'x',
            },
          },
          tooltip: {
            backgroundColor: '#1a1d24',
            titleColor: '#fff',
            bodyColor: '#e5e7eb',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => (items[0].raw as any).x,
              label: (item) => {
                const dsLabel = item.dataset.label;
                const rawData = item.raw as any;
                const d = rawData.rawTime as Date;
                const timeStr = d.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return `${dsLabel} · Arrival: ${timeStr}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            title: {
              display: true,
              text: 'Halte Name',
              color: 'rgba(255,255,255,0.45)',
              font: { size: 10 },
            },
            ticks: {
              color: 'rgba(255,255,255,0.45)',
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 45,
              autoSkip: false,
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            type: 'linear',
            title: {
              display: true,
              text: 'Time (Hours)',
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
