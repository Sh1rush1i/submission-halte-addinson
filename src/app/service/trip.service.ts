import { Injectable } from '@angular/core';

/**
 * Fixed list of stops surveyed on every trip (Lampiran A. Formulir Survei On-board).
 * Note "Terminal Purabaya" appears twice on purpose (start and end of the route).
 */
export const HALTE_NAMES: string[] = [
  'Terminal Purabaya',
  'Dukuh Menanggal',
  'Siwalankerto 1',
  'Taman Pelangi',
  'RS Bhayangkara',
  'UBHARA',
  'Pusvetma',
  'Ketintang',
  'Terminal Joyoboyo',
  'Museum BI',
  'RS Darmo',
  'GOZCO',
  'Pandegiling A',
  'Urip Sumoharjo A',
  'Basra',
  'Kaliasin',
  'Embong Malang',
  'Blauran',
  'Pirngadi',
  'Pasar Turi',
  'Masjid Kemayoran',
  'Indrapura',
  'Ikan Kerapu A',
  'Tanjung Torawitan A',
  'Barunawati A',
  'Pelindo Place A',
  'Tanjung Perak',
  'Pelindo Place B',
  'Barunawati B',
  'Tanjung Torawitan B',
  'Ikan Kerapu B',
  'Rajawali',
  'Jembatan Merah',
  'Veteran',
  'Tugu Pahlawan',
  'Alun-alun Contong',
  'Siola',
  'Tunjungan',
  'Simpang Dukuh',
  'Gubernur Suryo',
  'Pangsud',
  'Sono Kembang',
  'Urip Sumoharjo B',
  'Pandegiling B',
  'Santa Maria',
  'Darmo',
  'Marmoyo',
  'Joyoboyo 2',
  'RSAL',
  'Margorejo',
  'Wonocolo',
  'UINSA',
  'Jemur Ngawinan',
  'Siwalankerto 2',
  'Kertomenanggal',
  'Terminal Purabaya',
];

export interface HalteEntry {
  namaHalte: string;
  waktuKedatangan: Date | null;
  waktuKeberangkatan: Date | null;
  penumpangNaik: number | null;
  penumpangTurun: number | null;
  penumpangTidakTerangkut: number | null;
}

export interface TripRecord {
  id: number;
  kodeTrip: string;
  namaSurveyor: string;
  hariTanggal: Date | null;
  nomorKendaraan: string;
  haltes: HalteEntry[];
}

export interface TripFormValue {
  kodeTrip: string;
  namaSurveyor: string;
  hariTanggal: Date | null;
  nomorKendaraan: string;
}

export interface HalteFormValue {
  waktuKedatangan: Date | null;
  waktuKeberangkatan: Date | null;
  penumpangNaik: number | null;
  penumpangTurun: number | null;
  penumpangTidakTerangkut: number | null;
}

function emptyHalte(namaHalte: string): HalteEntry {
  return {
    namaHalte,
    waktuKedatangan: null,
    waktuKeberangkatan: null,
    penumpangNaik: null,
    penumpangTurun: null,
    penumpangTidakTerangkut: null,
  };
}

const STORAGE_KEY = 'tripRecords';

@Injectable({ providedIn: 'root' })
export class TripService {
  private readAll(): TripRecord[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private writeAll(records: TripRecord[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  getTrip(id: string): TripRecord | null {
    const found = this.readAll().find((r) => String(r.id) === id);
    if (!found) return null;

    found.hariTanggal = found.hariTanggal ? new Date(found.hariTanggal) : null;
    found.haltes = found.haltes.map((h) => ({
      ...h,
      waktuKedatangan: h.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
      waktuKeberangkatan: h.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
    }));

    return found;
  }

  createTrip(value: TripFormValue): TripRecord {
    const newTrip: TripRecord = {
      id: Date.now(),
      kodeTrip: value.kodeTrip,
      namaSurveyor: value.namaSurveyor,
      hariTanggal: value.hariTanggal,
      nomorKendaraan: value.nomorKendaraan,
      haltes: HALTE_NAMES.map((name) => emptyHalte(name)),
    };

    const list = this.readAll();
    list.push(newTrip);
    this.writeAll(list);

    return newTrip;
  }

  updateHalte(tripId: number, index: number, value: HalteFormValue): TripRecord | null {
    const list = this.readAll();
    const tripIdx = list.findIndex((r) => r.id === tripId);
    if (tripIdx === -1) return null;

    list[tripIdx].haltes[index] = {
      namaHalte: HALTE_NAMES[index],
      waktuKedatangan: value.waktuKedatangan,
      waktuKeberangkatan: value.waktuKeberangkatan,
      penumpangNaik: value.penumpangNaik,
      penumpangTurun: value.penumpangTurun,
      penumpangTidakTerangkut: value.penumpangTidakTerangkut,
    };

    this.writeAll(list);
    return this.getTrip(String(tripId));
  }

  deleteHalteData(tripId: number, index: number): TripRecord | null {
    const list = this.readAll();
    const tripIdx = list.findIndex((r) => r.id === tripId);
    if (tripIdx === -1) return null;

    list[tripIdx].haltes[index] = emptyHalte(HALTE_NAMES[index]);
    this.writeAll(list);
    return this.getTrip(String(tripId));
  }

  deleteTrip(tripId: number): void {
    const list = this.readAll().filter((r) => r.id !== tripId);
    this.writeAll(list);
  }
}
