import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { HalteEntry, TripRecord } from './trip.service';

type Row = (string | number)[];

@Injectable({
  providedIn: 'root',
})
export class ImportService {
  async parseSingleTripFile(file: File): Promise<TripRecord> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      const rows = this.parseCsvRows(text);

      const isMultiTripFormat = rows.some((r) => r.length === 1 && r[0] === 'Halte Detail');
      if (isMultiTripFormat) {
        throw new Error(
          'This file is a multi-trip export (contains the full trips list), not a single trip. Please use the trip list page to import it instead.',
        );
      }

      const trips = this.parseSingleTripRows(rows);
      return trips[0];
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (workbook.SheetNames.includes('Halte Detail')) {
        throw new Error(
          'This file is a multi-trip export (contains the full trips list), not a single trip. Please use the trip list page to import it instead.',
        );
      }

      if (!workbook.SheetNames.includes('Halte Data')) {
        throw new Error('Recognized sheet ("Halte Data") not found in this file.');
      }

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Halte Data'], {
        header: 1,
        raw: false,
        defval: '',
      }) as Row[];

      const trips = this.parseSingleTripRows(rows);
      return trips[0];
    }

    throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
  }

  async parseFile(file: File): Promise<TripRecord[]> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      const text = await file.text();
      return this.parseFromRows(this.parseCsvRows(text));
    }

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      return this.parseFromWorkbook(workbook);
    }

    throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  private parseCsvRows(text: string): Row[] {
    return text
      .split(/\r\n|\n/)
      .filter((line) => line.length > 0)
      .map((line) => this.parseCsvLine(line));
  }

  private parseFromWorkbook(workbook: XLSX.WorkBook): TripRecord[] {
    if (workbook.SheetNames.includes('Halte Detail')) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Halte Detail'], {
        header: 1,
        raw: false,
        defval: '',
      }) as Row[];
      return this.parseMultiTripRows(rows);
    }

    if (workbook.SheetNames.includes('Halte Data')) {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Halte Data'], {
        header: 1,
        raw: false,
        defval: '',
      }) as Row[];
      return this.parseSingleTripRows(rows);
    }

    throw new Error('Recognized sheet ("Halte Detail" or "Halte Data") not found in this file.');
  }

  private parseFromRows(rows: Row[]): TripRecord[] {
    const hasMultiMarker = rows.some((r) => r.length === 1 && r[0] === 'Halte Detail');
    if (hasMultiMarker) {
      const markerIndex = rows.findIndex((r) => r.length === 1 && r[0] === 'Halte Detail');
      return this.parseMultiTripRows(rows.slice(markerIndex));
    }

    return this.parseSingleTripRows(rows);
  }

  private parseMultiTripRows(rows: Row[]): TripRecord[] {
    const headerIndex = rows.findIndex(
      (r) => String(r[0]).trim() === 'Trip Code' && String(r[4]).trim() === 'No',
    );
    if (headerIndex === -1) {
      throw new Error('Could not find the Halte Detail header row in this file.');
    }

    const dataRows = rows
      .slice(headerIndex + 1)
      .filter((r) => r.length > 1 && String(r[0]).trim() !== '');

    const grouped = new Map<string, TripRecord>();
    let idCounter = Date.now();

    for (const row of dataRows) {
      const cells = row.map((c) => String(c));
      const [
        kodeTrip,
        namaSurveyor,
        tanggal,
        nomorKendaraan,
        ,
        namaHalte,
        datang,
        berangkat,
        naik,
        turun,
        tidakTerangkut,
      ] = cells;

      const key = `${kodeTrip}|${tanggal}|${nomorKendaraan}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: idCounter++,
          kodeTrip,
          namaSurveyor,
          hariTanggal: this.parseDateOnly(tanggal),
          nomorKendaraan,
          haltes: [],
        });
      }

      grouped.get(key)!.haltes.push({
        namaHalte,
        waktuKedatangan: this.parseDateTime(datang),
        waktuKeberangkatan: this.parseDateTime(berangkat),
        penumpangNaik: this.parseNumber(naik),
        penumpangTurun: this.parseNumber(turun),
        penumpangTidakTerangkut: this.parseNumber(tidakTerangkut),
      });
    }

    return Array.from(grouped.values());
  }

  private parseSingleTripRows(rows: Row[]): TripRecord[] {
    const infoKeys = ['Trip Code', 'Surveyor', 'Date', 'Vehicle Number'];
    const infoMap = new Map<string, string>();
    let headerIndex = -1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const first = String(row[0]).trim();

      if (row.length >= 2 && infoKeys.includes(first)) {
        infoMap.set(first, String(row[1]));
      }
      if (first === 'No' && String(row[1]).trim() === 'Halte') {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      throw new Error('Could not find the halte data table in this file.');
    }

    const dataRows = rows
      .slice(headerIndex + 1)
      .filter((r) => r.length > 1 && String(r[0]).trim() !== '');

    const haltes: HalteEntry[] = dataRows.map((row) => {
      const cells = row.map((c) => String(c));
      const [, namaHalte, datang, berangkat, naik, turun, tidakTerangkut] = cells;
      return {
        namaHalte,
        waktuKedatangan: this.parseDateTime(datang),
        waktuKeberangkatan: this.parseDateTime(berangkat),
        penumpangNaik: this.parseNumber(naik),
        penumpangTurun: this.parseNumber(turun),
        penumpangTidakTerangkut: this.parseNumber(tidakTerangkut),
      };
    });

    const trip: TripRecord = {
      id: Date.now(),
      kodeTrip: infoMap.get('Trip Code') ?? 'Imported Trip',
      namaSurveyor: infoMap.get('Surveyor') ?? '',
      hariTanggal: this.parseDateOnly(infoMap.get('Date') ?? ''),
      nomorKendaraan: infoMap.get('Vehicle Number') ?? '',
      haltes,
    };

    return [trip];
  }

  private parseDateTime(value: string): Date | null {
    if (!value || value === '-') return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match.map(Number);
    return new Date(y, mo - 1, d, h, mi, s);
  }

  private parseDateOnly(value: string): Date {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date();
    const [, y, mo, d] = match.map(Number);
    return new Date(y, mo - 1, d);
  }

  private parseNumber(value: string): number {
    const n = Number(value);
    return isNaN(n) ? 0 : n;
  }
}
