import { Component, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { FullPageLoading } from '../../misc/full-page-loading/full-page-loading';
import { ExportService } from '../../../service/export.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { DynamicDialogServices } from '../../../service/dynamic-dialog.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { HalteEntry, TripRecord, TripService } from '../../../service/trip.service';
import { ImportService } from '../../../service/import.service';
import { finalize } from 'rxjs';

type ViewMode = 'table' | 'card';

type ColumnType = 'index' | 'text' | 'date' | 'progress' | 'action';

interface ColumnDef {
  field: keyof TripRecord | 'no' | 'action';
  header: string;
  type: ColumnType;
  widthClass: string;
  minWidth: string;
  align?: 'center';
  rowClass: string;
}

@Component({
  selector: 'app-trip-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    FullPageLoading,
    TooltipModule,
    ToastModule,
  ],
  templateUrl: './trip-page.html',
  styleUrl: './trip-page.css',
  providers: [DatePipe, DialogService, MessageService],
})
export class TripPage {
  readonly viewMode = signal<ViewMode>('table');

  readonly records = signal<TripRecord[]>([]);

  ref: DynamicDialogRef | undefined | null;

  columnsField: ColumnDef[] = [
    {
      field: 'no',
      header: 'No',
      type: 'index',
      widthClass: 'w-12 text-gray-400',
      minWidth: '36px',
      align: 'center',
      rowClass: '',
    },
    {
      field: 'kodeTrip',
      header: 'Trip Code',
      type: 'text',
      widthClass: 'w-28 font-mono text-sky-200',
      minWidth: '120px',
      rowClass: 'text-sky-100',
    },
    {
      field: 'namaSurveyor',
      header: 'Surveyor',
      type: 'text',
      widthClass: 'w-36 text-amber-200',
      minWidth: '220px',
      rowClass: 'text-amber-100',
    },
    {
      field: 'hariTanggal',
      header: 'Date',
      type: 'date',
      widthClass: 'w-32 text-green-200',
      minWidth: '140px',
      rowClass: '',
    },
    {
      field: 'nomorKendaraan',
      header: 'Vehicle No',
      type: 'text',
      widthClass: 'w-28 text-sky-300',
      minWidth: '150px',
      align: 'center',
      rowClass: 'text-sky-100',
    },
    {
      field: 'haltes',
      header: 'Stops Filled',
      type: 'progress',
      widthClass: 'w-32 text-red-200',
      minWidth: '120px',
      align: 'center',
      rowClass: '',
    },
    {
      field: 'action',
      header: '#',
      type: 'action',
      widthClass: 'w-12 text-purple-200',
      minWidth: '36px',
      align: 'center',
      rowClass: '',
    },
  ];

  readonly hasData = computed(() => this.records().length > 0);
  readonly isLoading = signal(true);

  constructor(
    private router: Router,
    private messageService: MessageService,
    private importService: ImportService,
    private exportService: ExportService,
    private dynamicDialogServices: DynamicDialogServices,
    private tripService: TripService,
  ) {}

  private openConfirmModal(message: string, onConfirm: () => void, onClose?: () => void): void {
    this.ref = this.dynamicDialogServices.confirmModal(message);

    if (!this.ref) {
      onClose?.();
      return;
    }

    this.ref.onClose.subscribe((result) => {
      if (result?.isValid) {
        onConfirm();
      }
      onClose?.();
    });
  }

  ngOnInit() {
    this.getData();
  }

  readonly isDraggingFile = signal(false);
  private dragDepth = 0;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth++;
    this.isDraggingFile.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth--;
    if (this.dragDepth <= 0) {
      this.dragDepth = 0;
      this.isDraggingFile.set(false);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragDepth = 0;
    this.isDraggingFile.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      this.invokeToast('Please drop a .csv or .xlsx file.', 'warn');
      return;
    }

    this.isLoading.set(true);

