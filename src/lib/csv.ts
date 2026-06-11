export type CsvHeader = { key: string; label: string }

export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

export function toCsvText(rows: Record<string, unknown>[], headers: CsvHeader[]): string {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : String(v)
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const headerRow = headers.map(h => escape(h.label)).join(',')
  const dataRows = rows.map(row =>
    headers.map(h => escape(row[h.key])).join(',')
  )
  return [headerRow, ...dataRows].join('\r\n')
}

export function parseCsvText(text: string): ParsedCsv {
  // Strip UTF-8 BOM if present
  const clean = text.startsWith('﻿') ? text.slice(1) : text
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter(l => l.trim() !== '')
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const fields: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        let field = ''
        i++ // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else if (line[i] === '"') {
            i++ // skip closing quote
            break
          } else {
            field += line[i]
            i++
          }
        }
        fields.push(field)
        if (line[i] === ',') i++
      } else {
        const end = line.indexOf(',', i)
        if (end === -1) {
          fields.push(line.slice(i))
          break
        }
        fields.push(line.slice(i, end))
        i = end + 1
      }
    }
    return fields
  }

  const headers = parseRow(nonEmpty[0])
  const rows = nonEmpty.slice(1).map(line => {
    const values = parseRow(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = values[idx] ?? '' })
    return obj
  })

  return { headers, rows }
}
