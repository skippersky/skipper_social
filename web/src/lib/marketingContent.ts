/**
 * Offline copy engine for the AI marketing module (Sprint 11).
 *
 * The real generator lives behind POST /api/v1/marketing/ai/generate. This file
 * is the on-device fallback so the workbench stays usable before the backend
 * ships, and it doubles as the prompt contract: goal, audience, tone, length and
 * language map to the same slots the Qwen prompt uses. Everything here is pure
 * and deterministic for a given prompt, which keeps the tests honest.
 */
import type {
  ChannelPlatform,
  ContentLanguage,
  ContentLength,
  ContentPreview,
  ContentTone,
  MarketingContent,
  MarketingGoal
} from '../types';
import { CHANNEL_BODY_LIMIT } from '../types';

interface CopyParts {
  title: string;
  hook: string;
  benefits: string[];
  offer: string;
  cta: string;
  hashtags: string[];
  imageSuggestion: string;
}

type CopyBank = Record<MarketingGoal, CopyParts>;

const COPY: Record<ContentLanguage, CopyBank> = {
  en: {
    promotion: {
      title: 'This week only: a sharper price for {audience}',
      hook: 'You asked, we listened. The best-selling range is discounted for a short window.',
      benefits: [
        'Free delivery inside the city once the order passes the threshold',
        'Every unit is hand-checked before it leaves the shelf'
      ],
      offer: 'Quote code KILI when you reply and the discount applies automatically.',
      cta: 'Shop the offer',
      hashtags: ['#Deal', '#KiliSocial', '#EastAfrica'],
      imageSuggestion: 'Product stack on a warm sand backdrop with the price tag in frame.'
    },
    new_arrival: {
      title: 'Just landed: the new range for {audience}',
      hook: 'Fresh stock is in and the first batch is limited.',
      benefits: [
        'Colours and sizes that sold out last season are back',
        'Early buyers get priority dispatch within 24 hours'
      ],
      offer: 'Reserve a unit today and pay on delivery.',
      cta: 'See what is new',
      hashtags: ['#NewArrival', '#KiliSocial'],
      imageSuggestion: 'Flat lay of the new range with one hero item slightly raised.'
    },
    festival: {
      title: 'Celebrating with you, {audience}',
      hook: 'The season is here and we prepared something warm for our regulars.',
      benefits: [
        'Gift bundles are wrapped and ready to send',
        'The returns window is extended through the holiday'
      ],
      offer: 'Order before the festival and delivery is on us.',
      cta: 'Pick a bundle',
      hashtags: ['#Festival', '#GiftIdeas'],
      imageSuggestion: 'Bundle tied with a kente-inspired ribbon, amber light, no faces.'
    },
    winback: {
      title: 'We kept your favourites, {audience}',
      hook: 'It has been a while, so we set aside a personal welcome-back offer.',
      benefits: [
        'Repeat your last order in a single tap',
        'A returning-customer credit applies to the next purchase'
      ],
      offer: 'Reply to this message and we hold the offer for seven days.',
      cta: 'Come back and look',
      hashtags: ['#WelcomeBack'],
      imageSuggestion: 'Two saved items side by side with a small credit note between them.'
    },
    custom: {
      title: '{prompt}',
      hook: 'Here is the short version, written for {audience}.',
      benefits: [
        'Straight details, no filler',
        'Reply any time and a person answers'
      ],
      offer: 'Ask us for the current price list and lead times.',
      cta: 'Learn more',
      hashtags: ['#KiliSocial'],
      imageSuggestion: 'Clean product shot on a neutral surface with soft directional light.'
    }
  },
  fr: {
    promotion: {
      title: 'Cette semaine seulement : un prix plus juste pour {audience}',
      hook: 'Vous avez demande, nous avons ecoute. La gamme la plus vendue est remisee pour une courte periode.',
      benefits: [
        'Livraison offerte en ville au-dela du seuil de commande',
        'Chaque article est verifie a la main avant expedition'
      ],
      offer: 'Indiquez le code KILI en repondant, la remise s’applique automatiquement.',
      cta: 'Voir l’offre',
      hashtags: ['#Promotion', '#KiliSocial'],
      imageSuggestion: 'Pile de produits sur fond sable chaud, etiquette de prix visible.'
    },
    new_arrival: {
      title: 'Nouveaute : la gamme fraichement arrivee pour {audience}',
      hook: 'Le nouveau stock est la et le premier lot est limite.',
      benefits: [
        'Les coloris epuises la saison derniere sont de retour',
        'Les premiers acheteurs sont expedies sous 24 heures'
      ],
      offer: 'Reservez aujourd’hui et payez a la livraison.',
      cta: 'Decouvrir',
      hashtags: ['#Nouveaute', '#KiliSocial'],
      imageSuggestion: 'Mise a plat de la nouvelle gamme, un article principal legerement surleve.'
    },
    festival: {
      title: 'Nous fetons la saison avec vous, {audience}',
      hook: 'La saison est la et nous avons prepare une attention pour nos clients fideles.',
      benefits: [
        'Coffrets cadeaux emballés, prêts a offrir',
        'Le delai de retour est prolonge pendant les fêtes'
      ],
      offer: 'Commandez avant la fête, la livraison est offerte.',
      cta: 'Choisir un coffret',
      hashtags: ['#Fete', '#IdeesCadeaux'],
      imageSuggestion: 'Coffret avec ruban aux motifs kente, lumiere ambre, sans visage.'
    },
    winback: {
      title: 'Nous avons garde vos favoris, {audience}',
      hook: 'Cela fait un moment, alors nous avons mis de cote une offre de retour.',
      benefits: [
        'Recommandez votre dernier panier en un geste',
        'Un avoir de fidelite s’applique au prochain achat'
      ],
      offer: 'Repondez a ce message, nous gardons l’offre sept jours.',
      cta: 'Revenir voir',
      hashtags: ['#BonRetour'],
      imageSuggestion: 'Deux articles sauvegardes cote a cote avec une petite note d’avoir.'
    },
    custom: {
      title: '{prompt}',
      hook: 'Voici la version courte, ecrite pour {audience}.',
      benefits: [
        'Des faits clairs, sans remplissage',
        'Repondez quand vous voulez, une personne repond'
      ],
      offer: 'Demandez la liste de prix et les delais actuels.',
      cta: 'En savoir plus',
      hashtags: ['#KiliSocial'],
      imageSuggestion: 'Produit detoure sur fond neutre, lumiere directionnelle douce.'
    }
  },
  sw: {
    promotion: {
      title: 'Wiki hii tu: bei nzuri kwa {audience}',
      hook: 'Mliomba, mkasikilizwa. Bidhaa zinazouzwa zaidi zimepunguzwa bei kwa muda mfupi.',
      benefits: [
        'Usafirishaji bure ndani ya jiji oda ikizidi kiwango',
        'Kila kipande hukaguliwa kabla ya kutumwa'
      ],
      offer: 'Taja msimbo KILI ukijibu, punguzo litatumika moja kwa moja.',
      cta: 'Angalia ofa',
      hashtags: ['#Ofa', '#KiliSocial'],
      imageSuggestion: 'Bidhaa zikipangwa kwenye mandhari ya mchanga, bei ikitazamika.'
    },
    new_arrival: {
      title: 'Imefika: bidhaa mpya kwa {audience}',
      hook: 'Stock mpya imefika na kiasi cha kwanza ni kidogo.',
      benefits: [
        'Rangi na saizi zilizokuwa zimeisha zimerudi',
        'Wanunua kwanza wanatumwa ndani ya saa 24'
      ],
      offer: 'Weka akiba leo, ulipe wakati wa kupokea.',
      cta: 'Tazama vipya',
      hashtags: ['#Vipya', '#KiliSocial'],
      imageSuggestion: 'Bidhaa mpya zikiwa zimelala sawa, moja ikiwa imeinuliwa kidogo.'
    },
    festival: {
      title: 'Tunasherehekea pamoja nawe, {audience}',
      hook: 'Msimu umefika na tumekuandalia kitu cha dhamira kwa wateja wa kudumu.',
      benefits: [
        'Vifurushi vya zawadi tayari kufungwa na kutumwa',
        'Muda wa kurudisha bidhaa umeongezwa wakati wa sikukuu'
      ],
      offer: 'Agiza kabla ya sikukuu, usafirishaji ni wetu.',
      cta: 'Chagua kifurushi',
      hashtags: ['#Sikukuu', '#Zawadi'],
      imageSuggestion: 'Kifurushi kilichofungwa kwa utepe wa mtindo wa kente, mwanga wa kaharabu.'
    },
    winback: {
      title: 'Tumehifadhi bidhaa zako pendwa, {audience}',
      hook: 'Imepita muda, kwa hivyo tumeweka ofa ya kukaribia tena.',
      benefits: [
        'Rudia oda yako ya mwisho kwa mguso mmoja',
        'Mkopo wa mteja unarudi kwenye ununuzi ujao'
      ],
      offer: 'Jibu ujumbe huu, tutaihifadhi ofa siku saba.',
      cta: 'Rudi uangalie',
      hashtags: ['#KaribuTena'],
      imageSuggestion: 'Bidhaa mbili zilizohifadhiwa pamoja na kidokezo cha mkopo.'
    },
    custom: {
      title: '{prompt}',
      hook: 'Hii hapa toleo fupi, limeandikwa kwa {audience}.',
      benefits: [
        'Maeleza ya moja kwa moja, bila mapambo',
        'Jibu wakati wowote, mtu atakujibu'
      ],
      offer: 'Tuulizie orodha ya bei na muda wa utoaji.',
      cta: 'Jua zaidi',
      hashtags: ['#KiliSocial'],
      imageSuggestion: 'Bidhaa kwenye uso wa rangi ya kawaida na mwanga laini.'
    }
  }
};