    try {
      const parsed = await this.importService.parseFile(file);

      if (parsed.length === 0) {
        this.isLoading.set(false);

        this.invokeToast('No trip data found in this file.', 'warn');
        return;
      }

      const { valid, invalid } = this.validateImportedTrips(parsed);

      if (valid.length === 0) {
        this.isLoading.set(false);

        this.invokeToast(
          `None of the ${parsed.length} trip(s) in this file could be imported. All had missing or invalid data.`,
          'error',
        );
        return;
      }

      this.isLoading.set(false);

      const message =
        invalid.length > 0
          ? `Import ${valid.length} valid trip(s) from "${file.name}"? ${invalid.length} trip(s) will be skipped due to missing/invalid data.`
          : `Import ${valid.length} trip${valid.length > 1 ? 's' : ''} from "${file.name}"?`;

      this.openConfirmModal(message, () => this.saveImportedTrips(valid, invalid));
    } catch (err) {
      this.isLoading.set(false);

      console.error(err);
      this.invokeToast(
        err instanceof Error ? err.message : 'Failed to read the dropped file.',
        'error',
      );
    }
  }

  private validateImportedTrips(trips: TripRecord[]): {
    valid: TripRecord[];
    invalid: { trip: TripRecord; reason: string }[];
  } {
    const existingCodes = new Set(this.records().map((r) => r.kodeTrip.trim().toLowerCase()));

    const valid: TripRecord[] = [];
    const invalid: { trip: TripRecord; reason: string }[] = [];

    trips.forEach((trip) => {
      const missing: string[] = [];
      if (!trip.kodeTrip?.trim()) missing.push('Trip Code');
      if (!trip.namaSurveyor?.trim()) missing.push('Surveyor');
      if (!trip.nomorKendaraan?.trim()) missing.push('Vehicle Number');
      if (!trip.hariTanggal || isNaN(new Date(trip.hariTanggal).getTime())) {
        missing.push('Date');
      }

      if (missing.length > 0) {
        invalid.push({ trip, reason: `Missing ${missing.join(', ')}` });
        return;
      }

      if (existingCodes.has(trip.kodeTrip.trim().toLowerCase())) {
        invalid.push({ trip, reason: `Trip Code "${trip.kodeTrip}" already exists` });
        return;
      }

      // Clean up halte-level data: drop any halte with an invalid time order.
      const cleanedHaltes = trip.haltes.map((halte) => {
        const kedatangan = halte.waktuKedatangan ? new Date(halte.waktuKedatangan) : null;
        const keberangkatan = halte.waktuKeberangkatan ? new Date(halte.waktuKeberangkatan) : null;

        if (kedatangan && keberangkatan && keberangkatan <= kedatangan) {
          return { ...halte, waktuKeberangkatan: null };
        }
        return halte;
      });

      existingCodes.add(trip.kodeTrip.trim().toLowerCase());

      valid.push({ ...trip, haltes: cleanedHaltes });
    });

    return { valid, invalid };
  }

  private saveImportedTrips(
    valid: TripRecord[],
    invalid: { trip: TripRecord; reason: string }[] = [],
  ): void {
    this.isLoading.set(true);

    const tripsToCreate = valid.map((t) => ({
      kodeTrip: t.kodeTrip,
      namaSurveyor: t.namaSurveyor,
      hariTanggal: t.hariTanggal,
      nomorKendaraan: t.nomorKendaraan,
      haltes: t.haltes,
    }));

    this.tripService
      .bulkCreateTrips(tripsToCreate)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (created) => {
          const current = this.records();
          const mapped = (created ?? []).map((t) => ({
            ...t,
            hariTanggal: t.hariTanggal ? new Date(t.hariTanggal) : new Date(),
            haltes: (t.haltes ?? []).map((h) => ({
              ...h,
              waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
              waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
            })),
          }));
          this.records.set([...mapped, ...current]);

          if (invalid.length > 0) {
            this.invokeToast(
              `${valid.length} trip(s) imported. ${invalid.length} trip(s) skipped: ${invalid.map((i) => i.reason).join('; ')}`,
              'warn',
            );
          } else {
            this.invokeToast(
              `${valid.length} trip${valid.length > 1 ? 's' : ''} imported successfully.`,
              'success',
            );
          }
        },
        error: (err) => {
          console.error('Bulk import failed:', err);
          this.invokeToast('Failed to import trips.', 'error');
        },
      });
  }

  exportCsv(): void {
    if (!this.hasData()) {
      this.invokeToast('No trips data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trips data to CSV?', () => {
      this.exportService.exportTripsCsv(this.records());
      this.invokeToast('CSV exported successfully.', 'success');
    });
  }

  exportExcel(): void {
    if (!this.hasData()) {
      this.invokeToast('No trips data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trips data to Excel?', () => {
      this.exportService.exportTripsExcel(this.records());
      this.invokeToast('Excel exported successfully.', 'success');
    });
  }

  getData(): void {
    this.isLoading.set(true);

    this.tripService
      .getAllTrips()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (trips) => {
          try {
            const mapped = (trips ?? []).map((t) => ({
              ...t,
              hariTanggal: t.hariTanggal ? new Date(t.hariTanggal) : new Date(),
              haltes: (t.haltes ?? []).map((h) => ({
                ...h,
                waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
                waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
              })),
            }));
            this.records.set(mapped);
          } catch (mapErr) {
            console.error('Failed while transforming trip data:', mapErr, trips);
            this.invokeToast('Received malformed trip data.', 'error');
          }
        },
        error: (err) => {
          console.error('HTTP error loading trips:', err);
          this.invokeToast('Failed to load trips.', 'error');
        },
      });
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  tabButtonClass(mode: ViewMode): string {
    const base = 'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors';
    return this.viewMode() === mode
      ? `${base} bg-gray-400/20 text-white shadow-sm`
      : `${base} text-gray-600/50 hover:bg-gray-500/5 hover:text-gray-200`;
  }

  routeTo(base: string, id?: string | number) {
    if (id) {
      this.router.navigate([base, id]);
    } else {
      this.router.navigate([base]);
    }
  }

  openItem(id: string | number) {
    this.router.navigate(['/trip', id]);
  }

  getFilledCount(record: TripRecord): number {
    return record.haltes.filter((h) => !!h.waktuKedatangan || !!h.waktuKeberangkatan).length;
  }

  getProgressPercent(record: TripRecord): number {
    if (!record.haltes || record.haltes.length === 0) return 0;
    return (this.getFilledCount(record) / record.haltes.length) * 100;
  }

  // Color dynamic helpers based on progress
  getHalteStatusClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);

    if (percent === 100) {
      return 'bg-emerald-900/30 text-emerald-400 border border-emerald-800';
    }
    if (percent > 0 && percent < 30) {
      return 'bg-amber-900/30 text-amber-400 border border-amber-800';
    }
    if (percent >= 30) {
      return 'bg-amber-800/30 text-amber-300 border border-amber-700';
    }
    return 'bg-gray-800/50 text-gray-500 border border-gray-700';
  }

  getTextColorClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);
    if (percent === 100) return 'text-emerald-400';
    if (percent > 0 && percent < 30) return 'text-red-500';
    if (percent > 0) return 'text-amber-400';
    return 'text-gray-500';
  }

  getProgressBarClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);
    if (percent === 100) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (percent > 0 && percent < 30) return 'bg-red-500';
    if (percent >= 30) return 'bg-amber-500';
    return 'bg-gray-600';
  }

  trackById(_index: number, record: TripRecord): number {
    return record.id;
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
