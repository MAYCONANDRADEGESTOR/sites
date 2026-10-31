// Musa Studio IA — motor do estúdio (gera, protege, cobra no Pix e libera)
// Variáveis de ambiente: GEMINI_API_KEY, MP_ACCESS_TOKEN, ESTUDIO_SEAL_SECRET
const crypto = require('crypto');
const sharp = require('sharp');

const PRECOS = {
  foto: { valor: 9.9, nome: 'Foto avulsa em HD (perfil + stories + original)' },
  album: { valor: 19.9, nome: 'Álbum completo em HD (todas as fotos, todos os formatos)' },
};
const MAX_FOTOS_GRATIS = 6;
const MODELOS = (process.env.ESTUDIO_MODELOS || 'gemini-2.5-flash-image,gemini-3.1-flash-image-preview,gemini-2.0-flash-preview-image-generation').split(',');

const IDENTIDADE = 'Use the woman shown in the reference photos as the ONLY subject. Preserve her identity with maximum fidelity: exact same face shape, eyes, nose, lips, eyebrows, skin tone, freckles or marks, hair color and texture, and natural body proportions. She must be instantly recognizable as the same person. Do not beautify into another person, do not change ethnicity or age. ';
const QUALIDADE = ' Ultra photorealistic professional photoshoot, shot on a full-frame camera with an 85mm lens, soft flattering light, natural skin texture, sharp eyes, elegant pose, magazine-quality color grading. Vertical 3:4 portrait. No text, no logos, no watermark, no extra people.';

const CATALOGO = [
  { cat: 'aniversario', catNome: 'Aniversário', itens: [
    { id: 'aniv-dourado', nome: 'Glam Dourado', desc: 'Balões dourados, vestido de festa e brilho', p: 'birthday glamour photoshoot: she wears an elegant sparkly party dress, surrounded by large metallic gold and champagne balloons, golden confetti in the air, luxury studio backdrop with warm bokeh lights, a tiered birthday cake with gold details nearby, joyful confident smile.' },
    { id: 'aniv-rose', nome: 'Rosé Chic', desc: 'Tons rosé, flores e delicadeza', p: 'romantic birthday photoshoot: she wears a satin blush-pink dress, backdrop of pastel pink and rose-gold balloon garland with fresh white and pink flowers, soft dreamy light, holding a single elegant glass of sparkling drink, sweet confident expression.' },
    { id: 'aniv-noir', nome: 'Noir Luxo', desc: 'Preto e prata, clima de gala', p: 'luxury black-and-silver birthday photoshoot: she wears a sleek black evening dress, black and chrome silver balloons, dramatic spotlight on a dark seamless backdrop, subtle glitter, sophisticated powerful pose.' },
  ]},
  { cat: 'profissional', catNome: 'Profissional', itens: [
    { id: 'pro-executiva', nome: 'Executiva', desc: 'Blazer, fundo neutro, LinkedIn', p: 'corporate headshot and half-body portrait: she wears a tailored blazer over a silk blouse, neutral warm gray studio backdrop, clean professional lighting, confident approachable smile, perfect for LinkedIn and business profiles.' },
    { id: 'pro-empreendedora', nome: 'Empreendedora', desc: 'Escritório moderno, luz natural', p: 'entrepreneur lifestyle portrait: she stands in a bright modern office with plants and large windows, natural daylight, smart-casual chic outfit, holding a coffee cup and a tablet, confident successful businesswoman vibe.' },
  ]},
  { cat: 'celebridade', catNome: 'Estilo Celebridade', itens: [
    { id: 'cel-capa', nome: 'Capa de Revista', desc: 'Editorial fashion de capa', p: 'high-fashion magazine cover style editorial (with no text or masthead): bold couture outfit, clean colored seamless backdrop, beauty-dish lighting, flawless glam makeup, striking direct gaze into camera, Vogue-like editorial composition.' },
    { id: 'cel-redcarpet', nome: 'Tapete Vermelho', desc: 'Gala, flashes e vestido de festa', p: 'red carpet gala portrait: she wears a stunning long evening gown, posing on a red carpet at a premiere event with soft out-of-focus camera flashes and elegant backdrop behind, glamorous hairstyle and jewelry, star-like confidence.' },
  ]},
  { cat: 'feminino', catNome: 'Ensaio Feminino', itens: [
    { id: 'fem-pb', nome: 'Preto & Branco', desc: 'Atemporal, artístico e elegante', p: 'fine-art black and white portrait: she wears an elegant black top, minimalist studio, dramatic window light with soft shadows, timeless artistic mood, graceful pose. Monochrome black and white photograph.' },
    { id: 'fem-golden', nome: 'Pôr do Sol', desc: 'Campo florido na golden hour', p: 'golden hour outdoor photoshoot: she wears a flowing light summer dress in a field of wildflowers at sunset, warm backlight glowing through her hair, dreamy cinematic atmosphere, natural carefree smile.' },
    { id: 'fem-praia', nome: 'Praia Paradisíaca', desc: 'Mar azul, areia branca, verão', p: 'tropical beach photoshoot: she wears an elegant summer outfit with a wide-brim straw hat, turquoise sea and white sand behind her, bright sunny day, vacation editorial vibe, relaxed confident pose.' },
  ]},
  { cat: 'datas', catNome: 'Natal & Datas', itens: [
    { id: 'data-natal', nome: 'Natal Elegante', desc: 'Árvore, luzes e vermelho', p: 'elegant Christmas photoshoot: she wears a chic red velvet dress, beside a beautifully decorated Christmas tree with warm fairy lights and wrapped gifts, cozy luxurious living room, festive joyful smile.' },
    { id: 'data-reveillon', nome: 'Réveillon', desc: 'Branco, brilho e fogos', p: 'New Year eve photoshoot: she wears an elegant white outfit with subtle sparkle, city skyline with fireworks bokeh in the night sky behind her, holding a champagne glass, celebratory glamorous mood.' },
  ]},
];
const ESTILOS = {};
CATALOGO.forEach(c => c.itens.forEach(i => { ESTILOS[i.id] = { ...i, cat: c.cat }; }));

