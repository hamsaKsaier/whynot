import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META,
  type SupportedLanguage,
} from '@/i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.resolvedLanguage ?? 'en') as SupportedLanguage;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    const { dir } = LANGUAGE_META[lang];
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Change language"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const meta = LANGUAGE_META[lang];
          return (
            <DropdownMenuItem
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={currentLang === lang ? 'bg-accent' : undefined}
            >
              <span className="me-2">{meta.flag}</span>
              {meta.nativeName}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
