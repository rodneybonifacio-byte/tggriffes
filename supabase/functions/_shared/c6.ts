// Helper para autenticar e chamar a API PIX do C6 Bank
// Docs: https://developers.c6bank.com.br/

const C6_BASE = (Deno.env.get('C6_ENVIRONMENT') ?? 'production').toLowerCase() === 'sandbox'
  ? 'https://baas-sandbox.c6bank.info'
  : 'https://baas.c6bank.info';

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = Deno.env.get('C6_CLIENT_ID')!;
  const clientSecret = Deno.env.get('C6_CLIENT_SECRET')!;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'pix.read pix.write cob.read cob.write',
  });

  const res = await fetch(`${C6_BASE}/auth/oauth2/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`C6 auth falhou [${res.status}]: ${await res.text()}`);
  }
  const json = await res.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 600) * 1000,
  };
  return cachedToken.token;
}

export interface CreatePixCobInput {
  txid?: string;          // 26-35 chars alfanumérico
  amountCents: number;
  expiresInSeconds: number;
  payerName: string;
  description: string;
}

export interface CreatePixCobResult {
  txid: string;
  correlationId: string;
  pixCopiaCola: string;
  qrCodeBase64: string;   // imagem PNG base64 (data url)
  expiresAt: string;
}

export async function createPixCob(input: CreatePixCobInput): Promise<CreatePixCobResult> {
  const token = await getAccessToken();
  const pixKey = Deno.env.get('C6_PIX_KEY')!;

  const txid = input.txid ?? crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  const payload = {
    calendario: { expiracao: input.expiresInSeconds },
    valor: { original: (input.amountCents / 100).toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: input.description.slice(0, 140),
  };

  const res = await fetch(`${C6_BASE}/pix/v2/cob/${txid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`C6 cob falhou [${res.status}]: ${await res.text()}`);
  }
  const cob = await res.json();

  // Buscar QR Code (payload + imagem)
  const locId = cob.loc?.id;
  let pixCopiaCola = cob.pixCopiaECola ?? '';
  let qrCodeBase64 = '';
  if (locId) {
    const qrRes = await fetch(`${C6_BASE}/pix/v2/loc/${locId}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (qrRes.ok) {
      const qr = await qrRes.json();
      pixCopiaCola = qr.qrcode ?? pixCopiaCola;
      qrCodeBase64 = qr.imagemQrcode ?? '';
    }
  }

  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();

  return {
    txid,
    correlationId: cob.txid ?? txid,
    pixCopiaCola,
    qrCodeBase64,
    expiresAt,
  };
}

export interface PixCobStatus {
  status: 'ATIVA' | 'CONCLUIDA' | 'REMOVIDA_PELO_USUARIO_RECEBEDOR' | 'REMOVIDA_PELO_PSP' | string;
  paid: boolean;
  paidAt?: string;
  raw: unknown;
}

export async function getPixCobStatus(txid: string): Promise<PixCobStatus> {
  const token = await getAccessToken();
  const res = await fetch(`${C6_BASE}/pix/v2/cob/${txid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`C6 cob status falhou [${res.status}]: ${await res.text()}`);
  }
  const cob = await res.json();
  const status = cob.status as string;
  const pix = Array.isArray(cob.pix) && cob.pix.length > 0 ? cob.pix[0] : null;
  return {
    status,
    paid: status === 'CONCLUIDA' || !!pix,
    paidAt: pix?.horario,
    raw: cob,
  };
}