/** One tone line per language, inserted right after the hook. */
const TONE_LINE: Record<ContentTone, Record<ContentLanguage, string>> = {
  professional: {
    en: 'A short note from our team.',
    fr: 'Une note breve de notre equipe.',
    sw: 'Ujumbe mfupi kutoka kwa timu yetu.'
  },
  friendly: {
    en: 'Hello, we hope business is treating you well.',
    fr: 'Bonjour, nous esperons que les affaires vont bien.',
    sw: 'Habari, tunatumai biashara yako inaenda vizuri.'
  },
  playful: {
    en: 'Quick one, and yes, it is the good kind of news.',
    fr: 'Petite nouvelle, et oui, elle est bonne.',
    sw: 'Habari njema, na ni fupi pia.'
  },
  urgent: {
    en: 'This closes soon, so read it before it goes.',
    fr: 'Cela se termine bientot, lisez avant la fin.',
    sw: 'Hii inakwisha haraka, soma kabla haijaisha.'
  }
};

/** How many benefit lines each length keeps, and what else it carries. */
const LENGTH_RULES: Record<ContentLength, { benefits: number; hashtags: boolean; image: boolean }> = {
  short: { benefits: 0, hashtags: false, image: false },
  standard: { benefits: 1, hashtags: true, image: false },
  detailed: { benefits: 2, hashtags: true, image: true }
};

