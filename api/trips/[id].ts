import { sql } from '@vercel/postgres';
import type { VercelRequest, VercelResponse } from '@vercel/node';

process.env.POSTGRES_URL =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

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
  const { id } = req.query;
  const tripId = Number(id);

  if (isNaN(tripId)) {
    return res.status(400).json({ error: 'Invalid trip id' });
  }

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
               hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
        FROM trips WHERE id = ${tripId}
      `;
      if (!rows.length) return res.status(404).json({ error: 'Trip not found' });

      const trip = { ...rows[0], haltes: ensureHaltesArray(rows[0]['haltes']) };
      return res.status(200).json(trip);
    }

    if (req.method === 'PUT') {
      const { kodeTrip, namaSurveyor, hariTanggal, nomorKendaraan } = req.body;

      if (!kodeTrip?.trim() || !namaSurveyor?.trim() || !hariTanggal || !nomorKendaraan?.trim()) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const { rows } = await sql`
        UPDATE trips
        SET kode_trip = ${kodeTrip.trim()},
            nama_surveyor = ${namaSurveyor.trim()},
            hari_tanggal = ${hariTanggal},
            nomor_kendaraan = ${nomorKendaraan.trim()}
        WHERE id = ${tripId}
        RETURNING id, kode_trip AS "kodeTrip", nama_surveyor AS "namaSurveyor",
                  hari_tanggal AS "hariTanggal", nomor_kendaraan AS "nomorKendaraan", haltes
      `;

      if (!rows.length) return res.status(404).json({ error: 'Trip not found' });

      const updated = { ...rows[0], haltes: ensureHaltesArray(rows[0]['haltes']) };
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM trips WHERE id = ${tripId}`;
      return res.status(204).end();
    }

    res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
    return res.status(405).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
