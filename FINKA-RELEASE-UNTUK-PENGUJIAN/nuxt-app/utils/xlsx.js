import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const MAX_UNCOMPRESSED_SIZE = 10 * 1024 * 1024
const MAX_ROWS = 1000
const MAX_COLUMNS = 30

function parseXml(xml, fileName) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) {
    throw new Error(`Isi ${fileName} tidak valid.`)
  }
  return document
}

function columnIndex(reference) {
  const letters = String(reference || '').match(/^[A-Z]+/i)?.[0]
  if (!letters) throw new Error('Workbook berisi referensi kolom yang tidak valid.')
  return [...letters.toUpperCase()].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function columnName(index) {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

export function readFirstXlsxSheet(buffer) {
  const files = unzipSync(new Uint8Array(buffer))
  const fileNames = Object.keys(files)
  const unpackedSize = fileNames.reduce((sum, name) => sum + files[name].byteLength, 0)
  if (fileNames.length > 200 || unpackedSize > MAX_UNCOMPRESSED_SIZE) {
    throw new Error('Workbook Excel terlalu besar atau berisi terlalu banyak bagian.')
  }

  const text = (name) => {
    const file = files[name]
    return file ? strFromU8(file) : ''
  }
  const workbookXml = text('xl/workbook.xml')
  const relationshipsXml = text('xl/_rels/workbook.xml.rels')
  if (!workbookXml || !relationshipsXml) throw new Error('File harus berupa workbook Excel .xlsx yang valid.')

  const workbook = parseXml(workbookXml, 'workbook')
  const relationships = parseXml(relationshipsXml, 'relasi workbook')
  const sheet = workbook.getElementsByTagName('sheet')[0]
  const relationshipId = sheet?.getAttributeNS(OFFICE_REL_NS, 'id') || sheet?.getAttribute('r:id')
  const relationship = [...relationships.getElementsByTagName('Relationship')]
    .find((item) => item.getAttribute('Id') === relationshipId)
  if (!relationship) throw new Error('Lembar pertama pada workbook tidak dapat dibaca.')

  const target = relationship.getAttribute('Target')
  const sheetPath = target.startsWith('/')
    ? target.slice(1)
    : target.startsWith('xl/')
      ? target
      : `xl/${target}`
  if (sheetPath.split('/').includes('..')) throw new Error('Lokasi lembar Excel tidak valid.')
  const sheetXml = text(sheetPath)
  if (!sheetXml) throw new Error('Data lembar pertama pada workbook tidak ditemukan.')

  const sharedStringsXml = text('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsXml
    ? [...parseXml(sharedStringsXml, 'shared strings').getElementsByTagName('si')]
      .map((item) => [...item.getElementsByTagName('t')].map((node) => node.textContent || '').join(''))
    : []
  const worksheet = parseXml(sheetXml, 'lembar kerja')
  const rows = []
  const lines = []

  for (const row of worksheet.getElementsByTagName('row')) {
    const rowNumber = Number(row.getAttribute('r'))
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_ROWS) {
      throw new Error(`Nomor baris Excel harus berada di antara 1 dan ${MAX_ROWS}.`)
    }

    const values = []
    for (const cell of row.getElementsByTagName('c')) {
      const index = columnIndex(cell.getAttribute('r'))
      if (index >= MAX_COLUMNS) throw new Error(`Maksimal ${MAX_COLUMNS} kolom dapat dibaca.`)
      const type = cell.getAttribute('t')
      let value = ''
      if (type === 'inlineStr') {
        value = [...cell.getElementsByTagName('t')].map((node) => node.textContent || '').join('')
      } else {
        const raw = cell.getElementsByTagName('v')[0]?.textContent || ''
        if (type === 's') {
          const sharedIndex = Number(raw)
          value = Number.isInteger(sharedIndex) ? sharedStrings[sharedIndex] || '' : ''
        } else {
          value = raw
        }
      }
      values[index] = value
    }
    if (values.some((value) => String(value ?? '').trim())) {
      rows.push(values.map((value) => String(value ?? '').trim()))
      lines.push(rowNumber)
    }
  }

  return { rows, lines }
}

export function createXlsxWorkbook(rows) {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndexValue) => {
      const reference = `${columnName(columnIndexValue)}${rowIndex + 1}`
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowIndex + 1}">${cells}</row>`
  }).join('')

  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Akun Siswa" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`)
  }

  return zipSync(files, { level: 6 })
}
