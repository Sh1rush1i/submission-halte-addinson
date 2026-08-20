import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { HalteEntry, TripRecord } from './trip.service';

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  private formatDateTime(value: Date | string | null | undefined): string {
    if (!value) return '-';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '-';

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private formatDateOnly(value: Date | string | null | undefined): string {
    return this.formatDateTime(value).split(' ')[0];
  }

  private escapeCsvField(value: string | number): string {
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private downloadCsv(rows: (string | number)[][], filename: string): void {
    const csvContent = rows
      .map((row) => row.map((cell) => this.escapeCsvField(cell)).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  private downloadExcel(
    sheetData: (string | number)[][],
    columnWidths: { wch: number }[],
    sheetName: string,
    filename: string,
  ): void {
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    XLSX.writeFile(workbook, filename);
  }

  private filledCount(haltes: HalteEntry[]): number {
    return haltes.filter((h) => !!h.waktuKedatangan || !!h.waktuKeberangkatan).length;
  }

  private buildHalteRows(trip: TripRecord): (string | number)[][] {
    const header = [
      'No',
      'Halte',
      'Waktu Kedatangan',
      'Waktu Keberangkatan',
      'Penumpang Naik',
      'Penumpang Turun',
      'Penumpang Tidak Terangkut',
    ];

    const rows = trip.haltes.map((halte, index) => [
      index + 1,
      halte.namaHalte,
      this.formatDateTime(halte.waktuKedatangan),
      this.formatDateTime(halte.waktuKeberangkatan),
      halte.penumpangNaik ?? 0,
      halte.penumpangTurun ?? 0,
      halte.penumpangTidakTerangkut ?? 0,
    ]);

    return [header, ...rows];
  }

  exportTripCsv(trip: TripRecord): void {
    const infoRows: (string | number)[][] = [
      ['Trip Code', trip.kodeTrip],
      ['Surveyor', trip.namaSurveyor],
      ['Date', this.formatDateOnly(trip.hariTanggal)],
      ['Vehicle Number', trip.nomorKendaraan],
      [],
    ];

    const rows = [...infoRows, ...this.buildHalteRows(trip)];
    this.downloadCsv(rows, `${trip.kodeTrip || 'trip'}-halte-data.csv`);
  }

  exportTripExcel(trip: TripRecord): void {
    const infoRows: (string | number)[][] = [
      ['Trip Code', trip.kodeTrip],
      ['Surveyor', trip.namaSurveyor],
      ['Date', this.formatDateOnly(trip.hariTanggal)],
      ['Vehicle Number', trip.nomorKendaraan],
      [],
    ];

    const rows = [...infoRows, ...this.buildHalteRows(trip)];

    this.downloadExcel(
      rows,
      [
        { wch: 6 }, // No
        { wch: 24 }, // Halte
        { wch: 20 }, // Waktu Kedatangan
        { wch: 20 }, // Waktu Keberangkatan
        { wch: 15 }, // Naik
        { wch: 15 }, // Turun
        { wch: 22 }, // Tidak Terangkut
      ],
      'Halte Data',
      `${trip.kodeTrip || 'trip'}-halte-data.xlsx`,
    );
  }

  private buildTripListRows(records: TripRecord[]): (string | number)[][] {
    const header = [
      'No',
      'Trip Code',
      'Surveyor',
      'Date',
      'Vehicle Number',
      'Stops Filled',
      'Total Stops',
    ];

    const rows = records.map((record, index) => [
      index + 1,
      record.kodeTrip,
      record.namaSurveyor,
      this.formatDateOnly(record.hariTanggal),
      record.nomorKendaraan,
      this.filledCount(record.haltes),
      record.haltes.length,
    ]);

    return [header, ...rows];
  }

  private buildAllHaltesRows(records: TripRecord[]): (string | number)[][] {
    const header = [
      'Trip Code',
      'Surveyor',
      'Date',
      'Vehicle Number',
      'No',
      'Halte',
      'Waktu Kedatangan',
      'Waktu Keberangkatan',
      'Penumpang Naik',
      'Penumpang Turun',
      'Penumpang Tidak Terangkut',
    ];

    const rows = records.flatMap((record) =>
      record.haltes.map((halte, index) => [
        record.kodeTrip,
        record.namaSurveyor,
        this.formatDateOnly(record.hariTanggal),
        record.nomorKendaraan,
        index + 1,
        halte.namaHalte,
        this.formatDateTime(halte.waktuKedatangan),
        this.formatDateTime(halte.waktuKeberangkatan),
        halte.penumpangNaik ?? 0,
        halte.penumpangTurun ?? 0,
        halte.penumpangTidakTerangkut ?? 0,
      ]),
    );

    return [header, ...rows];
  }

  exportTripsCsv(records: TripRecord[], filename = 'trip-records.csv'): void {
    const summaryBlock = this.buildTripListRows(records);
    const haltesBlock = this.buildAllHaltesRows(records);

    const rows: (string | number)[][] = [
      ['Trip Summary'],
      ...summaryBlock,
      [],
      ['Halte Detail'],
      ...haltesBlock,
    ];

    this.downloadCsv(rows, filename);
  }

  exportTripsExcel(records: TripRecord[], filename = 'trip-records.xlsx'): void {
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(this.buildTripListRows(records));
    summaryWorksheet['!cols'] = [
      { wch: 6 }, // No
      { wch: 16 }, // Trip Code
      { wch: 22 }, // Surveyor
      { wch: 14 }, // Date
      { wch: 16 }, // Vehicle Number
      { wch: 14 }, // Stops Filled
      { wch: 12 }, // Total Stops
    ];

    const haltesWorksheet = XLSX.utils.aoa_to_sheet(this.buildAllHaltesRows(records));
    haltesWorksheet['!cols'] = [
      { wch: 16 }, // Trip Code
      { wch: 22 }, // Surveyor
      { wch: 14 }, // Date
      { wch: 16 }, // Vehicle Number
      { wch: 6 }, // No
      { wch: 24 }, // Halte
      { wch: 20 }, // Waktu Kedatangan
      { wch: 20 }, // Waktu Keberangkatan
      { wch: 15 }, // Naik
      { wch: 15 }, // Turun
      { wch: 22 }, // Tidak Terangkut
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Trip Summary');
    XLSX.utils.book_append_sheet(workbook, haltesWorksheet, 'Halte Detail');

    XLSX.writeFile(workbook, filename);
  }
}
