import { useEffect, useState } from "react";

interface AudioWaveformProps {
  isActive: boolean;
  barCount?: number;
  className?: string;
}

export default function AudioWaveform({ 
  isActive, 
  barCount = 5,
  className = "" 
}: AudioWaveformProps) {
  const [heights, setHeights] = useState<number[]>(Array(barCount).fill(20));

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(barCount).fill(20));
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => {
        const baseHeight = 20;
        const maxVariation = 80;
        return baseHeight + Math.random() * maxVariation;
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, barCount]);

  const baseHeights = [40, 70, 50, 80, 35];

  return (
    <div className={`flex items-center justify-center gap-[3px] h-6 ${className}`}>
      {heights.map((height, index) => {
        const displayHeight = isActive ? height : baseHeights[index % baseHeights.length];
        return (
          <div
            key={index}
            className="w-[3px] rounded-full transition-all duration-100 ease-in-out"
            style={{
              height: `${displayHeight}%`,
              backgroundColor: '#F97316',
            }}
          />
        );
      })}
    </div>
  );
}
