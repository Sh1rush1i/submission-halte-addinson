import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
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
      waktuKedatangan: this.fb.control<Date | null>(null),
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

    this.ref = this.dynamicDialogServices.confirmModal('Save this new trip data?');
    if (!this.ref) return;

    this.ref.onClose.subscribe((result) => {
      if (!result?.isValid) return;

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

  previousHalte(): void {
    const current = this.halteForm.controls.halteIndex.value;
    if (current === null) return;
    if (current > 0) {
      this.halteForm.controls.halteIndex.setValue(current - 1);
    }
  }

  nextHalte(): void {
    const current = this.halteForm.controls.halteIndex.value;
    if (current === null) {
      this.halteForm.controls.halteIndex.setValue(0);
      return;
    }
    if (current < LAST_HALTE_INDEX) {
      this.halteForm.controls.halteIndex.setValue(current + 1);
    }
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

  updateHalte(): void {
    if (this.halteForm.invalid || !this.trip) {
      this.halteForm.markAllAsTouched();
      return;
    }

    this.ref = this.dynamicDialogServices.confirmModal('Update this halte stop data?');
    if (!this.ref) return;

    this.ref.onClose.subscribe((result) => {
      if (!result?.isValid) return;

      const value = this.halteForm.getRawValue();
      const index = value.halteIndex!;
      const updated = this.tripService.updateHalte(this.trip!.id, index, value);

      if (updated) {
        this.trip = updated;
        this.invokeToast('Halte stop data updated succesfuly.', 'success');
      }
    });
  }

  deleteHalteData(index: number): void {
    if (!this.trip) return;

    this.ref = this.dynamicDialogServices.confirmModal(
      `Delete halte stop data for "${HALTE_NAMES[index]}"?`,
    );
    if (!this.ref) return;

    this.ref.onClose.subscribe((result) => {
      if (!result?.isValid) return;

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

    this.ref = this.dynamicDialogServices.confirmModal(
      `Delete trip "${this.trip.kodeTrip}" including its halte stop data? This action will have consequences.`,
    );
    if (!this.ref) return;

    this.ref.onClose.subscribe((result) => {
      if (!result?.isValid) return;

      this.tripService.deleteTrip(this.trip!.id);
      this.invokeToast('Trip deleted succesfuly.', 'success');
      this.router.navigate(['/trip']);
    });
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

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
