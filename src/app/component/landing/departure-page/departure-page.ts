import { Component, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';

import { FullPageLoading } from '../../misc/full-page-loading/full-page-loading';

interface DepartureRecord {
  id: number;
  kodeTrip: string;
  waktuBerhenti: Date;
  penumpangNaik: number;
  penumpangTurun: number;
  penumpangTidakTerangkut: number;
  waktuJalan: Date;
}

type ViewMode = 'table' | 'card';

interface ViewOption {
  label: string;
  value: ViewMode;
  icon: string;
}

interface ColumnConfig<T> {
  label: string;
  field?: keyof T;
  class?: string;
  minWidth?: string;
  render?: (record: T, rowIndex: number) => string | number | null;
}

type ColumnType =
  'index' | 'text' | 'stop' | 'go' | 'passenger' | 'notTransported' | 'tag' | 'action';

interface ColumnDef {
  field: string;
  header: string;
  type: ColumnType;
  widthClass: string;
  minWidth: string;
  align?: 'center';
}

@Component({
  selector: 'app-departure-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    SelectButtonModule,
    FullPageLoading,
    TooltipModule,
  ],
  templateUrl: './departure-page.html',
  styleUrl: './departure-page.css',
  providers: [DatePipe],
})
export class DeparturePage {
  readonly viewMode = signal<ViewMode>('table');

  readonly viewOptions: ViewOption[] = [
    { label: 'Tabel', value: 'table', icon: 'pi pi-list' },
    { label: 'Kartu', value: 'card', icon: 'pi pi-th-large' },
  ];

  readonly records = signal<DepartureRecord[]>([
    {
      id: 1,
      kodeTrip: 'TRP-0231',
      waktuBerhenti: new Date(2026, 7, 13, 6, 12, 0),
      penumpangNaik: 14,
      penumpangTurun: 9,
      penumpangTidakTerangkut: 2,
      waktuJalan: new Date(2026, 7, 13, 6, 14, 30),
    },
    {
      id: 2,
      kodeTrip: 'TRP-0232',
      waktuBerhenti: new Date(2026, 7, 13, 6, 28, 0),
      penumpangNaik: 21,
      penumpangTurun: 17,
      penumpangTidakTerangkut: 0,
      waktuJalan: new Date(2026, 7, 13, 6, 31, 10),
    },
    {
      id: 3,
      kodeTrip: 'TRP-0233',
      waktuBerhenti: new Date(2026, 7, 13, 6, 45, 0),
      penumpangNaik: 8,
      penumpangTurun: 6,
      penumpangTidakTerangkut: 5,
      waktuJalan: new Date(2026, 7, 13, 6, 49, 45),
    },
    {
      id: 4,
      kodeTrip: 'TRP-0234',
      waktuBerhenti: new Date(2026, 7, 13, 7, 2, 0),
      penumpangNaik: 30,
      penumpangTurun: 25,
      penumpangTidakTerangkut: 8,
      waktuJalan: new Date(2026, 7, 13, 7, 6, 20),
    },
    {
      id: 5,
      kodeTrip: 'TRP-0235',
      waktuBerhenti: new Date(2026, 7, 13, 7, 18, 0),
      penumpangNaik: 12,
      penumpangTurun: 11,
      penumpangTidakTerangkut: 0,
      waktuJalan: new Date(2026, 7, 13, 7, 20, 5),
    },
    {
      id: 6,
      kodeTrip: 'TRP-0236',
      waktuBerhenti: new Date(2026, 7, 13, 7, 33, 0),
      penumpangNaik: 19,
      penumpangTurun: 14,
      penumpangTidakTerangkut: 3,
      waktuJalan: new Date(2026, 7, 13, 7, 36, 40),
    },
  ]);

  formatTime(date: Date): string {
    return this.datePipe.transform(date, 'HH:mm:ss') ?? '';
  }

