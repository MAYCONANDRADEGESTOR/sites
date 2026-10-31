// Estúdio das Modelos — motor do estúdio (gera, protege, cobra no Pix e libera)
// Variáveis de ambiente (Vercel):
//   GEMINI_API_KEY ............ Google AI Studio (motor 1, grátis)
//   CF_ACCOUNT_ID, CF_API_TOKEN  Cloudflare Workers AI (motor 2, grátis)
//   FAL_KEY .................... fal.ai (motor 3, pago só em emergência — opcional)
//   MP_ACCESS_TOKEN ............ Mercado Pago (Pix)
//   CALLMEBOT_APIKEY, ALERTA_WHATSAPP  alertas no WhatsApp do dono (nunca exibidos ao cliente)
//   ESTUDIO_SEAL_SECRET ........ opcional (senão usa a chave do Google)
const crypto = require('crypto');
const sharp = require('sharp');

const PRECOS = {
  foto: { valor: 9.9, qtd: 1, nome: '1 foto em HD (perfil + stories + original)' },
  kit5: { valor: 19.9, qtd: 5, nome: 'Ensaio com 5 fotos em HD' },
  kit15: { valor: 29.9, qtd: 15, nome: 'Álbum completo com 15 fotos em HD' },
};
const MAX_FOTOS_GRATIS = 3;
const MODELOS = (process.env.ESTUDIO_MODELOS || 'gemini-2.5-flash-image,gemini-3.1-flash-image-preview').split(',');
// Supabase (contador de créditos e de alertas). A chave publicável é pública por natureza;
// as tabelas ficam fechadas e só funções controladas podem ser chamadas com ela.
const SB_URL = process.env.SUPABASE_URL || 'https://qwzdwqkoecfmzwbxjvdh.supabase.co';
const SB_KEY = process.env.SUPABASE_KEY || 'sb_publishable_4BKJNEGPQvCwOgDDH56j6A_lq89feRY';

const IDENTIDADE = 'Use the woman shown in the reference photos as the ONLY subject. Preserve her identity with maximum fidelity: exact same face shape, eyes, nose, lips, eyebrows, skin tone, freckles or marks, hair color and texture, and natural body proportions. She must be instantly recognizable as the same person. Do not beautify into another person, do not change ethnicity or age. ';
const QUALIDADE = ' Ultra photorealistic professional photoshoot, shot on a full-frame camera with an 85mm lens, soft flattering light, natural skin texture, sharp eyes, elegant pose, magazine-quality color grading. Vertical 3:4 portrait. No text, no logos, no watermark, no extra people.';