const WM_PATH = 'M3.7 0L3.7-29.2L16.2-29.2Q21.7-29.2 24.7-26.7Q27.7-24.2 27.7-19.6Q27.7-15.1 24.7-12.6Q21.7-10.1 16.2-10.1L11.2-10.1L11.2 0L3.7 0M15.4-23.7L11.2-23.7L11.2-15.6L15.4-15.6Q17.5-15.6 18.7-16.6Q19.9-17.7 19.9-19.6Q19.9-21.6 18.7-22.7Q17.5-23.7 15.4-23.7M40.5-16.2L43.7-16.2Q46-16.2 47.1-17.1Q48.1-18 48.1-20Q48.1-22 47.1-22.9Q46-23.7 43.7-23.7L40.5-23.7L40.5-16.2M42.6-11L40.5-11L40.5 0L33 0L33-29.2L44.5-29.2Q50.2-29.2 52.9-27.2Q55.6-25.3 55.6-21.1Q55.6-18.2 54.2-16.4Q52.8-14.5 50-13.6Q51.5-13.3 52.8-12Q54-10.8 55.2-8.3L59.3 0L51.3 0L47.8-7.2Q46.7-9.4 45.6-10.2Q44.5-11 42.6-11M63.8 0L63.8-29.2L84.1-29.2L84.1-23.5L71.3-23.5L71.3-18L83.3-18L83.3-12.4L71.3-12.4L71.3-5.7L84.5-5.7L84.5 0M98.4 0L87.6-29.2L95.2-29.2L102.9-7.6L110.6-29.2L118.2-29.2L107.4 0M122.1 0L122.1-29.2L129.6-29.2L129.6 0M156.5 0L154.6-5.3L142.9-5.3L141 0L133.5 0L144.3-29.2L153.2-29.2L164 0L156.5 0M148.8-22.3L144.8-10.7L152.8-10.7M195.8 0L195.8-29.2L205.3-29.2L212-13.6L218.7-29.2L228.2-29.2L228.2 0L221.1 0L221.1-21.3L214.4-5.6L209.6-5.6L202.9-21.3L202.9 0M235.6-11.7L235.6-29.2L243.1-29.2L243.1-11.7Q243.1-8.1 244.3-6.5Q245.4-5 248.1-5Q250.8-5 252-6.5Q253.2-8.1 253.2-11.7L253.2-29.2L260.7-29.2L260.7-11.7Q260.7-5.5 257.6-2.5Q254.5 0.6 248.1 0.6Q241.8 0.6 238.7-2.5Q235.6-5.5 235.6-11.7M288.3-28.2L288.3-22.1Q285.9-23.1 283.7-23.7Q281.4-24.2 279.3-24.2Q276.6-24.2 275.4-23.5Q274.1-22.8 274.1-21.2Q274.1-20 274.9-19.4Q275.8-18.7 278.1-18.2L281.3-17.6Q286.2-16.6 288.2-14.6Q290.3-12.6 290.3-9Q290.3-4.1 287.4-1.8Q284.5 0.6 278.7 0.6Q275.9 0.6 273.1 0Q270.3-0.5 267.5-1.5L267.5-7.9Q270.3-6.4 272.9-5.6Q275.5-4.9 277.9-4.9Q280.4-4.9 281.7-5.7Q283-6.5 283-8Q283-9.4 282.1-10.2Q281.2-10.9 278.6-11.5L275.7-12.1Q271.3-13.1 269.3-15.1Q267.2-17.2 267.2-20.6Q267.2-25 270.1-27.3Q272.9-29.7 278.1-29.7Q280.5-29.7 283.1-29.3Q285.6-29 288.3-28.2M316.4 0L314.6-5.3L302.8-5.3L300.9 0L293.4 0L304.2-29.2L313.1-29.2L323.9 0L316.4 0M308.7-22.3L304.7-10.7L312.7-10.7M362-28.2L362-22.1Q359.6-23.1 357.3-23.7Q355.1-24.2 353-24.2Q350.3-24.2 349-23.5Q347.8-22.8 347.8-21.2Q347.8-20 348.6-19.4Q349.5-18.7 351.8-18.2L355-17.6Q359.8-16.6 361.9-14.6Q363.9-12.6 363.9-9Q363.9-4.1 361.1-1.8Q358.2 0.6 352.3 0.6Q349.6 0.6 346.8 0Q344-0.5 341.2-1.5L341.2-7.9Q344-6.4 346.6-5.6Q349.2-4.9 351.6-4.9Q354.1-4.9 355.4-5.7Q356.7-6.5 356.7-8Q356.7-9.4 355.8-10.2Q354.9-10.9 352.3-11.5L349.4-12.1Q345-13.1 343-15.1Q340.9-17.2 340.9-20.6Q340.9-25 343.8-27.3Q346.6-29.7 351.8-29.7Q354.2-29.7 356.8-29.3Q359.3-29 362-28.2M367.1-23.5L367.1-29.2L393.9-29.2L393.9-23.5L384.3-23.5L384.3 0L376.8 0L376.8-23.5M397.8-11.7L397.8-29.2L405.4-29.2L405.4-11.7Q405.4-8.1 406.5-6.5Q407.7-5 410.4-5Q413.1-5 414.3-6.5Q415.4-8.1 415.4-11.7L415.4-29.2L423-29.2L423-11.7Q423-5.5 419.9-2.5Q416.8 0.6 410.4 0.6Q404 0.6 400.9-2.5Q397.8-5.5 397.8-11.7M440.5-23.5L437.8-23.5L437.8-5.7L440.5-5.7Q445.1-5.7 447.6-8Q450-10.3 450-14.6Q450-18.9 447.6-21.2Q445.2-23.5 440.5-23.5M430.3 0L430.3-29.2L438.2-29.2Q444.9-29.2 448.1-28.2Q451.4-27.3 453.7-25Q455.8-23 456.8-20.4Q457.8-17.9 457.8-14.6Q457.8-11.3 456.8-8.7Q455.8-6.1 453.7-4.2Q451.4-1.9 448.1-0.9Q444.8 0 438.2 0M463.5 0L463.5-29.2L471-29.2L471 0M491.7-24.2Q488.3-24.2 486.4-21.7Q484.5-19.2 484.5-14.6Q484.5-10 486.4-7.4Q488.3-4.9 491.7-4.9Q495.2-4.9 497.1-7.4Q499-10 499-14.6Q499-19.2 497.1-21.7Q495.2-24.2 491.7-24.2M491.7-29.7Q498.8-29.7 502.7-25.7Q506.7-21.6 506.7-14.6Q506.7-7.5 502.7-3.5Q498.8 0.6 491.7 0.6Q484.7 0.6 480.7-3.5Q476.7-7.5 476.7-14.6Q476.7-21.6 480.7-25.7Q484.7-29.7 491.7-29.7';

