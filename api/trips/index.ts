import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

process.env.POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

const HALTE_NAMES: string[] = [
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
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
               hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
        FROM trips ORDER BY id DESC
      `;

      const parsed = rows.map((r) => ({ ...r, haltes: ensureHaltesArray(r['haltes']) }));
      return res.status(200).json(parsed);
    }

    if (req.method === 'POST') {
      const { kodeTrip, namaSurveyor, hariTanggal, nomorKendaraan } = req.body;

      if (!kodeTrip?.trim() || !namaSurveyor?.trim() || !hariTanggal || !nomorKendaraan?.trim()) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const id = Date.now();
      const haltes = HALTE_NAMES.map((namaHalte) => ({
        namaHalte,
        waktuKedatangan: null,
        waktuKeberangkatan: null,
        penumpangNaik: null,
        penumpangTurun: null,
        penumpangTidakTerangkut: null,
      }));

      const { rows } = await sql`
        INSERT INTO trips (id, kode_trip, nama_surveyor, hari_tanggal, nomor_kendaraan, haltes)
        VALUES (${id}, ${kodeTrip.trim()}, ${namaSurveyor.trim()}, ${hariTanggal}, ${nomorKendaraan.trim()}, ${JSON.stringify(haltes)})
        RETURNING id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
                  hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
      `;

      const created = { ...rows[0], haltes: ensureHaltesArray(rows[0]['haltes']) };
      return res.status(201).json(created);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