const CATALOGO = [
  { cat: 'aniversario', catNome: 'Aniversário', itens: [
    { id: 'aniv-dourado', nome: 'Glam Dourado', desc: 'Balões dourados, vestido de festa e brilho', p: 'birthday glamour photoshoot: she wears an elegant sparkly party dress, surrounded by large metallic gold and champagne balloons, golden confetti in the air, luxury studio backdrop with warm bokeh lights, a tiered birthday cake with gold details nearby, joyful confident smile.' },
    { id: 'aniv-rose', nome: 'Rosé Chic', desc: 'Tons rosé, flores e delicadeza', p: 'romantic birthday photoshoot: she wears a satin blush-pink dress, backdrop of pastel pink and rose-gold balloon garland with fresh white and pink flowers, soft dreamy light, holding a single elegant glass of sparkling drink, sweet confident expression.' },
    { id: 'aniv-noir', nome: 'Noir Luxo', desc: 'Preto e prata, clima de gala', p: 'luxury black-and-silver birthday photoshoot: she wears a sleek black evening dress, black and chrome silver balloons, dramatic spotlight on a dark seamless backdrop, subtle glitter, sophisticated powerful pose.' },
    { id: 'aniv-neon', nome: 'Neon Party', desc: 'Luzes neon e clima de balada', p: 'vibrant birthday party photoshoot: she wears a stylish shimmering outfit, colorful neon lights in pink and purple, holographic balloons and a glowing neon sign shape without readable text, festive energetic smile, nightclub editorial vibe.' },
  ]},
  { cat: 'profissional', catNome: 'Profissional', itens: [
    { id: 'pro-executiva', nome: 'Executiva', desc: 'Blazer, fundo neutro, LinkedIn', p: 'corporate headshot and half-body portrait: she wears a tailored blazer over a silk blouse, neutral warm gray studio backdrop, clean professional lighting, confident approachable smile, perfect for LinkedIn and business profiles.' },
    { id: 'pro-empreendedora', nome: 'Empreendedora', desc: 'Escritório moderno, luz natural', p: 'entrepreneur lifestyle portrait: she stands in a bright modern office with plants and large windows, natural daylight, smart-casual chic outfit, holding a coffee cup and a tablet, confident successful businesswoman vibe.' },
    { id: 'pro-saude', nome: 'Saúde & Jaleco', desc: 'Jaleco branco, consultório elegante', p: 'healthcare professional portrait: she wears a crisp white lab coat over elegant clothes, modern bright clinic background softly blurred, arms crossed confidently, warm trustworthy smile.' },
    { id: 'pro-criadora', nome: 'Criadora de Conteúdo', desc: 'Estúdio com ring light, vibe digital', p: 'content creator portrait: she sits in a stylish home studio with a ring light and aesthetic shelves, wearing a trendy outfit, holding a smartphone, friendly charismatic expression, soft warm lighting.' },
  ]},
  { cat: 'celebridade', catNome: 'Estilo Celebridade', itens: [
    { id: 'cel-capa', nome: 'Capa de Revista', desc: 'Editorial fashion de capa', p: 'high-fashion magazine cover style editorial (with no text or masthead): bold couture outfit, clean colored seamless backdrop, beauty-dish lighting, flawless glam makeup, striking direct gaze into camera, Vogue-like editorial composition.' },
    { id: 'cel-redcarpet', nome: 'Tapete Vermelho', desc: 'Gala, flashes e vestido de festa', p: 'red carpet gala portrait: she wears a stunning long evening gown, posing on a red carpet at a premiere event with soft out-of-focus camera flashes and elegant backdrop behind, glamorous hairstyle and jewelry, star-like confidence.' },
    { id: 'cel-paparazzi', nome: 'Paparazzi', desc: 'Street style com flashes', p: 'celebrity street style photo: she walks confidently on an upscale city street at night wearing designer sunglasses and a chic coat, camera flashes from paparazzi in the blurred background, candid glamorous moment.' },
    { id: 'cel-hollywood', nome: 'Hollywood Clássico', desc: 'Glamour vintage dos anos 50', p: 'old Hollywood glamour portrait: she wears a satin evening gown and vintage waves hairstyle, classic red lips, dramatic studio lighting with soft shadows, luxurious velvet backdrop, timeless movie-star elegance.' },
  ]},
  { cat: 'feminino', catNome: 'Ensaio Feminino', itens: [
    { id: 'fem-pb', nome: 'Preto & Branco', desc: 'Atemporal, artístico e elegante', p: 'fine-art black and white portrait: she wears an elegant black top, minimalist studio, dramatic window light with soft shadows, timeless artistic mood, graceful pose. Monochrome black and white photograph.' },
    { id: 'fem-golden', nome: 'Pôr do Sol', desc: 'Campo florido na golden hour', p: 'golden hour outdoor photoshoot: she wears a flowing light summer dress in a field of wildflowers at sunset, warm backlight glowing through her hair, dreamy cinematic atmosphere, natural carefree smile.' },
    { id: 'fem-praia', nome: 'Praia Paradisíaca', desc: 'Mar azul, areia branca, verão', p: 'tropical beach photoshoot: she wears an elegant summer outfit with a wide-brim straw hat, turquoise sea and white sand behind her, bright sunny day, vacation editorial vibe, relaxed confident pose.' },
    { id: 'fem-flores', nome: 'Jardim de Flores', desc: 'Estúdio florido e delicado', p: 'floral studio photoshoot: she wears a soft pastel dress surrounded by abundant fresh flowers (peonies and roses) in a bright studio, romantic delicate light, serene feminine expression.' },
  ]},
  { cat: 'religioso', catNome: 'Fé & Gratidão', itens: [
    { id: 'fe-igreja', nome: 'Igreja Iluminada', desc: 'Vitrais, luz suave e elegância', p: 'elegant faith-inspired portrait: she wears a modest elegant dress, standing in the aisle of a beautiful church with stained glass windows, soft rays of light falling on her, peaceful grateful expression, respectful and serene.' },
    { id: 'fe-biblia', nome: 'Bíblia & Gratidão', desc: 'Luz natural com a Bíblia nas mãos', p: 'gentle faith portrait: she holds an open Bible close to her heart, wearing a modest light-colored dress, sitting in a sunlit garden with soft natural light, calm grateful smile.' },
    { id: 'fe-louvor', nome: 'Louvor', desc: 'Adoração com luzes de palco', p: 'worship moment portrait: she stands on a church stage with warm stage lights and soft haze, eyes closed and hands gently raised in praise, wearing an elegant modest outfit, emotional and uplifting atmosphere.' },
    { id: 'fe-veu', nome: 'Retrato com Véu', desc: 'Véu de renda, delicado e sereno', p: 'serene devotional portrait: she wears a delicate white lace mantilla veil over her hair and a modest elegant dress, soft window light, holding a small rosary, peaceful contemplative expression.' },
  ]},
  { cat: 'datas', catNome: 'Natal & Datas', itens: [
    { id: 'data-natal', nome: 'Natal Elegante', desc: 'Árvore, luzes e vermelho', p: 'elegant Christmas photoshoot: she wears a chic red velvet dress, beside a beautifully decorated Christmas tree with warm fairy lights and wrapped gifts, cozy luxurious living room, festive joyful smile.' },
    { id: 'data-reveillon', nome: 'Réveillon', desc: 'Branco, brilho e fogos', p: 'New Year eve photoshoot: she wears an elegant white outfit with subtle sparkle, city skyline with fireworks bokeh in the night sky behind her, holding a champagne glass, celebratory glamorous mood.' },
    { id: 'data-namorados', nome: 'Dia dos Namorados', desc: 'Rosas vermelhas e clima romântico', p: 'romantic Valentine photoshoot: she wears an elegant red dress, holding a large bouquet of red roses, candlelit restaurant ambience with warm bokeh, charming confident smile.' },
    { id: 'data-carnaval', nome: 'Carnaval Glam', desc: 'Brilho, plumas e cores', p: 'carnival glam photoshoot: she wears a tasteful sparkly carnival outfit with feathers and rhinestones, colorful confetti and streamers, vibrant festive lights, joyful dancing pose.' },
  ]},
];
const ESTILOS = {};
CATALOGO.forEach(c => c.itens.forEach(i => { ESTILOS[i.id] = { ...i, cat: c.cat }; }));
const WM_PATH = 'M3.7 0L3.7-29.2L16.2-29.2Q21.7-29.2 24.7-26.7Q27.7-24.2 27.7-19.6Q27.7-15.1 24.7-12.6Q21.7-10.1 16.2-10.1L11.2-10.1L11.2 0L3.7 0M15.4-23.7L11.2-23.7L11.2-15.6L15.4-15.6Q17.5-15.6 18.7-16.6Q19.9-17.7 19.9-19.6Q19.9-21.6 18.7-22.7Q17.5-23.7 15.4-23.7M40.5-16.2L43.7-16.2Q46-16.2 47.1-17.1Q48.1-18 48.1-20Q48.1-22 47.1-22.9Q46-23.7 43.7-23.7L40.5-23.7L40.5-16.2M42.6-11L40.5-11L40.5 0L33 0L33-29.2L44.5-29.2Q50.2-29.2 52.9-27.2Q55.6-25.3 55.6-21.1Q55.6-18.2 54.2-16.4Q52.8-14.5 50-13.6Q51.5-13.3 52.8-12Q54-10.8 55.2-8.3L59.3 0L51.3 0L47.8-7.2Q46.7-9.4 45.6-10.2Q44.5-11 42.6-11M63.8 0L63.8-29.2L84.1-29.2L84.1-23.5L71.3-23.5L71.3-18L83.3-18L83.3-12.4L71.3-12.4L71.3-5.7L84.5-5.7L84.5 0M98.4 0L87.6-29.2L95.2-29.2L102.9-7.6L110.6-29.2L118.2-29.2L107.4 0M122.1 0L122.1-29.2L129.6-29.2L129.6 0M156.5 0L154.6-5.3L142.9-5.3L141 0L133.5 0L144.3-29.2L153.2-29.2L164 0L156.5 0M148.8-22.3L144.8-10.7L152.8-10.7M195.8 0L195.8-29.2L216.1-29.2L216.1-23.5L203.3-23.5L203.3-18L215.3-18L215.3-12.4L203.3-12.4L203.3-5.7L216.5-5.7L216.5 0M243.4-28.2L243.4-22.1Q241-23.1 238.7-23.7Q236.4-24.2 234.4-24.2Q231.7-24.2 230.4-23.5Q229.1-22.8 229.1-21.2Q229.1-20 230-19.4Q230.8-18.7 233.1-18.2L236.3-17.6Q241.2-16.6 243.2-14.6Q245.3-12.6 245.3-9Q245.3-4.1 242.4-1.8Q239.6 0.6 233.7 0.6Q230.9 0.6 228.1 0Q225.3-0.5 222.5-1.5L222.5-7.9Q225.3-6.4 227.9-5.6Q230.5-4.9 233-4.9Q235.4-4.9 236.7-5.7Q238-6.5 238-8Q238-9.4 237.2-10.2Q236.3-10.9 233.6-11.5L230.7-12.1Q226.3-13.1 224.3-15.1Q222.3-17.2 222.3-20.6Q222.3-25 225.1-27.3Q227.9-29.7 233.2-29.7Q235.6-29.7 238.1-29.3Q240.7-29 243.4-28.2M248.4-23.5L248.4-29.2L275.3-29.2L275.3-23.5L265.6-23.5L265.6 0L258.1 0L258.1-23.5M279.2-11.7L279.2-29.2L286.7-29.2L286.7-11.7Q286.7-8.1 287.9-6.5Q289.1-5 291.7-5Q294.4-5 295.6-6.5Q296.8-8.1 296.8-11.7L296.8-29.2L304.3-29.2L304.3-11.7Q304.3-5.5 301.2-2.5Q298.1 0.6 291.7 0.6Q285.4 0.6 282.3-2.5Q279.2-5.5 279.2-11.7M321.9-23.5L319.2-23.5L319.2-5.7L321.9-5.7Q326.5-5.7 328.9-8Q331.3-10.3 331.3-14.6Q331.3-18.9 328.9-21.2Q326.5-23.5 321.9-23.5M311.7 0L311.7-29.2L319.6-29.2Q326.2-29.2 329.5-28.2Q332.7-27.3 335.1-25Q337.1-23 338.1-20.4Q339.1-17.9 339.1-14.6Q339.1-11.3 338.1-8.7Q337.1-6.1 335.1-4.2Q332.7-1.9 329.4-0.9Q326.2 0 319.6 0M344.9 0L344.9-29.2L352.4-29.2L352.4 0M373.1-24.2Q369.6-24.2 367.7-21.7Q365.8-19.2 365.8-14.6Q365.8-10 367.7-7.4Q369.6-4.9 373.1-4.9Q376.5-4.9 378.4-7.4Q380.3-10 380.3-14.6Q380.3-19.2 378.4-21.7Q376.5-24.2 373.1-24.2M373.1-29.7Q380.1-29.7 384.1-25.7Q388.1-21.6 388.1-14.6Q388.1-7.5 384.1-3.5Q380.1 0.6 373.1 0.6Q366.1 0.6 362.1-3.5Q358.1-7.5 358.1-14.6Q358.1-21.6 362.1-25.7Q366.1-29.7 373.1-29.7M417.9-23.5L415.2-23.5L415.2-5.7L417.9-5.7Q422.5-5.7 424.9-8Q427.4-10.3 427.4-14.6Q427.4-18.9 424.9-21.2Q422.5-23.5 417.9-23.5M407.7 0L407.7-29.2L415.6-29.2Q422.2-29.2 425.5-28.2Q428.8-27.3 431.1-25Q433.1-23 434.1-20.4Q435.1-17.9 435.1-14.6Q435.1-11.3 434.1-8.7Q433.1-6.1 431.1-4.2Q428.7-1.9 425.4-0.9Q422.2 0 415.6 0M460.4 0L458.6-5.3L446.8-5.3L445 0L437.4 0L448.2-29.2L457.2-29.2L468 0L460.4 0M452.7-22.3L448.7-10.7L456.7-10.7M492.1-28.2L492.1-22.1Q489.7-23.1 487.4-23.7Q485.2-24.2 483.1-24.2Q480.4-24.2 479.1-23.5Q477.9-22.8 477.9-21.2Q477.9-20 478.7-19.4Q479.6-18.7 481.9-18.2L485.1-17.6Q489.9-16.6 492-14.6Q494-12.6 494-9Q494-4.1 491.2-1.8Q488.3 0.6 482.4 0.6Q479.7 0.6 476.9 0Q474.1-0.5 471.3-1.5L471.3-7.9Q474.1-6.4 476.7-5.6Q479.3-4.9 481.7-4.9Q484.2-4.9 485.5-5.7Q486.8-6.5 486.8-8Q486.8-9.4 485.9-10.2Q485-10.9 482.4-11.5L479.5-12.1Q475.1-13.1 473.1-15.1Q471-17.2 471-20.6Q471-25 473.8-27.3Q476.7-29.7 481.9-29.7Q484.3-29.7 486.9-29.3Q489.4-29 492.1-28.2M514.6 0L514.6-29.2L524.1-29.2L530.8-13.6L537.5-29.2L547-29.2L547 0L539.9 0L539.9-21.3L533.2-5.6L528.4-5.6L521.7-21.3L521.7 0M567.7-24.2Q564.3-24.2 562.4-21.7Q560.5-19.2 560.5-14.6Q560.5-10 562.4-7.4Q564.3-4.9 567.7-4.9Q571.2-4.9 573-7.4Q574.9-10 574.9-14.6Q574.9-19.2 573-21.7Q571.2-24.2 567.7-24.2M567.7-29.7Q574.7-29.7 578.7-25.7Q582.7-21.6 582.7-14.6Q582.7-7.5 578.7-3.5Q574.7 0.6 567.7 0.6Q560.7 0.6 556.7-3.5Q552.7-7.5 552.7-14.6Q552.7-21.6 556.7-25.7Q560.7-29.7 567.7-29.7M598.6-23.5L595.9-23.5L595.9-5.7L598.6-5.7Q603.2-5.7 605.6-8Q608.1-10.3 608.1-14.6Q608.1-18.9 605.6-21.2Q603.2-23.5 598.6-23.5M588.4 0L588.4-29.2L596.3-29.2Q602.9-29.2 606.2-28.2Q609.5-27.3 611.8-25Q613.8-23 614.8-20.4Q615.8-17.9 615.8-14.6Q615.8-11.3 614.8-8.7Q613.8-6.1 611.8-4.2Q609.4-1.9 606.2-0.9Q602.9 0 596.3 0M621.6 0L621.6-29.2L641.9-29.2L641.9-23.5L629.1-23.5L629.1-18L641.1-18L641.1-12.4L629.1-12.4L629.1-5.7L642.3-5.7L642.3 0M648.9 0L648.9-29.2L656.4-29.2L656.4-5.7L669.6-5.7L669.6 0M687.7-24.2Q684.3-24.2 682.4-21.7Q680.5-19.2 680.5-14.6Q680.5-10 682.4-7.4Q684.3-4.9 687.7-4.9Q691.2-4.9 693.1-7.4Q695-10 695-14.6Q695-19.2 693.1-21.7Q691.2-24.2 687.7-24.2M687.7-29.7Q694.7-29.7 698.7-25.7Q702.7-21.6 702.7-14.6Q702.7-7.5 698.7-3.5Q694.7 0.6 687.7 0.6Q680.7 0.6 676.7-3.5Q672.7-7.5 672.7-14.6Q672.7-21.6 676.7-25.7Q680.7-29.7 687.7-29.7M728.7-28.2L728.7-22.1Q726.3-23.1 724-23.7Q721.7-24.2 719.7-24.2Q717-24.2 715.7-23.5Q714.4-22.8 714.4-21.2Q714.4-20 715.3-19.4Q716.2-18.7 718.4-18.2L721.6-17.6Q726.5-16.6 728.6-14.6Q730.6-12.6 730.6-9Q730.6-4.1 727.7-1.8Q724.9 0.6 719 0.6Q716.2 0.6 713.4 0Q710.6-0.5 707.9-1.5L707.9-7.9Q710.6-6.4 713.3-5.6Q715.9-4.9 718.3-4.9Q720.7-4.9 722.1-5.7Q723.4-6.5 723.4-8Q723.4-9.4 722.5-10.2Q721.6-10.9 718.9-11.5L716-12.1Q711.6-13.1 709.6-15.1Q707.6-17.2 707.6-20.6Q707.6-25 710.4-27.3Q713.2-29.7 718.5-29.7Q720.9-29.7 723.4-29.3Q726-29 728.7-28.2';
const WM_W = 734;

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
  const agora = Date.now(); const r = usos.get(ip) || { n: 0, t: agora };
  if (agora - r.t > janelaMs) { r.n = 0; r.t = agora; }
  r.n++; usos.set(ip, r); return r.n <= max;
}

