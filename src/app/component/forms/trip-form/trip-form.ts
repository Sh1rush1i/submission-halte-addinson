import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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

const LAST_HALTE_INDEX = HALTE_NAMES.length - 1;

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

  isLoading = true;
  tripId: string | null = null;
  trip: TripRecord | null = null;

  readonly halteOptions = HALTE_NAMES.map((name, index) => ({
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

        this.isLoading = false;
      } else {
        this.isLoading = true;
        this.loadTrip();
      }
    });

    this.halteForm.controls.halteIndex.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((index) => this.onHalteSelected(index));
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

    this.isLoading = true;

    try {
      const imported = await this.importService.parseSingleTripFile(file);
      this.isLoading = false;
      this.importTripFromFile(imported);
    } catch (err) {
      this.isLoading = false;
      console.error(err);
      this.invokeToast(
        err instanceof Error ? err.message : 'Failed to read the selected file.',
        'error',
      );
    }
  }

  private importTripFromFile(imported: TripRecord): void {
    const missingFields: string[] = [];
    if (!imported.kodeTrip?.trim()) missingFields.push('Trip Code');
    if (!imported.namaSurveyor?.trim()) missingFields.push('Surveyor');
    if (!imported.nomorKendaraan?.trim()) missingFields.push('Vehicle Number');
    if (!imported.hariTanggal || isNaN(new Date(imported.hariTanggal).getTime())) {
      missingFields.push('Date');
    }

    if (missingFields.length > 0) {
      this.invokeToast(
        `Cannot import: missing or invalid ${missingFields.join(', ')} in the file.`,
        'error',
      );
      return;
    }

    if (imported.haltes.length !== HALTE_NAMES.length) {
      this.invokeToast(
        `Cannot import: this file has ${imported.haltes.length} stops, but this trip expects ${HALTE_NAMES.length}. The data would be misaligned.`,
        'error',
      );
      return;
    }

    if (this.kodeTripExists(imported.kodeTrip)) {
      this.invokeToast(`Cannot import: Trip Code "${imported.kodeTrip}" already exists.`, 'error');
      return;
    }

    this.openConfirmModal(
      `Import trip "${imported.kodeTrip}" from file? This will create a new trip filled with the imported data.`,
      () => {
        const newTrip = this.tripService.createTrip({
          kodeTrip: imported.kodeTrip,
          namaSurveyor: imported.namaSurveyor,
          hariTanggal: imported.hariTanggal,
          nomorKendaraan: imported.nomorKendaraan,
        });

        let importedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        imported.haltes.forEach((halte, index) => {
          if (!halte.waktuKedatangan && !halte.waktuKeberangkatan) return;

          const kedatangan = halte.waktuKedatangan ? new Date(halte.waktuKedatangan) : null;
          const keberangkatan = halte.waktuKeberangkatan
            ? new Date(halte.waktuKeberangkatan)
            : null;

          if (kedatangan && keberangkatan && keberangkatan <= kedatangan) {
            skippedCount++;
            return;
          }

          const updated = this.tripService.updateHalte(newTrip.id, index, {
            waktuKedatangan: kedatangan,
            waktuKeberangkatan: keberangkatan,
            penumpangNaik: halte.penumpangNaik ?? 0,
            penumpangTurun: halte.penumpangTurun ?? 0,
            penumpangTidakTerangkut: halte.penumpangTidakTerangkut ?? 0,
          });

          if (updated) {
            importedCount++;
          } else {
            failedCount++;
          }
        });

        if (failedCount > 0 || skippedCount > 0) {
          this.invokeToast(
            `Trip imported with ${importedCount} stop(s) filled. ${skippedCount + failedCount} stop(s) were skipped due to invalid data.`,
            'warn',
          );
        } else {
          this.invokeToast(`Trip imported successfully with ${importedCount} stop(s).`, 'success');
        }

        this.router.navigate(['/trip', newTrip.id]);
      },
    );
  }

  private kodeTripExists(kodeTrip: string): boolean {
    const stored = localStorage.getItem('tripRecords');
    if (!stored) return false;

    try {
      const records: { kodeTrip: string }[] = JSON.parse(stored);
      const target = kodeTrip.trim().toLowerCase();
      return records.some((r) => r.kodeTrip?.trim().toLowerCase() === target);
    } catch {
      return false;
    }
  }

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

  private loadTrip(): void {
    const found = this.tripService.getTrip(this.tripId!);
    if (!found) {
      this.isLoading = false;
      return;
    }

    this.trip = found;
    this.tripForm.patchValue({
      kodeTrip: found.kodeTrip,
      namaSurveyor: found.namaSurveyor,
      hariTanggal: found.hariTanggal,
      nomorKendaraan: found.nomorKendaraan,
    });

    this.isLoading = false;
  }

  createTrip(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    this.openConfirmModal('Save this new trip data?', () => {
      const value = this.tripForm.getRawValue();
      const newTrip = this.tripService.createTrip(value);

      this.invokeToast('Trip succesfully created.', 'success');
      this.router.navigate(['/trip', newTrip.id]);
      this.loadTrip();
    });
  }

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

  updateHalte(): void {
    if (this.halteForm.invalid || !this.trip) {
      this.halteForm.markAllAsTouched();
      return;
    }

    this.openConfirmModal('Update this halte stop data?', () => {
      const index = this.halteForm.controls.halteIndex.value!;
      const saved = this.persistHalteData(index);

      if (saved) {
        this.invokeToast('Halte stop data updated successfully.', 'success');
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

  deleteHalteData(index: number): void {
    if (!this.trip) return;

    this.openConfirmModal(`Delete halte stop data for "${HALTE_NAMES[index]}"?`, () => {
      const updated = this.tripService.deleteHalteData(this.trip!.id, index);
      if (updated) {
        this.trip = updated;
        this.invokeToast('Halte stop data deleted succesfuly', 'success');
      }

      if (this.halteForm.controls.halteIndex.value === index) {
        this.halteForm.reset({
          halteIndex: index,
          penumpangNaik: 0,
          penumpangTurun: 0,
          penumpangTidakTerangkut: 0,
        });
      }
    });
  }

  deleteTrip(): void {
    if (!this.trip) return;

    this.openConfirmModal(
      `Delete trip "${this.trip.kodeTrip}" including its halte stop data? This action will have consequences.`,
      () => {
        this.tripService.deleteTrip(this.trip!.id);
        this.invokeToast('Trip deleted succesfuly.', 'success');
        this.router.navigate(['/trip']);
      },
    );
  }

  private confirmAndPersist(index: number, afterSaved: () => void): void {
    const value = this.halteForm.getRawValue();

    if (!value.waktuKedatangan || !this.isHalteDataChanged(index)) {
      afterSaved();
      return;
    }

    this.openConfirmModal(
      `Save changes to "${HALTE_NAMES[index]}" before moving on?`,
      () => {
        const saved = this.persistHalteData(index);
        if (saved) {
          this.invokeToast('Halte stop data saved.', 'success');
        }
      },
      () => afterSaved(),
    );
  }

  private isHalteDataChanged(index: number): boolean {
    if (!this.trip) return true;

    const stored = this.trip.haltes[index];
    const current = this.halteForm.getRawValue();
    const toTime = (d: Date | null) => (d ? new Date(d).getTime() : null);

    return (
      toTime(current.waktuKedatangan) !== toTime(stored.waktuKedatangan) ||
      toTime(current.waktuKeberangkatan) !== toTime(stored.waktuKeberangkatan) ||
      (current.penumpangNaik ?? 0) !== (stored.penumpangNaik ?? 0) ||
      (current.penumpangTurun ?? 0) !== (stored.penumpangTurun ?? 0) ||
      (current.penumpangTidakTerangkut ?? 0) !== (stored.penumpangTidakTerangkut ?? 0)
    );
  }

  private persistHalteData(index: number): boolean {
    if (!this.trip) return false;

    const value = this.halteForm.getRawValue();

    if (!value.waktuKedatangan) {
      return false;
    }

    if (!value.waktuKeberangkatan) {
      value.waktuKeberangkatan = new Date();
    }

    if (this.halteForm.errors?.['timeOrder']) {
      this.invokeToast('Departure must be after arrival.', 'warn');
      return false;
    }

    const updated = this.tripService.updateHalte(this.trip.id, index, value);
    if (!updated) {
      this.invokeToast('Failed to update halte stop data.', 'error');
      return false;
    }

    this.trip = updated;

    const savedHalte = updated.haltes[index];
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

    return true;
  }

  private computeDwell(
    start: Date | null,
    end: Date | null,
  ): { label: string; severity: 'success' | 'warn' | 'danger' } | null {
    if (!start || !end) return null;
    const diffMs = end.getTime() - start.getTime();
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

  haltesList(): { index: number; name: string; halte: HalteEntry }[] {
    if (!this.trip) return [];
    return this.trip.haltes.map((halte, index) => ({ index, name: HALTE_NAMES[index], halte }));
  }

  filledHalteCount(): number {
    if (!this.trip) return 0;
    return this.trip.haltes.filter((h) => this.isHalteFilled(h)).length;
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
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
