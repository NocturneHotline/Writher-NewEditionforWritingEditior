import { useEffect, useRef, useState } from 'react';

type Mode = 'rainy' | 'snowy';

const AUDIO_PATHS = {
  rainy: '/assets/audio/rain.mp3',
  snowy: '/assets/audio/snow.mp3',
};

export function useAmbientAudio(mode: Mode, volume: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const fadeIntervalRef = useRef<number | null>(null);

  // Mark user interaction
  useEffect(() => {
    const handleInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
    window.addEventListener('click', handleInteraction);
    window.addEventListener('keydown', handleInteraction);
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Fade logic
  const fade = (targetVolume: number, duration: number, callback?: () => void) => {
    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    if (!audioRef.current) return;

    const startVolume = audioRef.current.volume;
    const steps = 20;
    const stepTime = duration / steps;
    const volumeStep = (targetVolume - startVolume) / steps;
    let currentStep = 0;

    fadeIntervalRef.current = window.setInterval(() => {
      if (!audioRef.current) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        return;
      }
      
      currentStep++;
      const nextVolume = Math.max(0, Math.min(1, startVolume + volumeStep * currentStep));
      audioRef.current.volume = nextVolume;

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        audioRef.current.volume = targetVolume;
        if (callback) callback();
      }
    }, stepTime);
  };

  useEffect(() => {
    if (!hasInteracted) return;

    const playNewAudio = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(AUDIO_PATHS[mode]);
      audio.loop = true;
      audio.volume = 0;
      audioRef.current = audio;
      
      audio.play().then(() => {
        fade(volume / 100, 500);
      }).catch(err => console.warn('Audio play failed:', err));
    };

    if (audioRef.current) {
      // Fade out current audio then switch
      fade(0, 400, playNewAudio);
    } else {
      playNewAudio();
    }

    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [mode, hasInteracted]);

  // Update volume when state changes (without full reload)
  useEffect(() => {
    if (audioRef.current) {
      // Only apply manual volume if we are not currently fading
      if (!fadeIntervalRef.current) {
        audioRef.current.volume = volume / 100;
      }
    }
  }, [volume]);
}
