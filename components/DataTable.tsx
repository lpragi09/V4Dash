export interface DataTableColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  getRowKey: (row: T, index: number) => string;
}

/** Tabela genérica usada nas seções de detalhamento (por campanha, palavra-chave, etc). */
export default function DataTable<T>({ columns, rows, emptyMessage = 'Sem dados no período.', getRowKey }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#27272a]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-2 py-2.5 font-medium text-zinc-500 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={getRowKey(row, i)} className="border-b border-[#27272a]/50 last:border-0 hover:bg-white/[0.02] transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-2 py-2.5 text-zinc-300 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
