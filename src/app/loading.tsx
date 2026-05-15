import { Spinner } from '@/components/ui/loading';

export default function RootLoading() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-slate-500">
      <div className="flex items-center gap-2 text-sm">
        <Spinner /> Loading…
      </div>
    </div>
  );
}
