import { getContentSettings } from "@/lib/public/data";

// Public pages share the announcement banner and maintenance mode from the
// site settings (PLAN §8.3). Sign-in and the admin area live outside this
// group, so staff can still sign in and turn maintenance off.
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const content = await getContentSettings();
  if (content.maintenance) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sitio en mantenimiento</h1>
        <p className="mt-3 text-muted">{content.maintenanceMessage}</p>
      </div>
    );
  }
  return (
    <>
      {content.banner && (
        <div role="note" className="border-b border-border bg-surface">
          <p className="mx-auto w-full max-w-5xl px-4 py-2 text-sm">{content.banner}</p>
        </div>
      )}
      {children}
    </>
  );
}
