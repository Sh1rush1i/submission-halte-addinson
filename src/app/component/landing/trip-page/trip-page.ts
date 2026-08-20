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
import { HalteEntry, TripRecord } from '../../../service/trip.service';
import { ImportService } from '../../../service/import.service';

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
  isLoading: boolean = true;

  constructor(
    private router: Router,
    private messageService: MessageService,
    private importService: ImportService,
    private exportService: ExportService,
    private dynamicDialogServices: DynamicDialogServices,
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

    try {
      const imported = await this.importService.parseFile(file);

      if (imported.length === 0) {
        this.invokeToast('No trip data found in this file.', 'warn');
        return;
      }

      this.openConfirmModal(
        `Import ${imported.length} trip${imported.length > 1 ? 's' : ''} from "${file.name}"?`,
        () => this.saveImportedTrips(imported),
      );
    } catch (err) {
      console.error(err);
      this.invokeToast(
        err instanceof Error ? err.message : 'Failed to read the dropped file.',
        'error',
      );
    }
  }

  private saveImportedTrips(imported: TripRecord[]): void {
    const current = this.records();
    const merged = [...current, ...imported];

    localStorage.setItem('tripRecords', JSON.stringify(merged));
    this.records.set(merged);

    this.invokeToast(
      `${imported.length} trip${imported.length > 1 ? 's' : ''} imported successfully.`,
      'success',
    );
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

  getData() {
    const stored = localStorage.getItem('tripRecords');
    if (stored) {
      try {
        const parsed: TripRecord[] = JSON.parse(stored).map((rec: any) => ({
          ...rec,
          hariTanggal: new Date(rec.hariTanggal),
        }));
        this.records.set(parsed);
        // console.log(this.records());
      } catch (err) {
        console.error('Error parsing localStorage data:', err);
      }
    } else {
      // this.injectMockData();
    }
    this.isLoading = false;
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

  private injectMockData() {
    const generateMockHaltes = (total: number, filled: number): HalteEntry[] => {
      return Array.from({ length: total }, (_, i) => ({
        namaHalte: `Stop ${i + 1}`,
        waktuKedatangan: i < filled ? new Date() : null,
        waktuKeberangkatan: i < filled ? new Date() : null,
        penumpangNaik: i < filled ? 5 : null,
        penumpangTurun: i < filled ? 3 : null,
        penumpangTidakTerangkut: 0,
      }));
    };

    this.records.set([
      {
        id: 1,
        kodeTrip: 'TRP-001',
        namaSurveyor: 'Ahmad Rizky',
        hariTanggal: new Date(),
        nomorKendaraan: 'L 1234 AB',
        haltes: generateMockHaltes(54, 54), // 100% complete
      },
      {
        id: 2,
        kodeTrip: 'TRP-002',
        namaSurveyor: 'Budi Santoso',
        hariTanggal: new Date(),
        nomorKendaraan: 'L 5678 CD',
        haltes: generateMockHaltes(54, 23), // In progress
      },
      {
        id: 3,
        kodeTrip: 'TRP-003',
        namaSurveyor: 'Citra Kirana',
        hariTanggal: new Date(new Date().setDate(new Date().getDate() - 1)),
        nomorKendaraan: 'L 9012 EF',
        haltes: generateMockHaltes(54, 0), // Not started
      },
    ]);
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
