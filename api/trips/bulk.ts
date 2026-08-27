import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { HALTE_NAMES } from '../../shared/halte-names';

interface BulkTripInput {
  kodeTrip: string;
  namaSurveyor: string;
  hariTanggal: string;
  nomorKendaraan: string;
  haltes?: {
    namaHalte: string;
    waktuKedatangan: string | null;
    waktuKeberangkatan: string | null;
    penumpangNaik: number | null;
    penumpangTurun: number | null;
    penumpangTidakTerangkut: number | null;
  }[];
}

function ensureHaltesArray(haltes: unknown): unknown[] {
  if (typeof haltes === 'string') {
    try {
      return JSON.parse(haltes);
    } catch {
      return [];
    }
  }
  return Array.isArray(haltes) ? haltes : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end();
  }

  try {
    const trips: BulkTripInput[] = req.body;

    if (!Array.isArray(trips) || trips.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array of trips' });
    }

    const results = [];

    for (const trip of trips) {
      if (
        !trip.kodeTrip?.trim() ||
        !trip.namaSurveyor?.trim() ||
        !trip.hariTanggal ||
        !trip.nomorKendaraan?.trim()
      ) {
        continue;
      }

      const id = Date.now() + Math.floor(Math.random() * 1000); // random for uniqueness in bulk
      const haltes =
        trip.haltes && trip.haltes.length === HALTE_NAMES.length
          ? trip.haltes
          : HALTE_NAMES.map((namaHalte) => ({
              namaHalte,
              waktuKedatangan: null,
              waktuKeberangkatan: null,
              penumpangNaik: null,
              penumpangTurun: null,
              penumpangTidakTerangkut: null,
            }));

      const { rows } = await sql`
        INSERT INTO trips (id, kode_trip, nama_surveyor, hari_tanggal, nomor_kendaraan, haltes)
        VALUES (${id}, ${trip.kodeTrip.trim()}, ${trip.namaSurveyor.trim()}, ${trip.hariTanggal}, ${trip.nomorKendaraan.trim()}, ${JSON.stringify(haltes)})
        RETURNING id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
                  hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
      `;

      results.push({ ...rows[0], haltes: ensureHaltesArray(rows[0]['haltes']) });
    }

    return res.status(201).json(results);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