// ---------- utilidades ----------
function chave() {
  const s = process.env.ESTUDIO_SEAL_SECRET || process.env.GEMINI_API_KEY || 'troque-este-segredo';
  return crypto.createHash('sha256').update('musa:' + s).digest();
}
function lacrar(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function abrir(b64) {
  const b = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}
const idDe = (sealed) => crypto.createHash('sha256').update(sealed).digest('hex').slice(0, 16);

async function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const ch of req) chunks.push(ch);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}
function json(res, code, obj) {
  res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj));
}

// limite simples por IP (melhor esforço, por instância)
const usos = new Map();
function limitar(ip, max, janelaMs) {
  const agora = Date.now(); const k = ip; const r = usos.get(k) || { n: 0, t: agora };
  if (agora - r.t > janelaMs) { r.n = 0; r.t = agora; }
  r.n++; usos.set(k, r); return r.n <= max;
}

// ---------- IA (Google Gemini, plano gratuito) ----------
async function gemini(partes) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw Object.assign(new Error('Estúdio em manutenção. Volte em alguns minutos.'), { code: 503 });
  let ultimo = '';
  for (const modelo of MODELOS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo.trim()}:generateContent`;
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: partes }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${j?.error?.message || ''}`; console.log('[gemini]', ultimo); continue; }
    const parts = j?.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData || p.inline_data);
    if (img) return Buffer.from((img.inlineData || img.inline_data).data, 'base64');
    ultimo = `${modelo}: sem imagem (${j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || 'vazio'})`;
    console.log('[gemini]', ultimo);
  }
  const e = new Error('Não conseguimos gerar agora. Tente outra foto (rosto bem iluminado, de frente) ou tente de novo em instantes.');
  e.detalhe = ultimo; throw e;
}

