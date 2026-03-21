import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiZap, FiHome } from 'react-icons/fi';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="p-4 bg-slate-900 rounded-full mb-6">
        <FiAlertTriangle className="h-12 w-12 text-slate-500" />
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-slate-400 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => navigate('/')}>
          <FiHome className="mr-2" />
          Dashboard
        </Button>
        <Button onClick={() => navigate('/qa-loop')}>
          <FiZap className="mr-2" />
          Go to QA Loop
        </Button>
      </div>
    </div>
  );
};
