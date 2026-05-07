// Helper para autenticar e chamar a API PIX do C6 Bank
// Docs (referência): https://developers.c6bank.com.br/  e SDKs públicos
// Endpoints corretos:
//   Produção:  https://baas-api.c6bank.info
//   Sandbox:   https://baas-api-sandbox.c6bank.info
//   Auth:      POST /v1/auth   (form-urlencoded, mTLS)
//   PIX cob:   PUT /v2/pix/cob/{txid}   (mTLS + Bearer)
//   PIX cob:   GET /v2/pix/cob/{txid}

const C6_BASE = (Deno.env.get('C6_ENVIRONMENT') ?? 'production').toLowerCase() === 'sandbox'
  ? 'https://baas-api-sandbox.c6bank.info'
  : 'https://baas-api.c6bank.info';

function normalizePem(raw: string): string {
  // Aceita PEM com \n literais (quando colado via formulário de secret),
  // CRLF, ou já bem-formatado. Garante terminação com newline.
  let s = raw.trim();
  if (s.includes('\\n')) s = s.replace(/\\n/g, '\n');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!s.endsWith('\n')) s += '\n';
  return s;
}

// mTLS client (criado uma única vez)
let mtlsClient: Deno.HttpClient | null = null;
function getClient(): Deno.HttpClient {
  if (mtlsClient) return mtlsClient;
  const certRaw = Deno.env.get('C6_CERT_PEM');
  const keyRaw = Deno.env.get('C6_KEY_PEM');
  if (!certRaw || !keyRaw) throw new Error('C6_CERT_PEM e C6_KEY_PEM são obrigatórios');
  const cert = normalizePem(certRaw);
  const key = normalizePem(keyRaw);
  if (!cert.includes('-----BEGIN')) throw new Error('C6_CERT_PEM inválido: faltam marcadores BEGIN/END');
  if (!key.includes('-----BEGIN')) throw new Error('C6_KEY_PEM inválido: faltam marcadores BEGIN/END');
  // @ts-ignore Deno API
  mtlsClient = Deno.createHttpClient({ cert, key });
  return mtlsClient;
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
  });

  const res = await fetch(`${C6_BASE}/v1/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    // @ts-ignore Deno fetch supports client option
    client: getClient(),
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

  const res = await fetch(`${C6_BASE}/v2/pix/cob/${txid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    // @ts-ignore mTLS
    client: getClient(),
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
    const qrRes = await fetch(`${C6_BASE}/v2/pix/loc/${locId}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
      // @ts-ignore mTLS
      client: getClient(),
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
  paidAmountCents?: number;
  endToEndId?: string;
  raw: unknown;
}

export async function getPixCobStatus(txid: string): Promise<PixCobStatus> {
  const token = await getAccessToken();
  const res = await fetch(`${C6_BASE}/v2/pix/cob/${txid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    // @ts-ignore mTLS
    client: getClient(),
  });
  if (!res.ok) {
    throw new Error(`C6 cob status falhou [${res.status}]: ${await res.text()}`);
  }
  const cob = await res.json();
  const status = cob.status as string;
  const pix = Array.isArray(cob.pix) && cob.pix.length > 0 ? cob.pix[0] : null;
  // Confirmação estrita: só consideramos pago quando o C6 marca a cobrança
  // como CONCLUIDA e existe um registro de PIX recebido (com valor).
  const hasReceivedPix = !!pix && typeof pix.valor === 'string' && Number(pix.valor) > 0;
  const paid = status === 'CONCLUIDA' && hasReceivedPix;
  const paidAmountCents = hasReceivedPix ? Math.round(Number(pix.valor) * 100) : undefined;
  return {
    status,
    paid,
    paidAt: pix?.horario,
    paidAmountCents,
    endToEndId: pix?.endToEndId,
    raw: cob,
  };
}