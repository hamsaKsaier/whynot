import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const LOCALES_DIR = path.resolve(__dirname, '../../public/locales');
const LANGUAGES = ['en', 'ar', 'fr', 'de', 'es'];
const NON_EN_LANGUAGES = LANGUAGES.filter(l => l !== 'en');
const NAMESPACES = ['admin', 'auth', 'common', 'settings', 'superadmin'];

const BRAND_ALLOW_LIST = new Set([
  'WhyNot QA',
  'QA Loop',
  'MCP',
  'Stripe',
  'GitHub',
  'Google',
  'CI/CD',
  'CSV',
  'JSON',
  'UUID',
  'URL',
  'ID',
  'JWT',
  'MRR',
  'ARR',
  'DAU',
  'MAU',
  'API',
  'OpenAI',
  'Anthropic',
  'OpenRouter',
  'admin@example.com',
  '••••••••',
  // International cognates — same word in multiple languages
  'Admin',
  'Action',
  'Date',
  'Actions',
  'Actor',
  'Audit',
  'Dashboard',
  'Description',
  'Details',
  'Enterprise',
  'Error',
  'Flag',
  'Flags',
  'General',
  'Name',
  'Navigation',
  'Plan',
  'Plans',
  'Public',
  'Rollout',
  'Slug',
  'Status',
  'Super Admin',
  'System',
  'Type',
  'Webhooks',
  'Page',
  '{{from}} — {{to}}',
  '{{price}}/{{interval}}',
]);