  columns: ColumnConfig<DepartureRecord>[] = [
    { label: 'No', class: 'w-12 text-center', minWidth: '32px', render: (_, i) => i + 1 },
    {
      label: 'Trip Code',
      field: 'kodeTrip',
      class: 'w-28 font-mono text-sm font-medium text-white',
    },
    {
      label: 'Stop Times',
      class: 'w-32 tabular-nums text-red-200',
      render: (r) => this.formatTime(r.waktuBerhenti),
    },
    { label: 'Board', field: 'penumpangNaik', class: 'w-20 text-center text-green-200' },
    { label: 'Disembark', field: 'penumpangTurun', class: 'w-20 text-center text-sky-200' },
    {
      label: 'Not Transported',
      field: 'penumpangTidakTerangkut',
      class: 'w-28 text-center text-amber-200',
    },
    {
      label: 'Trip Time',
      class: 'w-32 text-center text-green-200',
      render: (r) => this.formatTime(r.waktuJalan),
    },
    { label: 'Stop Duration', class: 'w-32 text-center', render: (r) => this.durationLabel(r) },
    { label: '#', class: 'w-12 text-center' },
  ];

  columnsField: ColumnDef[] = [
    {
      field: 'no',
      header: 'No',
      type: 'index',
      widthClass: 'w-12',
      minWidth: '32px',
      align: 'center',
    },
    { field: 'kodeTrip', header: 'Trip Code', type: 'text', widthClass: 'w-28', minWidth: '84px' },
    {
      field: 'waktuBerhenti',
      header: 'Stop Times',
      type: 'stop',
      widthClass: 'w-32',
      minWidth: '84px',
    },
    {
      field: 'penumpangNaik',
      header: 'Board',
      type: 'passenger',
      widthClass: 'w-20',
      minWidth: '84px',
      align: 'center',
    },
    {
      field: 'penumpangTurun',
      header: 'Disembark',
      type: 'passenger',
      widthClass: 'w-20',
      minWidth: '84px',
      align: 'center',
    },
    {
      field: 'penumpangTidakTerangkut',
      header: 'Not Transported',
      type: 'notTransported',
      widthClass: 'w-28',
      minWidth: '100px',
      align: 'center',
    },
    {
      field: 'waktuJalan',
      header: 'Trip Time',
      type: 'go',
      widthClass: 'w-32',
      minWidth: '100px',
      align: 'center',
    },
    {
      field: 'duration',
      header: 'Stop Duration',
      type: 'tag',
      widthClass: 'w-32',
      minWidth: '100px',
      align: 'center',
    },
    {
      field: 'action',
      header: '#',
      type: 'action',
      widthClass: 'w-12',
      minWidth: '24px',
      align: 'center',
    },
  ];

  readonly hasData = computed(() => this.records().length > 0);

  isLoading: boolean = true;

  constructor(private datePipe: DatePipe) {}

  ngOnInit() {
    this.getData();
    this.isLoading = false;
  }

  getData() {
    const stored = localStorage.getItem('departureRecords');
    if (stored) {
      try {
        const parsed: DepartureRecord[] = JSON.parse(stored).map((rec: any) => ({
          ...rec,
          waktuBerhenti: new Date(rec.waktuBerhenti),
          waktuJalan: new Date(rec.waktuJalan),
        }));
        this.records.set(parsed);
      } catch (err) {
        console.error('Error parsing localStorage data:', err);
      }
    }
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  tabButtonClass(mode: ViewMode): string {
    const base = 'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors';
    return this.viewMode() === mode
      ? `${base} bg-surface-700 text-white shadow-sm`
      : `${base} text-surface-400 hover:bg-surface-800/60 hover:text-surface-200`;
  }

  durationLabel(record: DepartureRecord): string {
    const totalSeconds = Math.max(
      0,
      Math.floor((record.waktuJalan.getTime() - record.waktuBerhenti.getTime()) / 1000),
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes === 0 ? `${seconds} s` : `${minutes} m ${seconds} s`;
  }

  durationSeverity(record: DepartureRecord): 'success' | 'warn' | 'danger' {
    const minutes = (record.waktuJalan.getTime() - record.waktuBerhenti.getTime()) / 60000;
    if (minutes <= 3) return 'success';
    if (minutes <= 6) return 'warn';
    return 'danger';
  }

  trackById(_index: number, record: DepartureRecord): number {
    return record.id;
  }
}