async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error('rpc ' + fn + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

// ---------- alertas no WhatsApp do dono ----------
async function alertar(tipo, texto, minutos = 360) {
  const fone = process.env.ALERTA_WHATSAPP, key = process.env.CALLMEBOT_APIKEY;
  console.log('[alerta]', tipo, texto);
  if (!fone || !key) return;
  try {
    if (!(await rpc('estudio_pode_alertar', { p_tipo: tipo, p_minutos: minutos }))) return;
    const msg = `⚠️ Estúdio das Modelos\n${texto}\n${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    await fetch(`https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(fone)}&text=${encodeURIComponent(msg)}&apikey=${encodeURIComponent(key)}`);
  } catch (e) { console.log('[alerta] falhou', e.message); }
}

// ---------- motores de imagem (troca automática) ----------
const erroQuota = (status, txt) => status === 429 || /quota|exhaust|rate.?limit|resource_exhausted|limit/i.test(txt || '');

async function motorGemini(prompt, refs) {
  const key = process.env.GEMINI_API_KEY; if (!key) return { pulou: true };
  let ultimo = '', quota = false;
  const partes = [{ text: prompt }, ...refs.map(b => ({ inlineData: { mimeType: 'image/jpeg', data: b.toString('base64') } }))];
  for (const modelo of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo.trim()}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts: partes }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { ultimo = `${modelo}: ${r.status} ${j?.error?.message || ''}`; if (erroQuota(r.status, ultimo)) quota = true; continue; }
    const img = (j?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData || p.inline_data);
    if (img) return { img: Buffer.from((img.inlineData || img.inline_data).data, 'base64') };
    ultimo = `${modelo}: sem imagem (${j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || 'vazio'})`;
  }
  return { erro: ultimo, quota };
}

async function motorCloudflare(prompt, refs) {
  const conta = process.env.CF_ACCOUNT_ID, tk = process.env.CF_API_TOKEN; if (!conta || !tk) return { pulou: true };
  const modelo = process.env.CF_MODELO || '@cf/black-forest-labs/flux-2-klein-9b';
  const form = new FormData();
  const texto = refs.length ? 'The woman in image 0' + (refs.length > 1 ? ' (also shown in the other images)' : '') + ' is the subject. ' + prompt : prompt;
  form.append('prompt', texto);
  form.append('width', '768'); form.append('height', '1024');
  for (let i = 0; i < Math.min(refs.length, 3); i++) {
    const peq = await sharp(refs[i]).resize(500, 500, { fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
    form.append('input_image_' + i, new Blob([peq], { type: 'image/jpeg' }), `ref${i}.jpg`);
  }
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/ai/run/${modelo}`, { method: 'POST', headers: { Authorization: 'Bearer ' + tk }, body: form });
  const tipo = r.headers.get('content-type') || '';
  if (r.ok && tipo.startsWith('image/')) return { img: Buffer.from(await r.arrayBuffer()) };
  const j = await r.json().catch(() => ({}));
  const b64 = j?.result?.image || j?.image;
  if (r.ok && b64) return { img: Buffer.from(b64, 'base64') };
  const msg = `cloudflare: ${r.status} ${JSON.stringify(j?.errors || j).slice(0, 200)}`;
  return { erro: msg, quota: erroQuota(r.status, msg) };
}

