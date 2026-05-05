import type { ReactNode } from 'react'

export type ColumnAlign = 'left' | 'right' | 'center'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  align?: ColumnAlign
  /** Apply the .num class — tabular-nums + IBM Plex Mono right-aligned. */
  numeric?: boolean
  /** Optional column-level cell renderer. Receives the row's data object. */
  render?: (row: T) => ReactNode
  /** Optional CSS class applied to thead th and every tbody td in this column. */
  cellClassName?: string
  /** Optional inline width (e.g. '120px', '20%'). */
  width?: string
}

export type DataTableRow<T> =
  | { type: 'header'; key: string; label: ReactNode }
  | { type: 'item'; key: string; data: T }
  | { type: 'subtotal'; key: string; label: ReactNode; values: Record<string, ReactNode> }
  | { type: 'total'; key: string; label: ReactNode; values: Record<string, ReactNode> }

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: DataTableRow<T>[]
  caption?: string
  className?: string
}

function alignClass(align?: ColumnAlign, numeric?: boolean): string {
  if (numeric) return 'text-right'
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}

function numClass(numeric?: boolean): string {
  return numeric ? 'num' : ''
}

export function DataTable<T>({ columns, rows, caption, className }: DataTableProps<T>) {
  const totalCols = columns.length

  return (
    <div className={['overflow-x-auto sl-scroll', className ?? ''].filter(Boolean).join(' ')}>
      <table className="sl-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={[alignClass(col.align, col.numeric), numClass(col.numeric), col.cellClassName ?? ''].filter(Boolean).join(' ')}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.type === 'header') {
              return (
                <tr key={row.key} className="section-header">
                  <td colSpan={totalCols}>{row.label}</td>
                </tr>
              )
            }
            if (row.type === 'item') {
              return (
                <tr key={row.key}>
                  {columns.map((col) => {
                    const content = col.render
                      ? col.render(row.data)
                      : ((row.data as unknown as Record<string, ReactNode>)[col.key] ?? null)
                    return (
                      <td
                        key={col.key}
                        className={[alignClass(col.align, col.numeric), numClass(col.numeric), col.cellClassName ?? ''].filter(Boolean).join(' ')}
                      >
                        {content}
                      </td>
                    )
                  })}
                </tr>
              )
            }
            const subtotalClass = row.type === 'total' ? 'total' : ''
            const subtotalBg = row.type === 'subtotal' ? 'bg-slate-50/50' : ''
            return (
              <tr key={row.key} className={[subtotalClass, subtotalBg].filter(Boolean).join(' ')}>
                {columns.map((col, idx) => {
                  if (idx === 0) {
                    return (
                      <td
                        key={col.key}
                        className={[alignClass(col.align, false), col.cellClassName ?? '', 'font-semibold'].filter(Boolean).join(' ')}
                      >
                        {row.label}
                      </td>
                    )
                  }
                  const content = row.values[col.key] ?? null
                  return (
                    <td
                      key={col.key}
                      className={[alignClass(col.align, col.numeric), numClass(col.numeric), col.cellClassName ?? '', 'font-semibold'].filter(Boolean).join(' ')}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
