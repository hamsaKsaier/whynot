import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiAlertTriangle, FiZap, FiHome } from 'react-icons/fi';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 bg-muted rounded-lg mb-6">
        <FiAlertTriangle className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">{t('notFound.title')}</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        {t('notFound.description')}
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/app')}>
          <FiHome className="me-2" />
          {t('notFound.dashboard')}
        </Button>
        <Button onClick={() => navigate('/qa-loop')}>
          <FiZap className="me-2" />
          {t('notFound.qaLoop')}
        </Button>
      </div>
    </div>
  );
};