async function marcaDagua(buf) {
  const W = 720;
  const base = await sharp(buf).rotate().resize({ width: W }).toBuffer();
  const { height: H } = await sharp(base).metadata();
  let linhas = '';
  for (let y = -H; y < H * 2; y += 120) for (let x = -W; x < W * 2; x += 470) {
    linhas += `<path d="${WM_PATH}" transform="translate(${x},${y}) rotate(-28) scale(0.9)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <g fill="#ffffff" fill-opacity="0.42" stroke="#000" stroke-opacity="0.12" stroke-width="1">${linhas}</g>
    <rect x="0" y="${H - 64}" width="${W}" height="64" fill="#1c0f15" fill-opacity="0.55"/>
    <g fill="#fff" transform="translate(${(W - 509 * 0.8) / 2},${H - 20}) scale(0.8)"><path d="${WM_PATH}"/></g>
  </svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 55 }).toBuffer();
}

// ---------- Mercado Pago (Pix) ----------
async function mp(path, opts = {}) {
  const tk = process.env.MP_ACCESS_TOKEN;
  if (!tk) throw Object.assign(new Error('Pagamento em configuração. Fale com a gente no WhatsApp.'), { code: 503 });
  const r = await fetch('https://api.mercadopago.com' + path, {
    ...opts, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log('[mp]', r.status, JSON.stringify(j).slice(0, 400)); throw new Error('Não foi possível gerar o Pix agora. Tente novamente.'); }
  return j;
}

// ---------- rotas ----------
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  const url = new URL(req.url, 'http://x');
  const acao = url.searchParams.get('acao');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'ip';
  try {
    if (acao === 'catalogo') {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return json(res, 200, { catalogo: CATALOGO.map(c => ({ cat: c.cat, catNome: c.catNome, itens: c.itens.map(({ p, ...r }) => r) })), precos: PRECOS, maxFotos: MAX_FOTOS_GRATIS });
    }

    if (acao === 'amostra') { // foto-modelo do catálogo (mulher fictícia)
      const est = ESTILOS[url.searchParams.get('id')];
      if (!est) return json(res, 404, { erro: 'estilo' });
      const etnias = ['Brazilian woman with long wavy brown hair', 'Afro-Brazilian woman with natural curly hair', 'Brazilian woman with straight black hair', 'Brazilian woman with honey blonde hair', 'Brazilian woman with short dark curly hair'];
      const pessoa = etnias[Object.keys(ESTILOS).indexOf(est.id) % etnias.length];
      const img = await gemini([{ text: `A beautiful fictional ${pessoa}, around 30 years old, ` + est.p + QUALIDADE }]);
      const out = await sharp(img).resize({ width: 640 }).jpeg({ quality: 82 }).toBuffer();
      res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
      return res.end(out);
    }

    if (req.method !== 'POST' && acao !== 'status') return json(res, 405, { erro: 'Método não permitido' });

    if (acao === 'gerar') {
      if (!limitar(ip, 12, 3600e3)) return json(res, 429, { erro: 'Você atingiu o limite de fotos grátis por agora. Libere suas fotos ou volte mais tarde.' });
      const { fotos = [], estilo } = await lerCorpo(req);
      const est = ESTILOS[estilo];
      if (!est) return json(res, 400, { erro: 'Escolha um estilo.' });
      const refs = fotos.filter(f => typeof f === 'string' && f.length > 1000 && f.length < 2.5e6).slice(0, 3);
      if (!refs.length) return json(res, 400, { erro: 'Envie pelo menos 1 foto sua.' });
      const partes = [{ text: IDENTIDADE + 'Create this new photo of her: ' + est.p + QUALIDADE }];
      refs.forEach(f => partes.push({ inlineData: { mimeType: 'image/jpeg', data: f.replace(/^data:image\/\w+;base64,/, '') } }));
      const img = await gemini(partes);
      const limpa = await sharp(img).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
      const sealed = lacrar(limpa);
      const previa = await marcaDagua(limpa);
      return json(res, 200, { id: idDe(sealed), estilo, sealed, previa: 'data:image/jpeg;base64,' + previa.toString('base64') });
    }

    if (acao === 'pix') {
      if (!limitar('pix:' + ip, 20, 3600e3)) return json(res, 429, { erro: 'Muitas tentativas. Aguarde um pouco.' });
      const { ids = [], pacote, nome = '', email = '' } = await lerCorpo(req);
      const pc = PRECOS[pacote];
      const lista = [...new Set(ids)].filter(i => /^[a-f0-9]{16}$/.test(i)).slice(0, MAX_FOTOS_GRATIS + 4);
      if (!pc || !lista.length || (pacote === 'foto' && lista.length !== 1)) return json(res, 400, { erro: 'Pacote inválido.' });
      const ref = pacote + ':' + lista.join('.');
      const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) ? email : `cliente${Date.now()}@musastudio.app`;
      const pg = await mp('/v1/payments', {
        method: 'POST', headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          transaction_amount: pc.valor, description: 'Musa Studio IA - ' + pc.nome, payment_method_id: 'pix',
          external_reference: ref, payer: { email: emailOk, first_name: String(nome).slice(0, 40) || 'Cliente' },
          date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString().replace('Z', '-00:00'),
        }),
      });
      const t = pg.point_of_interaction?.transaction_data || {};
      return json(res, 200, { pagamentoId: String(pg.id), valor: pc.valor, qr: t.qr_code_base64, copiaCola: t.qr_code });
    }

    if (acao === 'status') {
      const id = url.searchParams.get('id');
      if (!/^\d+$/.test(id || '')) return json(res, 400, { erro: 'id' });
      const pg = await mp('/v1/payments/' + id);
      return json(res, 200, { status: pg.status });
    }

    if (acao === 'liberar') {
      const { pagamentoId, sealed } = await lerCorpo(req);
      if (!/^\d+$/.test(String(pagamentoId || '')) || typeof sealed !== 'string') return json(res, 400, { erro: 'Dados inválidos.' });
      const pg = await mp('/v1/payments/' + pagamentoId);
      if (pg.status !== 'approved') return json(res, 402, { erro: 'Pagamento ainda não confirmado.' });
      const [pacote, lista = ''] = String(pg.external_reference || '').split(':');
      const pc = PRECOS[pacote];
      if (!pc || Number(pg.transaction_amount) + 0.001 < pc.valor) return json(res, 402, { erro: 'Pagamento não corresponde ao pacote.' });
      const id = idDe(sealed);
      if (!lista.split('.').includes(id)) return json(res, 403, { erro: 'Esta foto não faz parte deste pagamento.' });
      const limpa = abrir(sealed);
      return json(res, 200, { id, foto: 'data:image/jpeg;base64,' + limpa.toString('base64') });
    }

    return json(res, 404, { erro: 'Ação desconhecida' });
  } catch (e) {
    console.log('[erro]', acao, e.message, e.detalhe || '');
    return json(res, e.code || 500, { erro: e.message || 'Erro inesperado' });
  }
};
