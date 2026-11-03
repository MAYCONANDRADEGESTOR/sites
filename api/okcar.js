// OKCAR — ponte segura com a API de consulta de placa (consultadeplaca.net)
// Variáveis de ambiente (Vercel):
//   CDP_API_KEY ..... chave da API (cdp_live_... ou cdp_test_...), nunca vai para o navegador
//   OKCAR_PIN ....... PIN de acesso; sem ele só as placas de teste TST0001..3 funcionam
const crypto = require('crypto');

const BASE = 'https://consultadeplaca.net/api/v1';
const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

function enviar(res, status, corpo) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(corpo);
}

async function cdp(path, opcoes = {}) {
  const r = await fetch(BASE + path, {
    ...opcoes,
    headers: {
      Authorization: `Bearer ${process.env.CDP_API_KEY}`,
      Accept: 'application/json',
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opcoes.headers || {}),
    },
    signal: AbortSignal.timeout(30000),
  });
  let json = {};
  try { json = await r.json(); } catch (e) { json = { code: 'resposta_invalida' }; }
  return { status: r.status, json };
}

module.exports = async (req, res) => {
  try {
    if (!process.env.CDP_API_KEY) {
      return enviar(res, 503, { code: 'sem_chave', detail: 'Chave da API de consulta ainda não configurada.' });
    }
    const q = req.query || {};
    const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const acao = q.action || corpo.action;
    const placa = String(q.placa || corpo.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const ehTeste = /^TST000[1-3]$/.test(placa);
    const pin = String(req.headers['x-okcar-pin'] || '');
    const pinOk = !!process.env.OKCAR_PIN && pin.length > 0 &&
      pin.length === process.env.OKCAR_PIN.length &&
      crypto.timingSafeEqual(Buffer.from(pin), Buffer.from(process.env.OKCAR_PIN));

    if (acao === 'produtos') {
      if (!pinOk) return enviar(res, 401, { code: 'pin_invalido', detail: 'PIN inválido.' });
      const { status, json } = await cdp('/products');
      return enviar(res, status, json);
    }

    if (acao === 'consulta' || acao === 'relatorio') {
      if (!PLACA.test(placa) && !ehTeste) return enviar(res, 422, { code: 'placa_invalida', detail: 'Placa inválida.' });
      if (!ehTeste && !pinOk) return enviar(res, 401, { code: 'pin_invalido', detail: 'Informe o PIN de acesso nas configurações.' });
      if (acao === 'consulta') {
        const { status, json } = await cdp('/lookups', {
          method: 'POST',
          headers: { 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ plate: placa }),
        });
        return enviar(res, status, json);
      }
      const produto = String(corpo.produto || q.produto || '');
      if (!/^[a-z0-9-]{2,60}$/.test(produto)) return enviar(res, 422, { code: 'produto_invalido', detail: 'Produto inválido.' });
      const { status, json } = await cdp('/reports', {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ product: produto, plate: placa }),
      });
      return enviar(res, status, json);
    }

    if (acao === 'relatorio_status') {
      if (!pinOk) return enviar(res, 401, { code: 'pin_invalido', detail: 'PIN inválido.' });
      const id = String(q.id || '');
      if (!/^rep_[A-Za-z0-9]{26}$/.test(id)) return enviar(res, 422, { code: 'id_invalido', detail: 'Id inválido.' });
      const { status, json } = await cdp('/reports/' + id);
      return enviar(res, status, json);
    }

    return enviar(res, 400, { code: 'acao_invalida', detail: 'Ação desconhecida.' });
  } catch (e) {
    return enviar(res, 500, { code: 'erro_interno', detail: 'Falha ao consultar agora. Tente de novo.' });
  }
};
