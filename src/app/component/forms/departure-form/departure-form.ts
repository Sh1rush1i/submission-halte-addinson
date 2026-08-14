import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
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

function timeOrderValidator(group: AbstractControl): ValidationErrors | null {
  const berhenti = group.get('waktuBerhenti')?.value;
  const jalan = group.get('waktuJalan')?.value;
  if (!berhenti || !jalan) return null;
  return new Date(jalan) > new Date(berhenti) ? null : { timeOrder: true };
}

const STORAGE_KEY = 'departureRecords';

@Component({
  selector: 'app-departure-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    DatePickerModule,
    FullPageLoading,
  ],
  templateUrl: './departure-form.html',
  styleUrl: './departure-form.css',
})
export class DepartureForm {
  isLoading = true;
  departureId: string | null | undefined;
  private fb = inject(FormBuilder);

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {}

  readonly form = this.fb.nonNullable.group(
    {
      id: [0],
      kodeTrip: ['', Validators.required],
      waktuBerhenti: ['', Validators.required],
      waktuJalan: [''],
      penumpangNaik: [0, [Validators.required, Validators.min(0)]],
      penumpangTurun: [0, [Validators.required, Validators.min(0)]],
      penumpangTidakTerangkut: [0, [Validators.required, Validators.min(0)]],
    },
    { validators: timeOrderValidator },
  );

  ngOnInit(): void {
    if (!this.isNew()) {
      this.getData();
    }
    this.isLoading = false;
  }

  isNew(): boolean {
    const id = this.activatedRoute.snapshot.paramMap.get('id');
    if (id === 'new' || !id) {
      return true;
    } else {
      this.departureId = id;
      return false;
    }
  }

  setNow(control: 'waktuBerhenti' | 'waktuJalan'): void {
    this.form.controls[control].setValue(this.toDatetimeLocal(new Date()));
    this.form.controls[control].markAsTouched();
  }

  private readAll(): DepartureRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private writeAll(records: DepartureRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  getData(): void {
    const found = this.readAll().find((r) => String(r.id) === this.departureId);
    if (!found) return;

    this.form.patchValue({
      id: found.id,
      kodeTrip: found.kodeTrip,
      waktuBerhenti: this.toDatetimeLocal(found.waktuBerhenti),
      waktuJalan: this.toDatetimeLocal(found.waktuJalan),
      penumpangNaik: found.penumpangNaik,
      penumpangTurun: found.penumpangTurun,
      penumpangTidakTerangkut: found.penumpangTidakTerangkut,
    });
  }

  private toDatetimeLocal(value: Date | string): string {
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  dwellLabel(): string | null {
    const { waktuBerhenti, waktuJalan } = this.form.getRawValue();
    if (!waktuBerhenti || !waktuJalan) return null;
    const diffMs = new Date(waktuJalan).getTime() - new Date(waktuBerhenti).getTime();
    if (diffMs <= 0) return null;
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes === 0 ? `${seconds} m` : `${minutes} m ${seconds} s`;
  }

  dwellSeverity(): 'success' | 'warn' | 'danger' {
    const { waktuBerhenti, waktuJalan } = this.form.getRawValue();
    const minutes = (new Date(waktuJalan).getTime() - new Date(waktuBerhenti).getTime()) / 60000;
    if (minutes <= 3) return 'success';
    if (minutes <= 6) return 'warn';
    return 'danger';
  }

  onSubmit(): void {
    if (!this.form.controls.waktuJalan.value) {
      this.form.controls.waktuJalan.setValue(this.toDatetimeLocal(new Date()));
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const record: DepartureRecord = {
      id: this.isNew() ? Date.now() : Number(this.departureId),
      kodeTrip: value.kodeTrip,
      waktuBerhenti: new Date(value.waktuBerhenti),
      waktuJalan: new Date(value.waktuJalan),
      penumpangNaik: value.penumpangNaik,
      penumpangTurun: value.penumpangTurun,
      penumpangTidakTerangkut: value.penumpangTidakTerangkut,
    };

    const list = this.readAll();
    const idx = list.findIndex((r) => String(r.id) === String(record.id));
    if (idx > -1) {
      list[idx] = record;
    } else {
      list.push(record);
    }
    this.writeAll(list);

    this.router.navigate(['/departure'], { relativeTo: this.activatedRoute });
  }

  cancel(): void {
    this.router.navigate(['/departure'], { relativeTo: this.activatedRoute });
  }
}
