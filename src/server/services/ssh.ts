import { Client, type ConnectConfig } from 'ssh2';
import { createHash } from 'crypto';
import { decrypt, isEncrypted } from '@/lib/crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

export type RemoteServer = {
  id: string;
  hostname: string;
  sshHost: string | null;
  sshPort: number;
  sshUser: string | null;
  sshPrivateKey: string | null;
  sshHostFingerprint: string | null;
};

export type ExecResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

export class SshConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SshConfigError';
  }
}

function ensureManaged(server: RemoteServer): asserts server is RemoteServer & {
  sshHost: string;
  sshUser: string;
  sshPrivateKey: string;
} {
  if (!server.sshHost || !server.sshUser || !server.sshPrivateKey) {
    throw new SshConfigError(
      `Server ${server.hostname} is not configured for remote management ` +
        `(missing sshHost/sshUser/sshPrivateKey).`,
    );
  }
}

function privateKeyMaterial(stored: string): Buffer {
  const text = isEncrypted(stored) ? decrypt(stored) : stored;
  return Buffer.from(text);
}

/**
 * SHA-256 fingerprint comparison against the stored value. Stored format must
 * be either a hex digest or the standard `SHA256:base64` form (with or
 * without the prefix).
 */
function fingerprintMatches(expected: string, actualKey: Buffer): boolean {
  const want = expected.replace(/^SHA256:/, '').trim();
  const sha256 = createHash('sha256').update(actualKey).digest();
  const hex = sha256.toString('hex');
  const b64 = sha256.toString('base64').replace(/=+$/, '');
  return want === hex || want === b64;
}

/**
 * Opens an SSH session, runs the command, and tears down the connection.
 * Verifies the host key against the stored fingerprint if one is set.
 *
 * Never logs commands or output at info level — both may contain
 * sensitive data (peer pubkeys, traffic counters, etc).
 */
export async function execRemote(server: RemoteServer, command: string): Promise<ExecResult> {
  ensureManaged(server);

  return new Promise<ExecResult>((resolve, reject) => {
    const client = new Client();
    const config: ConnectConfig = {
      host: server.sshHost!,
      port: server.sshPort,
      username: server.sshUser!,
      privateKey: privateKeyMaterial(server.sshPrivateKey!),
      readyTimeout: env.SSH_TIMEOUT_MS,
      keepaliveInterval: 0,
      hostVerifier: (hashedKey: Buffer | string) => {
        if (!server.sshHostFingerprint) {
          logger.warn(
            { serverId: server.id, hostname: server.hostname },
            'SSH connection has no expected host fingerprint — accepting any key (insecure)',
          );
          return true;
        }
        const buf = typeof hashedKey === 'string' ? Buffer.from(hashedKey) : hashedKey;
        const ok = fingerprintMatches(server.sshHostFingerprint, buf);
        if (!ok) {
          logger.error(
            { serverId: server.id, hostname: server.hostname },
            'SSH host key fingerprint mismatch',
          );
        }
        return ok;
      },
    };

    let stdout = '';
    let stderr = '';

    const cleanup = () => {
      try {
        client.end();
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`SSH timeout against ${server.hostname} after ${env.SSH_TIMEOUT_MS}ms`));
    }, env.SSH_TIMEOUT_MS + 5_000);

    client.on('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          cleanup();
          reject(err);
          return;
        }
        stream
          .on('close', (code: number | null) => {
            clearTimeout(timer);
            cleanup();
            resolve({ stdout, stderr, code: code ?? 0 });
          })
          .on('data', (data: Buffer) => {
            stdout += data.toString('utf8');
          });
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf8');
        });
      });
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });

    client.connect(config);
  });
}

/**
 * Convenience wrapper that throws on non-zero exit codes. Use for commands
 * whose failure should propagate (e.g. peer add/remove).
 */
export async function execRemoteStrict(server: RemoteServer, command: string): Promise<string> {
  const res = await execRemote(server, command);
  if (res.code !== 0) {
    throw new Error(
      `Remote command failed on ${server.hostname} (exit ${res.code}): ${res.stderr.trim() || res.stdout.trim()}`,
    );
  }
  return res.stdout;
}
