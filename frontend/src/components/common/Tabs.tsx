import React, { useRef, useState, useEffect } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showStartFade, setShowStartFade] = useState(false);
  const [showEndFade, setShowEndFade] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isRtl = document.documentElement.dir === 'rtl';
    const scrollStart = isRtl ? Math.abs(el.scrollLeft) : el.scrollLeft;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowStartFade(scrollStart > 4);
    setShowEndFade(maxScroll - scrollStart > 4);
  };

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(updateFades);
    obs.observe(el);
    return () => obs.disconnect();
  }, [tabs]);

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? activeTab;

  return (
    <>
      {/* Mobile: Select dropdown */}
      <div className="sm:hidden">
        <Select value={activeTab} onValueChange={onTabChange}>
          <SelectTrigger className="w-full bg-muted border-border text-foreground" data-testid="settings-tab-select">
            <SelectValue>{activeLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem key={tab.id} value={tab.id}>
                <span className="flex items-center gap-2">
                  {tab.icon}
                  {tab.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tablet+Desktop: scrollable horizontal tab strip with fade edges */}
      <div className="hidden sm:block relative border-b border-border">
        {showStartFade && (
          <div className="absolute start-0 top-0 bottom-0 w-8 z-10 pointer-events-none ltr:bg-gradient-to-r rtl:bg-gradient-to-l from-background to-transparent" />
        )}
        <div
          ref={scrollRef}
          onScroll={updateFades}
          className="overflow-x-auto scrollbar-none"
        >
          <nav className="flex gap-x-6 px-1 min-w-max" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors duration-150 whitespace-nowrap ${
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                  aria-selected={isActive}
                  role="tab"
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        {showEndFade && (
          <div className="absolute end-0 top-0 bottom-0 w-8 z-10 pointer-events-none ltr:bg-gradient-to-l rtl:bg-gradient-to-r from-background to-transparent" />
        )}
      </div>
    </>
  );
};