const FULLY_TRANSLATED_LANGUAGES = new Set(['ar', 'fr', 'de', 'es']);

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function getValues(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, getValues(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function loadJson(lang: string, ns: string): Record<string, unknown> {
  const filePath = path.join(LOCALES_DIR, lang, `${ns}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

describe('i18n completeness — admin-frontend', () => {
  it('all 5 languages have the same set of namespaces', () => {
    for (const lang of LANGUAGES) {
      const langDir = path.join(LOCALES_DIR, lang);
      expect(fs.existsSync(langDir), `${lang}/ directory missing`).toBe(true);

      const files = fs.readdirSync(langDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')).sort();
      expect(files, `${lang} namespace mismatch`).toEqual([...NAMESPACES].sort());
    }
  });

  for (const ns of NAMESPACES) {
    it(`namespace "${ns}" has identical key trees across all languages`, () => {
      const enKeys = getKeys(loadJson('en', ns));
      expect(enKeys.length).toBeGreaterThan(0);

      for (const lang of NON_EN_LANGUAGES) {
        const langKeys = getKeys(loadJson(lang, ns));
        expect(langKeys, `${lang}/${ns}.json key mismatch vs en`).toEqual(enKeys);
      }
    });
  }

  for (const ns of NAMESPACES) {
    for (const lang of NON_EN_LANGUAGES) {
      it(`${lang}/${ns}.json — translated values are non-empty and not English`, () => {
        const enValues = getValues(loadJson('en', ns));
        const langValues = getValues(loadJson(lang, ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const langValue = langValues[key];
          expect(langValue, `${lang}/${ns}.json key "${key}" is missing`).toBeDefined();

          if (FULLY_TRANSLATED_LANGUAGES.has(lang)) {
            expect(langValue.trim().length, `${lang}/${ns}.json key "${key}" is empty`).toBeGreaterThan(0);
          } else {
            if (langValue.trim().length === 0) continue;
          }

          if (!BRAND_ALLOW_LIST.has(enValue.trim())) {
            expect(langValue, `${lang}/${ns}.json key "${key}" is still English: "${langValue}"`).not.toBe(enValue);
          }
        }
      });
    }
  }

  for (const ns of NAMESPACES) {
    it(`en/${ns}.json — all values are non-empty`, () => {
      const enValues = getValues(loadJson('en', ns));

      for (const [key, value] of Object.entries(enValues)) {
        expect(
          typeof value === 'string' ? value.trim().length : 1,
          `en/${ns}.json key "${key}" is empty`
        ).toBeGreaterThan(0);
      }
    });
  }

  describe('French (fr) — typography and quality', () => {
    for (const ns of NAMESPACES) {
      it(`fr/${ns}.json — double punctuation preceded by NBSP`, () => {
        const frValues = getValues(loadJson('fr', ns));
        const issues: string[] = [];

        for (const [key, value] of Object.entries(frValues)) {
          for (let i = 1; i < value.length; i++) {
            if (':;?!'.includes(value[i]) && value[i - 1] === ' ') {
              const before = value.substring(Math.max(0, i - 10), i + 2);
              if (before.includes('http') || before.includes('://')) continue;
              issues.push(`${key}: regular space before "${value[i]}" — "${before}"`);
            }
          }
        }

        expect(issues, `Typography issues:\n${issues.join('\n')}`).toEqual([]);
      });
    }

    it('fr translations preserve {{placeholder}} syntax exactly', () => {
      const placeholderPattern = /\{\{[^}]+\}\}/g;

      for (const ns of NAMESPACES) {
        const enValues = getValues(loadJson('en', ns));
        const frValues = getValues(loadJson('fr', ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const enPlaceholders = (enValue.match(placeholderPattern) ?? []).sort();
          const frPlaceholders = (frValues[key].match(placeholderPattern) ?? []).sort();
          expect(
            frPlaceholders,
            `fr/${ns}.json key "${key}" placeholder mismatch`
          ).toEqual(enPlaceholders);
        }
      }
    });
  });

  describe('Spanish (es) — full coverage', () => {
    const SPANISH_MARKERS = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]|\b(el|la|los|las|un|una|y|de|del|en|por|para|con|sin|su|sus|que|es|son|está|están|al|se|lo|le|les|más|no|si|ya|como|pero|este|esta|estos|estas|todo|todos|todas|cada|muy|también|cuando|donde|puede|han|hay|ser|tiene|fue|aquí|ahora|entre|sobre|hasta|desde|aún|solo|otro|otra|otros|otras|nuevo|nueva|nuevos|nuevas|debe|durante|después|antes|siguiente|anterior|primero|primera|último|última|nombre|correo|contraseña|usuario|eliminar|guardar|crear|editar|cancelar|configuración|cuenta|inicio|sesión|prueba|pruebas|ejecución|resultados|errores|proyecto|créditos|suscripción|facturación|organización|modelos|otros)\b/i;

    for (const ns of NAMESPACES) {
      it(`es/${ns}.json — every non-brand value contains Spanish markers`, () => {
        const enValues = getValues(loadJson('en', ns));
        const esValues = getValues(loadJson('es', ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const esValue = esValues[key];
          if (BRAND_ALLOW_LIST.has(enValue.trim())) continue;
          if (/^\{\{.*\}\}$/.test(enValue.trim())) continue;
          if (/^https?:\/\//.test(enValue.trim())) continue;
          if (enValue === esValue) continue;
          if (esValue.split(/\s+/).length <= 4) continue;

          expect(
            SPANISH_MARKERS.test(esValue),
            `es/${ns}.json key "${key}" has no Spanish markers: "${esValue}"`
          ).toBe(true);
        }
      });
    }

    it('es translations preserve {{placeholder}} syntax exactly', () => {
      const placeholderPattern = /\{\{[^}]+\}\}/g;

      for (const ns of NAMESPACES) {
        const enValues = getValues(loadJson('en', ns));
        const esValues = getValues(loadJson('es', ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const enPlaceholders = (enValue.match(placeholderPattern) ?? []).sort();
          const esPlaceholders = (esValues[key].match(placeholderPattern) ?? []).sort();
          expect(
            esPlaceholders,
            `es/${ns}.json key "${key}" placeholder mismatch`
          ).toEqual(enPlaceholders);
        }
      }
    });

    it('es — inverted punctuation pairs match', () => {
      const issues: string[] = [];

      for (const ns of NAMESPACES) {
        const esValues = getValues(loadJson('es', ns));

        for (const [key, value] of Object.entries(esValues)) {
          const questionMarks = (value.match(/\?/g) ?? []).length;
          const invertedQuestions = (value.match(/¿/g) ?? []).length;
          if (questionMarks > 0 && invertedQuestions === 0) {
            issues.push(`${ns}/${key}: has "?" but no "¿" — "${value}"`);
          }

          const exclamationMarks = (value.match(/!/g) ?? []).length;
          const invertedExclamations = (value.match(/¡/g) ?? []).length;
          if (exclamationMarks > 0 && invertedExclamations === 0) {
            issues.push(`${ns}/${key}: has "!" but no "¡" — "${value}"`);
          }
        }
      }

      expect(issues, `Inverted punctuation issues:\n${issues.join('\n')}`).toEqual([]);
    });
  });

  describe('German (de) — full coverage', () => {
    const GERMAN_MARKERS = /[äöüßÄÖÜ]|\b(der|die|das|und|sie|ist|ein|eine|es|so|wo|da|ob|für|mit|von|nicht|oder|auf|den|dem|des|wird|sind|als|nach|bei|zum|zur|aus|über|ihre|ihrem|ihren|ihr|auch|noch|nur|aber|wenn|wie|alle|keine|kein|kann|werden|diese|mehr|zu|um|am|im|ab|unter|vor|ohne|durch|hier|sehr|dieser|diesem|jetzt|bereits|erneut|bitte|diesen|einen|einem|einer|wirklich|wurde|noch|dann|neue|neuer|neues|neuen|neuem|muss|sein|lang|pro|Tage|aktiv|generieren)\b/i;

    for (const ns of NAMESPACES) {
      it(`de/${ns}.json — every non-brand value contains German markers`, () => {
        const enValues = getValues(loadJson('en', ns));
        const deValues = getValues(loadJson('de', ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const deValue = deValues[key];
          if (BRAND_ALLOW_LIST.has(enValue.trim())) continue;
          if (/^\{\{.*\}\}$/.test(enValue.trim())) continue;
          if (/^https?:\/\//.test(enValue.trim())) continue;
          if (enValue === deValue) continue;
          if (deValue.split(/\s+/).length <= 4) continue;

          expect(
            GERMAN_MARKERS.test(deValue),
            `de/${ns}.json key "${key}" has no German markers: "${deValue}"`
          ).toBe(true);
        }
      });
    }

    it('de translations preserve {{placeholder}} syntax exactly', () => {
      const placeholderPattern = /\{\{[^}]+\}\}/g;

      for (const ns of NAMESPACES) {
        const enValues = getValues(loadJson('en', ns));
        const deValues = getValues(loadJson('de', ns));

        for (const [key, enValue] of Object.entries(enValues)) {
          const enPlaceholders = (enValue.match(placeholderPattern) ?? []).sort();
          const dePlaceholders = (deValues[key].match(placeholderPattern) ?? []).sort();
          expect(
            dePlaceholders,
            `de/${ns}.json key "${key}" placeholder mismatch`
          ).toEqual(enPlaceholders);
        }
      }
    });
  });

  it('pluralization: keys with {{count}} have appropriate values', () => {
    const interpolationKeys = [
      { ns: 'common', key: 'admin.common.selected' },
      { ns: 'common', key: 'admin.common.pageOf' },
      { ns: 'common', key: 'admin.dashboard.subscribers' },
      { ns: 'common', key: 'admin.users.totalUsers' },
      { ns: 'common', key: 'admin.common.typeToConfirm' },
    ];

    for (const { ns, key } of interpolationKeys) {
      for (const lang of LANGUAGES) {
        const values = getValues(loadJson(lang, ns));
        expect(values[key], `${lang}/${ns}.json missing interpolation key "${key}"`).toBeDefined();
        expect(values[key].length, `${lang}/${ns}.json key "${key}" is empty`).toBeGreaterThan(0);
      }
    }
  });
});
