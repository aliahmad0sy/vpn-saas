import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import QRCode from 'qrcode';

export type WireGuardKeypair = {
  privateKey: string;
  publicKey: string;
};

/**
 * Generate a Curve25519 keypair compatible with WireGuard's wg(8) format.
 * WireGuard requires the private scalar to be clamped before being used.
 */
export function generateKeypair(): WireGuardKeypair {
  const privateBytes = nacl.randomBytes(32);
  // Curve25519 clamping per RFC 7748
  privateBytes[0] &= 248;
  privateBytes[31] &= 127;
  privateBytes[31] |= 64;

  const keyPair = nacl.box.keyPair.fromSecretKey(privateBytes);

  return {
    privateKey: naclUtil.encodeBase64(privateBytes),
    publicKey: naclUtil.encodeBase64(keyPair.publicKey),
  };
}

export function generatePresharedKey(): string {
  return naclUtil.encodeBase64(nacl.randomBytes(32));
}

export type WireGuardConfigInput = {
  clientPrivateKey: string;
  clientAddress: string;
  dns: string;
  serverPublicKey: string;
  serverEndpoint: string;
  allowedIps: string;
  presharedKey?: string | null;
  keepalive?: number;
};

export function buildWireGuardConfig(input: WireGuardConfigInput): string {
  const lines = [
    '[Interface]',
    `PrivateKey = ${input.clientPrivateKey}`,
    `Address = ${input.clientAddress}`,
    `DNS = ${input.dns}`,
    '',
    '[Peer]',
    `PublicKey = ${input.serverPublicKey}`,
  ];
  if (input.presharedKey) lines.push(`PresharedKey = ${input.presharedKey}`);
  lines.push(`AllowedIPs = ${input.allowedIps}`);
  lines.push(`Endpoint = ${input.serverEndpoint}`);
  lines.push(`PersistentKeepalive = ${input.keepalive ?? 25}`);
  return lines.join('\n') + '\n';
}

export async function configToQrDataUrl(config: string): Promise<string> {
  return QRCode.toDataURL(config, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
}

/**
 * Given a CIDR like 10.10.0.0/24 and a set of taken host octets,
 * return the next available client address (e.g. 10.10.0.5/32).
 * Reserves .1 for the server gateway.
 */
export function nextClientAddress(subnetCidr: string, takenAddresses: string[]): string {
  const [network, prefixStr] = subnetCidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (prefix !== 24) {
    throw new Error(`Only /24 subnets supported in this implementation, got /${prefix}`);
  }
  const base = network.split('.').slice(0, 3).join('.');
  const taken = new Set<number>([1]);
  for (const addr of takenAddresses) {
    const host = addr.split('/')[0];
    if (host.startsWith(base + '.')) {
      const octet = parseInt(host.split('.')[3], 10);
      if (!Number.isNaN(octet)) taken.add(octet);
    }
  }
  for (let i = 2; i <= 254; i += 1) {
    if (!taken.has(i)) return `${base}.${i}/32`;
  }
  throw new Error('Subnet exhausted');
}
