import React from 'react';
import { MainLayout } from './Layout/MainLayout';

interface LayoutProps {
  children: React.ReactNode;
  showBrowserPreview?: boolean;
  browserPreview?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  showBrowserPreview,
  browserPreview 
}) => {
  return (
    <MainLayout 
      showBrowserPreview={showBrowserPreview}
      browserPreview={browserPreview}
    >
      {children}
    </MainLayout>
  );
};





