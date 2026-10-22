import "./Table.css";

export function SortableHead({ field, sort, onSort, children, className = "" }) {
  const active = sort?.key === field;
  const direction = active ? sort.direction : null;
  return (
    <th className={className} aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}>
      <button type="button" className="table-sort-button" onClick={() => onSort(field)}>
        <span>{children}</span>
        <span className="table-sort-indicator" aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
      </button>
    </th>
  );
}

function Table({ children, className = "", ...props }) {
  return (
    <div className={`tmc-table-wrap ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

Table.displayName = "Table";

Table.Header = function TableHeader({ children, className = "", ...props }) {
  return (
    <thead className={`tmc-table-thead ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
};

Table.Body = function TableBody({ children, className = "", ...props }) {
  return (
    <tbody className={`tmc-table-tbody ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
};

Table.Row = function TableRow({ children, className = "", ...props }) {
  return (
    <tr className={`tmc-table-row ${className}`.trim()} {...props}>
      {children}
    </tr>
  );
};

Table.Cell = function TableCell({ children, className = "", ...props }) {
  return (
    <td className={`tmc-table-cell ${className}`.trim()} {...props}>
      {children}
    </td>
  );
};

Table.HeadCell = function TableHeadCell({ children, className = "", ...props }) {
  return (
    <th className={`tmc-table-head-cell ${className}`.trim()} {...props}>
      {children}
    </th>
  );
};

export default Table;
