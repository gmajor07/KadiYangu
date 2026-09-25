import Link from "next/link";
export function AdminPagination({
  page,
  total,
  path,
}: {
  page: number;
  total: number;
  path: string;
}) {
  const pages = Math.max(1, Math.ceil(total / 30));
  return (
    <nav
      aria-label="Admin list pagination"
      className="mt-7 flex flex-wrap gap-5 text-sm"
    >
      {page > 1 && (
        <Link className="underline" href={`${path}?page=${page - 1}`}>
          ← Previous
        </Link>
      )}
      <span>
        Page {page} · {total} records
      </span>
      {page < pages && (
        <Link className="underline" href={`${path}?page=${page + 1}`}>
          Next →
        </Link>
      )}
    </nav>
  );
}