export interface DraftRequest {
  prompt: string;
  goal: MarketingGoal;
  audience: string;
  language: ContentLanguage;
  tone: ContentTone;
  length: ContentLength;
}

/** FNV-1a, the same digest family the backend semantic cache key uses. */
export function hashPrompt(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fallbackAudience(language: ContentLanguage): string {
  if (language === 'fr') return 'nos clients';
  if (language === 'sw') return 'wateja wetu';
  return 'our customers';
}

function fallbackTitle(language: ContentLanguage): string {
  if (language === 'fr') return 'Des nouvelles de notre equipe';
  if (language === 'sw') return 'Habari kutoka timu yetu';
  return 'An update from our team';
}

function fill(template: string, request: DraftRequest): string {
  const audience = request.audience.trim() || fallbackAudience(request.language);
  return template
    .replace('{audience}', audience)
    .replace('{prompt}', request.prompt.trim() || fallbackTitle(request.language));
}

/**
 * Builds the message body: hook, tone line, the benefit count the length asks
 * for, the offer and optional hashtags. Pure string assembly, no randomness.
 */
export function composeBody(request: DraftRequest): string {
  const parts = COPY[request.language][request.goal];
  const rules = LENGTH_RULES[request.length];
  const body: string[] = [fill(parts.hook, request), TONE_LINE[request.tone][request.language]];
  for (const benefit of parts.benefits.slice(0, rules.benefits)) body.push(benefit);
  body.push(parts.offer);
  if (rules.hashtags) body.push(parts.hashtags.join(' '));
  return body.join('\n\n');
}

/** Deterministic id so regenerating the same prompt replaces the same draft. */
export function contentIdFor(request: DraftRequest): string {
  return 'mc-' + hashPrompt([request.prompt, request.goal, request.language, request.tone, request.length].join('|'));
}

export function composeContent(request: DraftRequest, now: number): MarketingContent {
  const parts = COPY[request.language][request.goal];
  const rules = LENGTH_RULES[request.length];
  return {
    id: contentIdFor(request),
    title: fill(parts.title, request),
    body: composeBody(request),
    cta: parts.cta,
    imageSuggestion: rules.image ? parts.imageSuggestion : '',
    hashtags: rules.hashtags ? [...parts.hashtags] : [],
    goal: request.goal,
    language: request.language,
    tone: request.tone,
    length: request.length,
    createdAt: now
  };
}

export interface FeedbackRule {
  /** Substrings, lower-cased, covering every supported UI language. */
  matches: string[];
  action: 'tone' | 'length' | 'discount' | 'cta';
  tone?: ContentTone;
  length?: ContentLength;
}

export const FEEDBACK_RULES: FeedbackRule[] = [
  { matches: ['playful', 'fun', '活泼', '轻松', 'drame'], action: 'tone', tone: 'playful' },
  { matches: ['serious', 'formal', 'professional', '专业', '正式', 'serieux'], action: 'tone', tone: 'professional' },
  { matches: ['urgent', 'deadline', '紧迫', '限时', 'presse'], action: 'tone', tone: 'urgent' },
  { matches: ['warm', 'friendly', '亲切', '友好', 'chaleureux'], action: 'tone', tone: 'friendly' },
  { matches: ['shorter', 'brief', '简短', '精简', 'court'], action: 'length', length: 'short' },
  { matches: ['longer', 'detail', '详细', '更多细节', 'detaille'], action: 'length', length: 'detailed' },
  { matches: ['discount', 'price', '折扣', '价格', '优惠', 'remise', 'punguzo'], action: 'discount' },
  { matches: ['cta', 'button', '按钮', '行动', 'bouton', 'kitufe'], action: 'cta' }
];

function discountLine(language: ContentLanguage): string {
  if (language === 'fr') return 'Remise : 15 % sur la premiere commande du mois.';
  if (language === 'sw') return 'Punguzo: asilimia 15 kwa oda ya kwanza ya mwezi.';
  return 'Discount: 15 percent off the first order this month.';
}

function ctaLine(language: ContentLanguage): string {
  if (language === 'fr') return 'Bouton d’action ajoute en fin de message.';
  if (language === 'sw') return 'Kitufe cha hatua kimeongezwa mwishoni mwa ujumbe.';
  return 'Call to action added at the end of the message.';
}

function ctaLabel(language: ContentLanguage): string {
  if (language === 'fr') return 'Reserver maintenant';
  if (language === 'sw') return 'Weka akiba sasa';
  return 'Reserve now';
}

/**
 * Applies a free-text refinement to an existing draft. Recognised rules go
 * back through the composer so the output stays coherent; unrecognised text is
 * kept as an explicit note line instead of being silently dropped.
 */
export function refineContent(
  source: MarketingContent,
  feedback: string,
  now: number
): { content: MarketingContent; applied: FeedbackRule[]; notes: string[] } {
  const text = feedback.toLowerCase();
  const applied = FEEDBACK_RULES.filter((rule) => rule.matches.some((word) => text.includes(word)));
  const tone = applied.find((rule) => rule.action === 'tone')?.tone ?? source.tone;
  const length = applied.find((rule) => rule.action === 'length')?.length ?? source.length;
  const next = composeContent({
    prompt: source.title,
    goal: source.goal,
    audience: '',
    language: source.language,
    tone,
    length
  }, now);
  const notes: string[] = [];
  if (applied.some((rule) => rule.action === 'discount')) notes.push(discountLine(source.language));
  if (applied.some((rule) => rule.action === 'cta')) notes.push(ctaLine(source.language));
  if (applied.length === 0 && feedback.trim()) notes.push('"' + feedback.trim() + '"');
  const wantsCta = applied.some((rule) => rule.action === 'cta');
  return {
    content: {
      ...next,
      id: source.id,
      title: source.title,
      body: notes.length ? next.body + '\n\n' + notes.join('\n') : next.body,
      cta: wantsCta ? ctaLabel(source.language) : source.cta,
      createdAt: now
    },
    applied,
    notes
  };
}

/** One line summary for cards and history rows. */
export function summarizeContent(content: Pick<MarketingContent, 'body'>, max = 90): string {
  const flat = content.body.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + '\u2026';
}

/**
 * Renders the message the way each channel shows it. Instagram and TikTok keep
 * hashtags inline and truncate at the caption limit; WhatsApp keeps the body
 * verbatim because these lengths never reach its cap.
 */
export function renderPreview(platform: ChannelPlatform, content: MarketingContent): ContentPreview {
  const limit = CHANNEL_BODY_LIMIT[platform];
  const inlineTags = platform === 'instagram' || platform === 'tiktok';
  const withTags = inlineTags && content.hashtags.length
    ? content.body + '\n\n' + content.hashtags.join(' ')
    : content.body;
  const truncated = withTags.length > limit;
  return {
    platform,
    title: content.title,
    body: truncated ? withTags.slice(0, Math.max(0, limit - 1)).trimEnd() + '\u2026' : withTags,
    cta: content.cta,
    charCount: withTags.length,
    limit,
    truncated
  };
}

export function renderPreviews(platforms: ChannelPlatform[], content: MarketingContent): ContentPreview[] {
  return platforms.map((platform) => renderPreview(platform, content));
}

/** True when the draft carries everything a channel needs to accept it. */
export function isContentSendable(content: MarketingContent | null): boolean {
  if (!content) return false;
  return content.title.trim().length > 0 && content.body.trim().length > 0;
}

/** Exposed for the template picker: the raw bank behind one goal. */
export function copyPartsFor(language: ContentLanguage, goal: MarketingGoal): CopyParts {
  return COPY[language][goal];
}
