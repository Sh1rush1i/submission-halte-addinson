import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DatePickerModule } from 'primeng/datepicker';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { FullPageLoading } from '../../misc/full-page-loading/full-page-loading';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TripService, HALTE_NAMES, HalteEntry, TripRecord } from '../../../service/trip.service';
import { DynamicDialogServices } from '../../../service/dynamic-dialog.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import * as XLSX from 'xlsx';
import { ExportService } from '../../../service/export.service';
import { ImportService } from '../../../service/import.service';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { AuthService } from '../../../service/auth.service';
import { TooltipModule } from 'primeng/tooltip';

function timeOrderValidator(group: AbstractControl): ValidationErrors | null {
  const datang = group.get('waktuKedatangan')?.value;
  const berangkat = group.get('waktuKeberangkatan')?.value;
  if (!datang || !berangkat) return null;
  return new Date(berangkat) > new Date(datang) ? null : { timeOrder: true };
}

/** Normalise any date-like value to a proper Date object, or null */
function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Map all halte date fields to Date objects after an API response */
function normaliseHaltes(haltes: HalteEntry[]): HalteEntry[] {
  return haltes.map((h) => ({
    ...h,
    waktuKedatangan: toDate(h.waktuKedatangan),
    waktuKeberangkatan: toDate(h.waktuKeberangkatan),
  }));
}

const LAST_HALTE_INDEX = HALTE_NAMES.length - 1;
const ICON_RESET_DELAY_MS = 1800;

@Component({
  selector: 'app-trip-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    DatePickerModule,
    SelectModule,
    TagModule,
    TableModule,
    FullPageLoading,
    ToastModule,
    IconFieldModule,
    InputIconModule,
    TooltipModule,
  ],
  templateUrl: './trip-form.html',
  styleUrl: './trip-form.css',
  providers: [MessageService, DialogService],
})
export class TripForm {
  private fb = inject(FormBuilder);

  ref: DynamicDialogRef | undefined | null;

  // ── Page-level loading (initial fetch / import) ────────────────────────────
  readonly isLoading = signal(true);

  // ── Per-action loading signals (drive button spinner + icon state) ─────────
  readonly isSavingHalte = signal(false);
  readonly isDeletingHalte = signal(false);
  readonly isDeletingTrip = signal(false);
  readonly isCreatingTrip = signal(false);
  readonly isImporting = signal(false);

  /** 'idle' | 'loading' | 'done' — for icon swap on each action button */
  readonly saveHalteIcon = signal<'idle' | 'loading' | 'done'>('idle');
  readonly deleteHalteIcon = signal<'idle' | 'loading' | 'done'>('idle');
  readonly deleteTripIcon = signal<'idle' | 'loading' | 'done'>('idle');
  readonly createTripIcon = signal<'idle' | 'loading' | 'done'>('idle');

  // ── Trip data ───────────────────────────────────────────────────────────────
  tripId: string | null = null;
  readonly tripSignal = signal<TripRecord | null>(null);

  /** Computed haltes list — only recalculates when trip data changes */
  readonly haltesListComputed = computed(() => {
    const trip = this.tripSignal();
    if (!trip) return [];
    return trip.haltes.map((halte, index) => ({ index, name: HALTE_NAMES[index], halte }));
  });

  /** Computed filled-halte count — only recalculates when trip data changes */
  readonly filledHalteCountComputed = computed(() => {
    const trip = this.tripSignal();
    if (!trip) return 0;
    return trip.haltes.filter((h) => this.isHalteFilled(h)).length;
  });

  get trip(): TripRecord | null {
    return this.tripSignal();
  }

  set trip(value: TripRecord | null) {
    this.tripSignal.set(value);
  }

  readonly halteOptions = HALTE_NAMES.map((name: string, index: number) => ({
    label: `${index + 1}. ${name}`,
    value: index,
  }));

  readonly tripForm = this.fb.nonNullable.group({
    kodeTrip: ['', Validators.required],
    namaSurveyor: ['', Validators.required],
    hariTanggal: this.fb.control<Date | null>(null, Validators.required),
    nomorKendaraan: ['', Validators.required],
  });