async function motorFal(prompt, refs) {
  const key = process.env.FAL_KEY; if (!key) return { pulou: true };
  const comRef = refs.length > 0;
  const r = await fetch('https://fal.run/fal-ai/' + (comRef ? 'nano-banana/edit' : 'nano-banana'), {
    method: 'POST', headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: '3:4', ...(comRef ? { image_urls: refs.map(b => 'data:image/jpeg;base64,' + b.toString('base64')) } : {}) }),
  });
  const j = await r.json().catch(() => ({}));
  const url = j?.images?.[0]?.url;
  if (r.ok && url) {
    const img = url.startsWith('data:') ? Buffer.from(url.split(',')[1], 'base64') : Buffer.from(await (await fetch(url)).arrayBuffer());
    return { img };
  }
  return { erro: `fal: ${r.status} ${JSON.stringify(j).slice(0, 200)}` };
}

async function gerarImagem(prompt, refs = []) {
  const log = [];
  const g = await motorGemini(prompt, refs);
  if (g.img) return { img: g.img, motor: 'gemini' };
  if (!g.pulou) log.push(g.erro);
  const c = await motorCloudflare(prompt, refs);
  if (c.img) {
    if (g.quota) await alertar('google_esgotado', 'A cota grátis do Google Gemini acabou por hoje. O site trocou sozinho para a reserva (Cloudflare) e continua funcionando.', 720);
    return { img: c.img, motor: 'cloudflare' };
  }
  if (!c.pulou) log.push(c.erro);
  const f = await motorFal(prompt, refs);
  if (f.img) {
    await alertar('gratis_esgotado', 'As cotas grátis (Google e Cloudflare) acabaram. O site está usando o motor pago de emergência (fal.ai).', 360);
    return { img: f.img, motor: 'fal' };
  }
  if (!f.pulou) log.push(f.erro);
  console.log('[motores]', log.join(' | '));
  if (g.quota || c.quota || (g.pulou && c.pulou && f.pulou)) {
    await alertar('motor_parado', 'Nenhum motor de imagem conseguiu gerar fotos agora (cotas grátis esgotadas ou chaves ausentes). As clientes estão vendo erro na geração. Adicione créditos ou uma nova chave na Vercel.', 120);
  }
  const e = new Error('Não conseguimos gerar agora. Tente outra foto (rosto bem iluminado, de frente) ou tente de novo em instantes.');
  e.detalhe = log.join(' | '); throw e;
}

