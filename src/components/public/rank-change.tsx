// rank_delta follows the ranking job's convention: positive means the person
// moved up (a smaller rank number) since the previous week.
export function RankChange({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-muted">nuevo</span>;
  }
  if (delta === 0) {
    return (
      <span className="text-xs text-muted">
        <span aria-hidden>=</span>
        <span className="sr-only">sin cambios</span>
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`text-xs font-medium tabular-nums ${up ? "text-success" : "text-danger"}`}>
      <span aria-hidden>
        {up ? "▲" : "▼"} {Math.abs(delta)}
      </span>
      <span className="sr-only">
        {up ? "subió" : "bajó"} {Math.abs(delta)} {Math.abs(delta) === 1 ? "puesto" : "puestos"}
      </span>
    </span>
  );
}
