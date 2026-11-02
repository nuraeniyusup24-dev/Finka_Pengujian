const NAMA_BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Format tanggal polos 'YYYY-MM-DD' (mis. jatuh_tempo tagihan) jadi '10 Sep 2026'
export function tanggalIndo(ymd) {
  if (!ymd) return ''
  const [y, m, d] = ymd.split('-').map(Number)
  return d + ' ' + NAMA_BULAN_ID[m - 1] + ' ' + y
}

// SQLite datetime('now') menyimpan UTC. Tampilkan dalam WIB (UTC+7) biar
// jamnya masuk akal buat pengguna di Indonesia.

function bagianWaktu(datetime) {
  if (!datetime) return { tanggalKey: '', jam: '', label: '' }

  // Mendukung format ISO dan format datetime SQLite.
  const nilai = String(datetime)
  const utc = new Date(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(nilai)
      ? nilai.replace(' ', 'T') + 'Z'
      : nilai
  )

  if (Number.isNaN(utc.getTime())) {
    return { tanggalKey: '', jam: '', label: '' }
  }

  const wib = new Date(utc.getTime() + 7 * 3600 * 1000)
  const jam = String(wib.getUTCHours()).padStart(2, '0') + '.' +
    String(wib.getUTCMinutes()).padStart(2, '0')

  const tanggalKey =
    wib.getUTCFullYear() + '-' +
    String(wib.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(wib.getUTCDate()).padStart(2, '0')

  const label = wib.getUTCDate() + ' ' +
    NAMA_BULAN_ID[wib.getUTCMonth()] + ' ' +
    wib.getUTCFullYear()

  return { tanggalKey, jam, label }
}


const JUDUL = {
  topup: 'Top-up saldo',
  pembelian: 'Belanja',
  tarik_tunai: 'Tarik tunai',
  bayar_tagihan: 'Bayar tagihan',
  penyesuaian: 'Penyesuaian saldo'
}

export function trxDariLedger(row) {
  const w = bagianWaktu(row.created_at)
  return {
    id: row.id,
    judul: JUDUL[row.tipe] || row.tipe,
    meta: w.jam + (row.keterangan ? ' · ' + row.keterangan : ''),
    kasir: row.oleh_nama || '',
    nominal: row.nominal,
    sisa: row.sisa,
    tanggalKey: w.tanggalKey,
    tanggalLabel: w.label,
    createdAt: row.created_at
  }
}