  readonly halteForm = this.fb.nonNullable.group(
    {
      halteIndex: this.fb.control<number | null>(null, Validators.required),
      waktuKedatangan: this.fb.control<Date | null>(null, Validators.required),
      waktuKeberangkatan: this.fb.control<Date | null>(null),
      penumpangNaik: [0, [Validators.min(0)]],
      penumpangTurun: [0, [Validators.min(0)]],
      penumpangTidakTerangkut: [0, [Validators.min(0)]],
    },
    { validators: timeOrderValidator },
  );

  constructor(
    private destroyRef: DestroyRef,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private tripService: TripService,
    private dynamicDialogServices: DynamicDialogServices,
    private importService: ImportService,
    private exportService: ExportService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.activatedRoute.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.tripId = params.get('id');
      this.trip = null;
      this.halteForm.reset({
        halteIndex: null,
        penumpangNaik: 0,
        penumpangTurun: 0,
        penumpangTidakTerangkut: 0,
      });

      if (this.isNew()) {
        this.tripForm.reset();
        this.tripForm.patchValue({
          namaSurveyor: this.authService.currentUser()?.name ?? '',
          hariTanggal: new Date(),
        });
        this.isLoading.set(false);
      } else {
        this.loadTrip();
      }
    });

    this.halteForm.controls.halteIndex.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((index) => this.onHalteSelected(index));
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private flashDone(icon: ReturnType<typeof signal<'idle' | 'loading' | 'done'>>): void {
    icon.set('done');
    setTimeout(() => icon.set('idle'), ICON_RESET_DELAY_MS);
  }

  private loadTrip(): void {
    this.isLoading.set(true);
    this.tripService
      .getTrip(this.tripId!)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (found) => {
          if (!found) {
            this.invokeToast('No data found', 'error');
            return;
          }

          this.trip = { ...found, haltes: normaliseHaltes(found.haltes) };

          this.tripForm.patchValue({
            kodeTrip: found.kodeTrip,
            namaSurveyor: found.namaSurveyor,
            hariTanggal: toDate(found.hariTanggal),
            nomorKendaraan: found.nomorKendaraan,
          });
        },
        error: (err) => {
          console.error(err);
          this.invokeToast('Failed to load trip.', 'error');
        },
      });
  }

  isNew(): boolean {
    return !this.tripId || this.tripId === 'new';
  }

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

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

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

    await this.handleImportFile(file);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.handleImportFile(file);
    input.value = '';
  }

  private async handleImportFile(file: File): Promise<void> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      this.invokeToast('Please select a .csv or .xlsx file.', 'warn');
      return;
    }

    this.isLoading.set(true);

    try {
      const imported = await this.importService.parseSingleTripFile(file);
      this.isLoading.set(false);
      this.importTripFromFile(imported);
    } catch (err) {
      this.isLoading.set(false);
      console.error(err);
      this.invokeToast(
        err instanceof Error ? err.message : 'Failed to read the selected file.',
        'error',
      );
    }
  }

  // ── IMPORT ──────────────────────────────────────────────────────────────────

  private importTripFromFile(imported: TripRecord): void {
    const missingFields: string[] = [];
    if (!imported.kodeTrip?.trim()) missingFields.push('Trip Code');
    if (!imported.namaSurveyor?.trim()) missingFields.push('Surveyor');
    if (!imported.nomorKendaraan?.trim()) missingFields.push('Vehicle Number');
    if (!toDate(imported.hariTanggal)) missingFields.push('Date');

    if (missingFields.length > 0) {
      this.invokeToast(
        `Cannot import: missing or invalid ${missingFields.join(', ')} in the file.`,
        'error',
      );
      return;
    }

    // Strip haltes with invalid time order before sending to API
    const cleanedHaltes = imported.haltes.map((halte) => {
      const kedatangan = toDate(halte.waktuKedatangan);
      const keberangkatan = toDate(halte.waktuKeberangkatan);
      if (kedatangan && keberangkatan && keberangkatan <= kedatangan) {
        return { ...halte, waktuKeberangkatan: null };
      }
      return halte;
    });

    const filledCount = cleanedHaltes.filter((h) => h.waktuKedatangan).length;

    this.openConfirmModal(
      `Import trip "${imported.kodeTrip}" from file? ${filledCount} stop(s) with data will be saved.`,
      () => {
        this.isImporting.set(true);

        this.tripService
          .createTripWithHaltes({
            kodeTrip: imported.kodeTrip,
            namaSurveyor: imported.namaSurveyor,
            hariTanggal: imported.hariTanggal,
            nomorKendaraan: imported.nomorKendaraan,
            haltes: cleanedHaltes,
          })
          .pipe(finalize(() => this.isImporting.set(false)))
          .subscribe({
            next: (results) => {
              if (results?.length) {
                this.invokeToast(
                  `Trip imported successfully with ${filledCount} stop(s).`,
                  'success',
                );
                this.router.navigate(['/trip', results[0].id]);
              } else {
                this.invokeToast('Failed to create trip from imported file.', 'error');
              }
            },
            error: (err) => {
              console.error(err);
              this.invokeToast('Failed to create trip from imported file.', 'error');
            },
          });
      },
    );
  }

  // ── EXPORT ──────────────────────────────────────────────────────────────────

  exportCsv(): void {
    if (!this.trip) {
      this.invokeToast('No trip data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trip data to CSV?', () => {
      this.exportService.exportTripCsv(this.trip!);
      this.invokeToast('CSV exported successfully.', 'success');
    });
  }

  exportExcel(): void {
    if (!this.trip) {
      this.invokeToast('No trip data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trip data to Excel?', () => {
      this.exportService.exportTripExcel(this.trip!);
      this.invokeToast('Excel exported successfully.', 'success');
    });
  }

  // ── CREATE TRIP ─────────────────────────────────────────────────────────────

  createTrip(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.openConfirmModal('Save this new trip data?', () => {
      this.isCreatingTrip.set(true);
      this.createTripIcon.set('loading');

      const value = this.tripForm.getRawValue();

      this.tripService
        .createTrip(value)
        .pipe(finalize(() => this.isCreatingTrip.set(false)))
        .subscribe({
          next: (newTrip) => {
            this.flashDone(this.createTripIcon);
            this.invokeToast('Trip successfully created.', 'success');
            this.router.navigate(['/trip', newTrip.id]);
          },
          error: (err) => {
            console.error(err);
            this.createTripIcon.set('idle');
            this.invokeToast('Failed to create trip.', 'error');
          },
        });
    });
  }

  // ── HALTE SELECTION & NAVIGATION ────────────────────────────────────────────

  onHalteSelected(index: number | null): void {
    if (index === null || !this.trip) return;
    const halte = this.trip.haltes[index];
    this.halteForm.patchValue(
      {
        waktuKedatangan: halte.waktuKedatangan,
        waktuKeberangkatan: halte.waktuKeberangkatan,
        penumpangNaik: halte.penumpangNaik ?? 0,
        penumpangTurun: halte.penumpangTurun ?? 0,
        penumpangTidakTerangkut: halte.penumpangTidakTerangkut ?? 0,
      },
      { emitEvent: false },
    );
  }

  editHalte(index: number): void {
    this.halteForm.controls.halteIndex.setValue(index);
  }

  nextHalte(): void {
    const current = this.halteForm.controls.halteIndex.value;

    if (current === null) {
      this.halteForm.controls.halteIndex.setValue(0);
      return;
    }

    this.confirmAndPersist(current, () => {
      if (current < LAST_HALTE_INDEX) {
        this.halteForm.controls.halteIndex.setValue(current + 1);
      }
    });
  }

  previousHalte(): void {
    const current = this.halteForm.controls.halteIndex.value;
    if (current === null) return;

    this.confirmAndPersist(current, () => {
      if (current > 0) {
        this.halteForm.controls.halteIndex.setValue(current - 1);
      }
    });
  }

  canGoPreviousHalte(): boolean {
    const current = this.halteForm.controls.halteIndex.value;
    return current !== null && current > 0;
  }

  canGoNextHalte(): boolean {
    const current = this.halteForm.controls.halteIndex.value;
    return current === null || current < LAST_HALTE_INDEX;
  }

  setNow(control: 'waktuKedatangan' | 'waktuKeberangkatan'): void {
    this.halteForm.controls[control].setValue(new Date());
    this.halteForm.controls[control].markAsTouched();
  }

  // ── UPDATE HALTE ────────────────────────────────────────────────────────────

  updateHalte(): void {
    if (this.halteForm.invalid || !this.trip) {
      this.halteForm.markAllAsTouched();
      return;
    }

    this.openConfirmModal('Update this halte stop data?', () => {
      const index = this.halteForm.controls.halteIndex.value!;
      this.persistHalteData(index, (saved) => {
        if (saved) this.invokeToast('Halte stop data updated successfully.', 'success');
      });
    });
  }

  // ── DELETE HALTE ────────────────────────────────────────────────────────────

  deleteHalteData(index: number): void {
    if (!this.trip) return;

    this.openConfirmModal(`Delete halte stop data for "${HALTE_NAMES[index]}"?`, () => {
      this.isDeletingHalte.set(true);
      this.deleteHalteIcon.set('loading');

      this.tripService
        .deleteHalteData(this.trip!.id, index)
        .pipe(finalize(() => this.isDeletingHalte.set(false)))
        .subscribe({
          next: (updated) => {
            if (updated) {
              this.trip = { ...updated, haltes: normaliseHaltes(updated.haltes) };
              this.flashDone(this.deleteHalteIcon);
              this.invokeToast('Halte stop data deleted successfully.', 'success');
            } else {
              this.deleteHalteIcon.set('idle');
              this.invokeToast('Delete returned no data.', 'warn');
            }

            if (this.halteForm.controls.halteIndex.value === index) {
              this.halteForm.reset({
                halteIndex: index,
                penumpangNaik: 0,
                penumpangTurun: 0,
                penumpangTidakTerangkut: 0,
              });
            }
          },
          error: (err) => {
            console.error('Failed to delete halte data:', err);
            this.deleteHalteIcon.set('idle');
            this.invokeToast('Failed to delete halte stop data.', 'error');
          },
        });
    });
  }

  // ── DELETE TRIP ─────────────────────────────────────────────────────────────

  deleteTrip(): void {
    if (!this.trip) return;

    this.openConfirmModal(
      `Delete trip "${this.trip.kodeTrip}" including its halte stop data? This action will have consequences.`,
      () => {
        this.isDeletingTrip.set(true);
        this.deleteTripIcon.set('loading');

        this.tripService
          .deleteTrip(this.trip!.id)
          .pipe(finalize(() => this.isDeletingTrip.set(false)))
          .subscribe({
            next: () => {
              this.flashDone(this.deleteTripIcon);
              this.invokeToast('Trip deleted successfully.', 'success');
              setTimeout(() => this.router.navigate(['/trip']), 600);
            },
            error: (err) => {
              console.error('Failed to delete trip:', err);
              this.deleteTripIcon.set('idle');
              this.invokeToast('Failed to delete trip.', 'error');
            },
          });
      },
    );
  }

  // ── AUTO-SAVE ON NAV ────────────────────────────────────────────────────────

  private confirmAndPersist(index: number, afterSaved: () => void): void {
    const value = this.halteForm.getRawValue();

    // Skip confirm if nothing to save
    if (!value.waktuKedatangan || !this.isHalteDataChanged(index)) {
      afterSaved();
      return;
    }

    this.ref = this.dynamicDialogServices.confirmModal(
      `Save changes to "${HALTE_NAMES[index]}" before moving on?`,
    );

    if (!this.ref) {
      afterSaved();
      return;
    }

    this.ref.onClose.subscribe((result) => {
      if (result?.isValid) {
        this.persistHalteData(index, (saved) => {
          if (saved) this.invokeToast(`"${HALTE_NAMES[index]}" saved.`, 'success');
          afterSaved();
        });
      } else {
        afterSaved();
      }
    });
  }

  private isHalteDataChanged(index: number): boolean {
    if (!this.trip) return true;

    const stored = this.trip.haltes[index];
    const current = this.halteForm.getRawValue();
    const toTime = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : null);

    return (
      toTime(current.waktuKedatangan) !== toTime(stored.waktuKedatangan) ||
      toTime(current.waktuKeberangkatan) !== toTime(stored.waktuKeberangkatan) ||
      (current.penumpangNaik ?? 0) !== (stored.penumpangNaik ?? 0) ||
      (current.penumpangTurun ?? 0) !== (stored.penumpangTurun ?? 0) ||
      (current.penumpangTidakTerangkut ?? 0) !== (stored.penumpangTidakTerangkut ?? 0)
    );
  }

  private persistHalteData(index: number, onDone: (success: boolean) => void): void {
    if (!this.trip) return onDone(false);

    const value = this.halteForm.getRawValue();
    if (!value.waktuKedatangan) return onDone(false);

    if (this.halteForm.errors?.['timeOrder']) {
      this.invokeToast('Departure must be after arrival.', 'warn');
      return onDone(false);
    }

    this.isSavingHalte.set(true);
    this.saveHalteIcon.set('loading');

    this.tripService
      .updateHalte(this.trip.id, index, value)
      .pipe(finalize(() => this.isSavingHalte.set(false)))
      .subscribe({
        next: (updated) => {
          if (!updated) {
            this.saveHalteIcon.set('idle');
            this.invokeToast('Failed to update halte stop data.', 'error');
            return onDone(false);
          }

          this.trip = { ...updated, haltes: normaliseHaltes(updated.haltes) };

          const savedHalte = this.trip.haltes[index];
          this.halteForm.patchValue(
            {
              waktuKedatangan: savedHalte.waktuKedatangan,
              waktuKeberangkatan: savedHalte.waktuKeberangkatan,
              penumpangNaik: savedHalte.penumpangNaik ?? 0,
              penumpangTurun: savedHalte.penumpangTurun ?? 0,
              penumpangTidakTerangkut: savedHalte.penumpangTidakTerangkut ?? 0,
            },
            { emitEvent: false },
          );

          this.flashDone(this.saveHalteIcon);
          onDone(true);
        },
        error: (err) => {
          console.error(err);
          this.saveHalteIcon.set('idle');
          this.invokeToast('Failed to update halte stop data.', 'error');
          onDone(false);
        },
      });
  }

  // ── DWELL TIME ──────────────────────────────────────────────────────────────

  private computeDwell(
    start: Date | string | null,
    end: Date | string | null,
  ): { label: string; severity: 'success' | 'warn' | 'danger' } | null {
    const s = toDate(start);
    const e = toDate(end);
    if (!s || !e) return null;
    const diffMs = e.getTime() - s.getTime();
    if (diffMs <= 0) return null;
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const label = minutes === 0 ? `${seconds} s` : `${minutes} m ${seconds} s`;
    const severity = minutes <= 3 ? 'success' : minutes <= 6 ? 'warn' : 'danger';
    return { label, severity };
  }

  dwellLabel(): string | null {
    const { waktuKedatangan, waktuKeberangkatan } = this.halteForm.getRawValue();
    return this.computeDwell(waktuKedatangan, waktuKeberangkatan)?.label ?? null;
  }

  dwellSeverity(): 'success' | 'warn' | 'danger' {
    const { waktuKedatangan, waktuKeberangkatan } = this.halteForm.getRawValue();
    return this.computeDwell(waktuKedatangan, waktuKeberangkatan)?.severity ?? 'success';
  }

  dwellLabelFor(halte: HalteEntry): string | null {
    return this.computeDwell(halte.waktuKedatangan, halte.waktuKeberangkatan)?.label ?? null;
  }

  dwellSeverityFor(halte: HalteEntry): 'success' | 'warn' | 'danger' {
    return (
      this.computeDwell(halte.waktuKedatangan, halte.waktuKeberangkatan)?.severity ?? 'success'
    );
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  haltesList(): { index: number; name: string; halte: HalteEntry }[] {
    return this.haltesListComputed();
  }

  filledHalteCount(): number {
    return this.filledHalteCountComputed();
  }

  isHalteFilled(halte: HalteEntry): boolean {
    return !!halte.waktuKedatangan || !!halte.waktuKeberangkatan;
  }

  cancel(): void {
    this.router.navigate(['/trip']);
  }

  routeTo(base: string, id?: string | number) {
    const path = base.startsWith('/') ? base : `/${base}`;
    if (id) {
      this.router.navigate([path, id]);
    } else {
      this.router.navigate([path]);
    }
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
