import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRHUB_BASE_URL = 'https://envios.brhubb.com.br/api';

interface ShippingRequest {
  cepOrigem: string;
  cepDestino: string;
  peso: number; // em gramas
  comprimento: number; // em cm
  largura: number; // em cm
  altura: number; // em cm
  valorDeclarado: number; // em reais
}

interface ShippingOption {
  service: string;
  price: number; // em centavos
  deadline: number; // dias úteis
}

// Cache do token JWT
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  
  // Retorna token cacheado se ainda válido (com 5 min de margem)
  if (cachedToken && tokenExpiry > now + 300000) {
    return cachedToken;
  }

  const email = Deno.env.get('BRHUB_EMAIL');
  const password = Deno.env.get('BRHUB_PASSWORD');

  if (!email || !password) {
    throw new Error('Credenciais BRHUB não configuradas');
  }

  console.log('Authenticating with BRHUB...');

  const response = await fetch(`${BRHUB_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('BRHUB auth error:', errorText);
    throw new Error('Falha na autenticação com BRHUB');
  }

  const data = await response.json();
  cachedToken = data.token;
  
  // Token expira em 24h, mas renovamos a cada 23h
  tokenExpiry = now + 23 * 60 * 60 * 1000;
  
  console.log('BRHUB authentication successful');
  return cachedToken!;
}

async function calculateShipping(params: ShippingRequest): Promise<ShippingOption[]> {
  const token = await getAuthToken();
  const cpfCnpj = Deno.env.get('BRHUB_CPF_CNPJ');

  if (!cpfCnpj) {
    throw new Error('CPF/CNPJ da loja não configurado');
  }

  console.log('Calculating shipping from', params.cepOrigem, 'to', params.cepDestino);

  const payload = {
    cepOrigem: params.cepOrigem.replace(/\D/g, ''),
    cepDestino: params.cepDestino.replace(/\D/g, ''),
    embalagem: {
      peso: params.peso / 1000, // Convertendo gramas para kg
      comprimento: params.comprimento,
      largura: params.largura,
      altura: params.altura,
    },
    valorDeclarado: params.valorDeclarado,
    cpfCnpjLoja: cpfCnpj.replace(/\D/g, ''),
  };

  console.log('BRHUB request payload:', JSON.stringify(payload));

  const response = await fetch(`${BRHUB_BASE_URL}/frete/cotacao`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('BRHUB cotacao error:', response.status, errorText);
    throw new Error('Erro ao consultar frete no BRHUB');
  }

  const responseData = await response.json();
  console.log('BRHUB response:', JSON.stringify(responseData));

  // Mapear resposta da API para nosso formato
  const options: ShippingOption[] = [];

  // A API BRHUB retorna { data: [...] } com os serviços
  const items = responseData?.data || responseData?.cotacoes || (Array.isArray(responseData) ? responseData : []);

  for (const item of items) {
    // Campos da API BRHUB: nomeServico, preco, prazo
    const serviceName = item.nomeServico || item.servico || item.nome || 'Correios';
    const price = item.preco || item.valor;
    const deadline = item.prazo;

    if (price !== undefined && deadline !== undefined) {
      options.push({
        service: serviceName,
        price: Math.round(parseFloat(price) * 100), // Converter para centavos
        deadline: parseInt(deadline) || 7,
      });
    }
  }

  // Se não houver opções dos Correios, retornar fallback
  if (options.length === 0) {
    console.log('No shipping options returned, using fallback');
    options.push(
      { service: 'PAC', price: 1990, deadline: 8 },
      { service: 'SEDEX', price: 2990, deadline: 3 },
    );
  }

  // Ordenar por preço (opções com preço)
  options.sort((a, b) => a.price - b.price);

  // Adicionar opções alternativas sem valor
  options.push(
    { service: 'Ônibus', price: 0, deadline: 0 },
    { service: 'A combinar', price: 0, deadline: 0 },
  );

  return options;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    const { cepOrigem, cepDestino, peso, comprimento, largura, altura, valorDeclarado } = body;

    if (!cepOrigem || !cepDestino) {
      return new Response(
        JSON.stringify({ error: 'CEP de origem e destino são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const options = await calculateShipping({
      cepOrigem,
      cepDestino,
      peso: peso || 300, // Default 300g por item
      comprimento: comprimento || 30, // Default 30cm
      largura: largura || 30, // Default 30cm
      altura: altura || 2, // Default 2cm
      valorDeclarado: valorDeclarado || 50, // Default R$50
    });

    return new Response(
      JSON.stringify({ success: true, options }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error('Shipping calculation error:', errorMessage);
    
    // Em caso de erro, retornar opções de fallback
    return new Response(
      JSON.stringify({ 
        success: true, 
        options: [
          { service: 'PAC', price: 1990, deadline: 8 },
          { service: 'SEDEX', price: 2990, deadline: 3 },
        ],
        warning: 'Usando valores estimados'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
