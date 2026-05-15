'use client';

import { useState } from 'react';
import { Download, QrCode, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { revokeVpnConfigAction } from '@/server/actions/vpn';
import { formatDate } from '@/lib/utils';

type Item = {
  id: string;
  name: string;
  serverName: string;
  serverLocation: string;
  address: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
};

export function ConfigList({ configs }: { configs: Item[] }) {
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  async function openQr(id: string) {
    setQrFor(id);
    setQrData(null);
    setLoadingQr(true);
    try {
      const res = await fetch(`/api/v1/configs/${id}?format=qr`);
      if (res.ok) {
        const data = (await res.json()) as { qr: string };
        setQrData(data.qr);
      }
    } finally {
      setLoadingQr(false);
    }
  }

  return (
    <div className="divide-y divide-slate-200 dark:divide-slate-800">
      {configs.map((c) => (
        <div key={c.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{c.name}</p>
              <Badge tone={c.status === 'ACTIVE' ? 'success' : 'default'}>{c.status.toLowerCase()}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {c.serverName} · {c.serverLocation} · {c.address}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Created {formatDate(c.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {c.status === 'ACTIVE' && (
              <>
                <a href={`/api/v1/configs/${c.id}?format=file`} download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> .conf
                  </Button>
                </a>
                <Button variant="outline" size="sm" onClick={() => openQr(c.id)} type="button">
                  <QrCode className="h-4 w-4" /> QR
                </Button>
                <form action={revokeVpnConfigAction}>
                  <input type="hidden" name="configId" value={c.id} />
                  <Button variant="danger" size="sm" type="submit">
                    <Trash2 className="h-4 w-4" /> Revoke
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      ))}

      {qrFor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => setQrFor(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQrFor(null)}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-lg font-semibold">Scan with WireGuard</h3>
            <p className="mt-1 text-sm text-slate-500">
              Open the WireGuard mobile app and tap &quot;Scan from QR code&quot;.
            </p>
            <div className="mt-4 flex aspect-square items-center justify-center rounded-xl bg-white p-2">
              {loadingQr || !qrData ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrData} alt="WireGuard config QR" className="h-full w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
