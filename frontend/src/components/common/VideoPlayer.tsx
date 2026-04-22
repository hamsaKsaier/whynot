import React, { useRef, useState } from 'react';

interface VideoPlayerProps {
  src: string;
  title?: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, title, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const speeds = [0.5, 1, 1.5, 2];

  return (
    <div className={`rounded-lg overflow-hidden bg-card ${className}`}>
      {title && (
        <div className="px-3 py-2 bg-muted text-muted-foreground text-sm font-medium flex items-center gap-2">
          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553-1.106A1 1 0 0114 5.882V14.118a1 1 0 001.447.894l4-2a1 1 0 000-1.788l-4-2z" />
          </svg>
          {title}
        </div>
      )}
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full"
        style={{ maxHeight: '480px' }}
        preload="metadata"
      />
      <div className="px-3 py-2 bg-muted flex items-center gap-2">
        <span className="text-xs text-muted-foreground me-2">Speed:</span>
        {speeds.map((speed) => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`px-2 py-0.5 text-xs rounded ${
              playbackRate === speed
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
};
