import { useState, useEffect } from 'react';

const ONBOARDING_STORAGE_KEY = 'whynot_onboarding_completed';

export const useOnboarding = () => {
  const [isCompleted, setIsCompleted] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if onboarding has been completed
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
    setIsCompleted(completed);
    setIsLoading(false);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setIsCompleted(true);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setIsCompleted(false);
  };

  return {
    isCompleted,
    isLoading,
    completeOnboarding,
    resetOnboarding,
  };
};
