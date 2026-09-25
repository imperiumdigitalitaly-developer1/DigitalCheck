export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      <p className="mx-auto mt-2 max-w-prose text-sm text-ink-soft">{description}</p>
    </div>
  );
}
