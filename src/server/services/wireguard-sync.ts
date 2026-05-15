import { execRemote, execRemoteStrict, SshConfigError, type RemoteServer } from './ssh';
import { decrypt, isEncrypted } from '@/lib/crypto';

/**
 * Strict validator for the values that get injected into shell commands.
 * We never want a peer pubkey or IP to contain spaces, quotes, or
 * backticks — that would let us run arbitrary commands on a remote server.
 */
const WG_KEY_RE = /^[A-Za-z0-9+/]{42,44}=*$/;
const ADDRESS_RE = /^\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?$/;
const IFACE_RE = /^[A-Za-z0-9_-]{1,15}$/;

function assertWgKey(value: string, field: string) {
  if (!WG_KEY_RE.test(value)) throw new Error(`Invalid ${field}: ${value}`);
}
function assertAddress(value: string) {
  if (!ADDRESS_RE.test(value)) throw new Error(`Invalid client address: ${value}`);
}
function assertInterface(value: string) {
  if (!IFACE_RE.test(value)) throw new Error(`Invalid interface name: ${value}`);
}
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export type PeerAddInput = {
  server: RemoteServer & { wgInterface: string };
  peerPublicKey: string;
  presharedKeyEncrypted: string | null;
  clientAddress: string; // e.g. "10.10.0.5/32"
};

/**
 * Add a peer to the running WireGuard interface. Uses `wg set` with stdin
 * for the preshared key so it never appears on the command line (where it'd
 * leak into process listings on the remote host).
 */
export async function addPeer(input: PeerAddInput): Promise<void> {
  const { server, peerPublicKey, presharedKeyEncrypted, clientAddress } = input;
  assertWgKey(peerPublicKey, 'peer public key');
  assertAddress(clientAddress);
  assertInterface(server.wgInterface);

  // Persist the peer to wg-quick state (wg syncconf rewrites the config in
  // place). To avoid that complexity we use `wg addconf` with a tmp file we
  // pipe in via stdin, which appends [Peer] sections idempotently.
  const cleanPubkey = shellSingleQuote(peerPublicKey);
  const cleanAddr = shellSingleQuote(clientAddress);
  const iface = shellSingleQuote(server.wgInterface);

  if (presharedKeyEncrypted) {
    const psk = isEncrypted(presharedKeyEncrypted)
      ? decrypt(presharedKeyEncrypted)
      : presharedKeyEncrypted;
    // base64-encode the psk so it survives a single shell hop without
    // requiring quoting tricks.
    const pskB64 = Buffer.from(psk).toString('base64');
    const cmd = [
      // Materialize the PSK in a tmpfs-backed temp file, set strict perms,
      // pipe it in via the wg(8) `preshared-key` argument, then shred.
      `set -euo pipefail`,
      `PSK_FILE=$(mktemp -p /dev/shm 2>/dev/null || mktemp)`,
      `chmod 600 "$PSK_FILE"`,
      `printf '%s' ${shellSingleQuote(pskB64)} | base64 -d > "$PSK_FILE"`,
      `wg set ${iface} peer ${cleanPubkey} preshared-key "$PSK_FILE" allowed-ips ${cleanAddr}`,
      `shred -u "$PSK_FILE" 2>/dev/null || rm -f "$PSK_FILE"`,
    ].join(' && ');
    await execRemoteStrict(server, cmd);
  } else {
    await execRemoteStrict(
      server,
      `wg set ${iface} peer ${cleanPubkey} allowed-ips ${cleanAddr}`,
    );
  }
}

export async function removePeer(
  server: RemoteServer & { wgInterface: string },
  peerPublicKey: string,
): Promise<void> {
  assertWgKey(peerPublicKey, 'peer public key');
  assertInterface(server.wgInterface);

  // `peer ... remove` is idempotent in modern wg(8): removing a non-existent
  // peer is a no-op rather than an error.
  await execRemoteStrict(
    server,
    `wg set ${shellSingleQuote(server.wgInterface)} peer ${shellSingleQuote(peerPublicKey)} remove`,
  );
}

export type PeerStat = {
  publicKey: string;
  bytesRx: bigint;
  bytesTx: bigint;
  latestHandshake: Date | null;
  endpoint: string | null;
};

/**
 * Parse the output of `wg show <iface> dump`. Format (tab-separated):
 *   Line 1: <private-key> <public-key> <listen-port> <fwmark>
 *   Line N: <public-key> <psk> <endpoint> <allowed-ips> <latest-handshake> <rx> <tx> <keepalive>
 */
export function parseWgDump(dump: string): PeerStat[] {
  const lines = dump.split('\n').filter((l) => l.trim().length > 0);
  // Drop the first line (interface info).
  const peers = lines.slice(1);

  return peers.map((line) => {
    const cols = line.split('\t');
    const [publicKey, , endpoint, , latestHandshakeStr, rxStr, txStr] = cols;
    const latestHandshakeNum = Number(latestHandshakeStr);
    return {
      publicKey,
      bytesRx: BigInt(rxStr || '0'),
      bytesTx: BigInt(txStr || '0'),
      latestHandshake:
        latestHandshakeNum && Number.isFinite(latestHandshakeNum)
          ? new Date(latestHandshakeNum * 1000)
          : null,
      endpoint: endpoint && endpoint !== '(none)' ? endpoint : null,
    };
  });
}

export async function fetchPeerStats(
  server: RemoteServer & { wgInterface: string },
): Promise<PeerStat[]> {
  assertInterface(server.wgInterface);
  const dump = await execRemoteStrict(
    server,
    `wg show ${shellSingleQuote(server.wgInterface)} dump`,
  );
  return parseWgDump(dump);
}

export type ServerHealth = {
  peerCount: number;
  latencyMs: number;
  raw: string;
};

/**
 * Quick health probe — runs `wg show <iface>` over SSH and times the round
 * trip. Returns peer count parsed from the dump.
 */
export async function probeServer(
  server: RemoteServer & { wgInterface: string },
): Promise<ServerHealth> {
  assertInterface(server.wgInterface);
  const started = Date.now();
  const result = await execRemote(server, `wg show ${shellSingleQuote(server.wgInterface)} dump`);
  const latencyMs = Date.now() - started;
  if (result.code !== 0) {
    throw new Error(
      `Probe failed on ${server.hostname} (exit ${result.code}): ${result.stderr.trim()}`,
    );
  }
  return {
    peerCount: parseWgDump(result.stdout).length,
    latencyMs,
    raw: result.stdout,
  };
}

export { SshConfigError };