async function marcaDagua(buf) {
  const W = 720;
  const base = await sharp(buf).rotate().resize({ width: W }).toBuffer();
  const { height: H } = await sharp(base).metadata();
  let linhas = '';
  for (let y = -H; y < H * 2; y += 120) for (let x = -W; x < W * 2; x += 660) {
    linhas += `<path d="${WM_PATH}" transform="translate(${x},${y}) rotate(-28) scale(0.8)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <g fill="#ffffff" fill-opacity="0.42" stroke="#000" stroke-opacity="0.12" stroke-width="1">${linhas}</g>
    <rect x="0" y="${H - 64}" width="${W}" height="64" fill="#1c0f15" fill-opacity="0.55"/>
    <g fill="#fff" transform="translate(${(W - WM_W * 0.62) / 2},${H - 22}) scale(0.62)"><path d="${WM_PATH}"/></g>
  </svg>`;
  return sharp(base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 55 }).toBuffer();
}

// ---------- Mercado Pago (Pix) ----------
async function mp(path, opts = {}) {
  const tk = process.env.MP_ACCESS_TOKEN;
  if (!tk) throw Object.assign(new Error('Pagamento em configuração. Tente novamente em instantes.'), { code: 503 });
  const r = await fetch('https://api.mercadopago.com' + path, {
    ...opts, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.log('[mp]', r.status, JSON.stringify(j).slice(0, 400)); throw new Error('Não foi possível consultar o Pix agora. Tente novamente.'); }
  return j;
}
async function pagamentoAprovado(id) {
  const pg = await mp('/v1/payments/' + id);
  const pacote = String(pg.external_reference || '').split(':')[0];
  const pc = PRECOS[pacote];
  const ok = pg.status === 'approved' && pc && Number(pg.transaction_amount) + 0.001 >= pc.valor;
  return { pg, pacote, pc, ok };
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
      const etnias = ['Brazilian woman with long wavy brown hair', 'Afro-Brazilian woman with natural curly hair', 'Brazilian woman with straight black hair', 'Brazilian woman with honey blonde hair', 'Brazilian woman with short dark curly hair', 'Brazilian woman with long red hair', 'mixed-race Brazilian woman with long curly hair'];
      const pessoa = etnias[Object.keys(ESTILOS).indexOf(est.id) % etnias.length];
      const { img } = await gerarImagem(`A beautiful fictional ${pessoa}, around 30 years old, ` + est.p + QUALIDADE);
      const out = await sharp(img).resize({ width: 640 }).jpeg({ quality: 82 }).toBuffer();
      res.statusCode = 200; res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
      return res.end(out);
    }

    if (req.method !== 'POST' && acao !== 'status') return json(res, 405, { erro: 'Método não permitido' });

    if (acao === 'gerar') {
      const corpo = await lerCorpo(req);
      if (!limitar(ip, corpo.pagamentoId ? 40 : 15, 3600e3)) return json(res, 429, { erro: 'Você atingiu o limite de fotos por agora. Volte mais tarde.' });
      const { fotos = [], estilo } = corpo;
      const est = ESTILOS[estilo];
      if (!est) return json(res, 400, { erro: 'Escolha um estilo.' });
      const refs = fotos.filter(f => typeof f === 'string' && f.length > 1000 && f.length < 2.5e6).slice(0, 3)
        .map(f => Buffer.from(f.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
      if (!refs.length) return json(res, 400, { erro: 'Envie pelo menos 1 foto sua.' });
      const { img, motor } = await gerarImagem(IDENTIDADE + 'Create this new photo of her: ' + est.p + QUALIDADE, refs);
      const limpa = await sharp(img).rotate().resize({ width: 1536, withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
      const sealed = lacrar(limpa);
      const previa = await marcaDagua(limpa);
      return json(res, 200, { id: idDe(sealed), estilo, motor, sealed, previa: 'data:image/jpeg;base64,' + previa.toString('base64') });
    }

    if (acao === 'pix') {
      if (!limitar('pix:' + ip, 20, 3600e3)) return json(res, 429, { erro: 'Muitas tentativas. Aguarde um pouco.' });
      const { pacote, nome = '', email = '' } = await lerCorpo(req);
      const pc = PRECOS[pacote];
      if (!pc) return json(res, 400, { erro: 'Pacote inválido.' });
      const emailOk = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) ? email : `cliente${Date.now()}@estudiodasmodelos.app`;
      const pg = await mp('/v1/payments', {
        method: 'POST', headers: { 'X-Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          transaction_amount: pc.valor, description: 'Estúdio das Modelos - ' + pc.nome, payment_method_id: 'pix',
          external_reference: pacote + ':' + crypto.randomBytes(6).toString('hex'),
          payer: { email: emailOk, first_name: String(nome).slice(0, 40) || 'Cliente' },
          date_of_expiration: new Date(Date.now() + 30 * 60e3).toISOString().replace('Z', '-00:00'),
        }),
      });
      const t = pg.point_of_interaction?.transaction_data || {};
      return json(res, 200, { pagamentoId: String(pg.id), valor: pc.valor, qtd: pc.qtd, qr: t.qr_code_base64, copiaCola: t.qr_code });
    }

    if (acao === 'status') {
      const id = url.searchParams.get('id');
      if (!/^\d+$/.test(id || '')) return json(res, 400, { erro: 'id' });
      const { pg, pacote, pc, ok } = await pagamentoAprovado(id);
      const usados = ok ? await rpc('estudio_creditos_usados', { p_pid: id }) : 0;
      return json(res, 200, { status: pg.status, aprovado: ok, pacote, qtd: pc ? pc.qtd : 0, usados });
    }

    if (acao === 'liberar') {
      const { pagamentoId, sealed } = await lerCorpo(req);
      if (!/^\d+$/.test(String(pagamentoId || '')) || typeof sealed !== 'string') return json(res, 400, { erro: 'Dados inválidos.' });
      const { pc, ok } = await pagamentoAprovado(pagamentoId);
      if (!ok) return json(res, 402, { erro: 'Pagamento ainda não confirmado.' });
      const id = idDe(sealed);
      const limpa = abrir(sealed); // valida a foto antes de gastar crédito
      const pos = await rpc('estudio_usar_credito', { p_pid: String(pagamentoId), p_foto: id });
      if (!pos || pos > pc.qtd) return json(res, 402, { erro: `Seu pacote já liberou todas as ${pc.qtd} fotos. Escolha um novo pacote para liberar mais.`, esgotado: true });
      const usados = await rpc('estudio_creditos_usados', { p_pid: String(pagamentoId) });
      return json(res, 200, { id, restantes: Math.max(0, pc.qtd - usados), foto: 'data:image/jpeg;base64,' + limpa.toString('base64') });
    }

    return json(res, 404, { erro: 'Ação desconhecida' });
  } catch (e) {
    console.log('[erro]', acao, e.message, e.detalhe || '');
    return json(res, e.code || 500, { erro: e.message || 'Erro inesperado' });
  }
};
