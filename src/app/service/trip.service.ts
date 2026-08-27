import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export { HALTE_NAMES } from '../../../shared/halte-names';

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
  hariTanggal: Date;
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

@Injectable({ providedIn: 'root' })
export class TripService {
  private http = inject(HttpClient);
  private base = '/api/trips';

  getAllTrips(): Observable<TripRecord[]> {
    return this.http.get<TripRecord[]>(this.base);
  }

  getTrip(id: string | number): Observable<TripRecord | null> {
    return this.http.get<TripRecord>(`${this.base}/${id}`).pipe(catchError(() => of(null)));
  }

  createTrip(value: {
    kodeTrip: string;
    namaSurveyor: string;
    hariTanggal: Date | null;
    nomorKendaraan: string;
  }): Observable<TripRecord> {
    return this.http.post<TripRecord>(this.base, value);
  }

  updateTrip(
    id: number,
    value: {
      kodeTrip: string;
      namaSurveyor: string;
      hariTanggal: Date | null;
      nomorKendaraan: string;
    },
  ): Observable<TripRecord | null> {
    return this.http.put<TripRecord>(`${this.base}/${id}`, value).pipe(catchError(() => of(null)));
  }

  /**
   * Bulk-create multiple trips with their haltes in a single API call.
   * Used for file import on the trip list page.
   */
  bulkCreateTrips(trips: Omit<TripRecord, 'id'>[]): Observable<TripRecord[]> {
    return this.http.post<TripRecord[]>(`${this.base}/bulk`, trips);
  }

  /**
   * Create a single trip with pre-filled haltes in one API call.
   * Used for single-trip file import on the trip form page.
   */
  createTripWithHaltes(trip: {
    kodeTrip: string;
    namaSurveyor: string;
    hariTanggal: Date | null;
    nomorKendaraan: string;
    haltes: HalteEntry[];
  }): Observable<TripRecord[]> {
    return this.http.post<TripRecord[]>(`${this.base}/bulk`, [trip]);
  }

  updateHalte(
    tripId: number,
    index: number,
    halte: Partial<HalteEntry>,
  ): Observable<TripRecord | null> {
    return this.http
      .patch<TripRecord>(`${this.base}/${tripId}/halte/${index}`, halte)
      .pipe(catchError(() => of(null)));
  }

  deleteHalteData(tripId: number, index: number): Observable<TripRecord | null> {
    return this.http
      .delete<TripRecord>(`${this.base}/${tripId}/halte/delete/${index}`)
      .pipe(catchError(() => of(null)));
  }

  deleteTrip(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      catchError((err) => {
        console.error('Failed to delete trip:', err);
        throw err;
      }),
    );
  }
}
