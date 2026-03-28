/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings2, 
  Timer as TimerIcon, 
  Download, 
  Type, 
  CloudRain, 
  Snowflake, 
  Play, 
  Pause, 
  RotateCcw,
  Volume2,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Upload,
  Menu,
  FileText,
  FileCode,
  File
} from 'lucide-react';
import ShaderCanvas from './components/ShaderCanvas';
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

type Mode = 'rainy' | 'snowy';
type Font = 'sans' | 'mono' | 'serif';

const BACKGROUNDS = [
  { id: 'academy', name: 'Gryffindor Room', url: '/assets/bg/academy.png' },
  { id: 'forest', name: 'Forest Pavilion', url: '/assets/bg/forest.png' },
  { id: 'garden', name: 'Dreamy Flower Field', url: '/assets/bg/garden.png' },
  { id: 'lake', name: 'Lake View', url: '/assets/bg/lake.png' },
  { id: 'winter-garden', name: 'Winter Garden', url: '/assets/bg/winter-garden.png' },
];

export default function App() {
  // --- State ---
  const [content, setContent] = useState(() => localStorage.getItem('writher-content') || '');
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('writher-mode') as Mode) || 'rainy');
  const [font, setFont] = useState<Font>(() => (localStorage.getItem('writher-font') as Font) || 'serif');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('writher-font-size')) || 18);
  const [backgroundMode, setBackgroundMode] = useState<'default' | 'custom'>(() => 
    (localStorage.getItem('writher-bg-mode') as 'default' | 'custom') || 'default'
  );
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(() => {
    const saved = localStorage.getItem('writher-bg');
    // Migration: fix old filename with space
    if (saved === '/assets/bg/winter garden.png') {
      return '/assets/bg/winter-garden.png';
    }
    return saved || BACKGROUNDS[0].url;
  });
  
  // Vibe Mixer Settings
  const [intensity, setIntensity] = useState(40);
  const [blur, setBlur] = useState(10);
  const [volume, setVolume] = useState(30);
  
  // UI Visibility
  const [showMixer, setShowMixer] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [showBackgrounds, setShowBackgrounds] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTopHovered, setIsTopHovered] = useState(false);
  const [isBottomHovered, setIsBottomHovered] = useState(false);
  const [isUIActive, setIsUIActive] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  
  const menuTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);
  const cachedFontRef = useRef<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [initialTime, setInitialTime] = useState(25 * 60);

  // --- Ambient Audio ---
  useAmbientAudio(mode, volume);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('writher-content', content);
    // Update scroll progress on content change
    updateScrollProgress();
  }, [content]);

  useEffect(() => {
    localStorage.setItem('writher-mode', mode);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('writher-font', font);
  }, [font]);

  useEffect(() => {
    localStorage.setItem('writher-font-size', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    try {
      localStorage.setItem('writher-bg-mode', backgroundMode);
      console.log("Saved backgroundMode to localStorage:", backgroundMode);
    } catch (e) {
      console.error("Failed to save backgroundMode to localStorage:", e);
    }
  }, [backgroundMode]);

  useEffect(() => {
    try {
      localStorage.setItem('writher-bg', backgroundImageUrl);
      console.log("Saved backgroundImageUrl to localStorage (length):", backgroundImageUrl?.length);
    } catch (e) {
      console.error("Failed to save backgroundImageUrl to localStorage:", e);
      showToast("Storage full, background might not persist");
    }
  }, [backgroundImageUrl]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) window.clearTimeout(menuTimeoutRef.current);
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // UI Auto-hide Logic
  useEffect(() => {
    if (isBottomHovered) {
      setIsUIActive(true);
    } else {
      const timer = setTimeout(() => {
        setIsUIActive(false);
        setShowMixer(false);
        setShowBackgrounds(false);
        setShowTimer(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isBottomHovered]);

  // Timer Logic
  useEffect(() => {
    let interval: number;
    if (isTimerRunning && timerSeconds > 0) {
      interval = window.setInterval(() => {
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // --- Handlers ---
  const showToast = (message: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, visible: true });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("no file selected");
      return;
    }

    console.log("upload triggered", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Check file size (optional but good practice for localStorage)
    if (file.size > 5 * 1024 * 1024) {
      console.log("file too large, aborting");
      showToast("Image too large (max 5MB for persistence)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      console.log("reader loaded, result length:", result?.length);
      
      console.log("before setCustomBackground (backgroundImageUrl)");
      console.log("value to write:", result.substring(0, 50) + "...");
      
      setBackgroundImageUrl(result);
      setBackgroundMode('custom');
      
      console.log("after setCustomBackground (backgroundImageUrl)");
      showToast("Upload successful");
    };
    reader.onerror = (err) => {
      console.log("FileReader error:", err);
      showToast("Failed to read file");
    };
    reader.readAsDataURL(file);
  };

  const exportTxt = () => {
    try {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `writher-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Export successful");
    } catch (error) {
      console.error("Export TXT failed:", error);
    }
  };

  const exportPDF = async () => {
    if (isExportingPDF) return;
    
    try {
      setIsExportingPDF(true);
      showToast("Preparing PDF...");
      
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // 1. Load Chinese Font from local assets
      if (!cachedFontRef.current) {
        try {
          const response = await fetch('/assets/font/chinese-font.ttf', { cache: 'force-cache' });
          if (!response.ok) {
            throw new Error(`Failed to load local font file: ${response.status} ${response.statusText}`);
          }
          const fontBuffer = await response.arrayBuffer();
          
          // Robust ArrayBuffer to Base64
          const bytes = new Uint8Array(fontBuffer);
          let binary = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          cachedFontRef.current = btoa(binary);
        } catch (e) {
          console.error("Failed to load local font:", e);
          throw new Error(`Font loading failed. Please ensure /public/assets/font/chinese-font.ttf exists.`);
        }
      }

      // 2. Add font to jsPDF
      doc.addFileToVFS('CustomChineseFont.ttf', cachedFontRef.current!);
      doc.addFont('CustomChineseFont.ttf', 'CustomChineseFont', 'normal');
      doc.setFont('CustomChineseFont');

      // 3. Set up layout
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const contentWidth = pageWidth - (margin * 2);
      
      // Convert fontSize from px/pt to mm (approximate)
      // 1pt = 0.3527mm
      const fontSizeInMm = fontSize * 0.3527;
      const lineHeight = fontSizeInMm * 1.5;
      
      doc.setFontSize(fontSize);
      doc.setTextColor(0, 0, 0); // Pure black text

      // 4. Split text into lines that fit the page width
      // Note: splitTextToSize might have issues with CJK in some versions
      // We'll use a safer approach if needed, but let's try this first
      const rawLines = content.split('\n');
      let cursorY = margin + fontSizeInMm; // Start below the top margin

      rawLines.forEach((paragraph) => {
        const wrappedLines = doc.splitTextToSize(paragraph || ' ', contentWidth);
        
        wrappedLines.forEach((line: string) => {
          if (cursorY + lineHeight > pageHeight - margin) {
            doc.addPage();
            cursorY = margin + fontSizeInMm;
          }
          doc.text(line, margin, cursorY);
          cursorY += lineHeight;
        });
      });

      doc.save(`writher-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast("Export successful");
    } catch (error) {
      console.error("Export PDF failed:", error);
      showToast("Export failed, please try again");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportWord = async () => {
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: content.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `writher-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Export successful");
    } catch (error) {
      console.error("Export Word failed:", error);
    }
  };

  const handleMenuEnter = () => {
    if (menuTimeoutRef.current) {
      window.clearTimeout(menuTimeoutRef.current);
      menuTimeoutRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMenuLeave = () => {
    menuTimeoutRef.current = window.setTimeout(() => {
      setIsMenuOpen(false);
    }, 150);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const updateScrollProgress = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      const maxScroll = scrollHeight - clientHeight;
      setCanScroll(maxScroll > 0);
      setScrollProgress(maxScroll <= 0 ? 0 : (scrollTop / maxScroll) * 100);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const maxScroll = scrollHeight - clientHeight;
    setCanScroll(maxScroll > 0);
    
    // Show scrollbar
    setIsScrolling(true);
    if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 1500);

    if (maxScroll <= 0) {
      setScrollProgress(0);
      return;
    }
    const progress = (scrollTop / maxScroll) * 100;
    setScrollProgress(progress);
  };

  const fontClasses = {
    sans: 'font-sans',
    mono: 'font-mono',
    serif: 'font-serif',
  };

  console.log("App Render - current customBackground (backgroundImageUrl):", backgroundImageUrl?.substring(0, 50) + "...");
  console.log("App Render - current background mode:", backgroundMode);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8">
      {/* Background Shader */}
      <ShaderCanvas mode={mode} blur={blur} intensity={intensity} backgroundImageUrl={backgroundImageUrl} backgroundMode={backgroundMode} />

      {/* Top Mode Switcher (Visible on hover) */}
      <div 
        className="fixed top-0 left-0 w-full h-20 z-50 flex justify-center items-start pt-4"
        onMouseEnter={() => setIsTopHovered(true)}
        onMouseLeave={() => setIsTopHovered(false)}
      >
        <AnimatePresence>
          {isTopHovered && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="glass-dark px-6 py-2 rounded-full flex items-center gap-6"
            >
              <button 
                onClick={() => setMode('rainy')}
                className={`flex items-center gap-2 text-sm uppercase tracking-widest transition-colors ${mode === 'rainy' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                <CloudRain size={14} /> Rainy
              </button>
              <div className="w-px h-4 bg-white/10" />
              <button 
                onClick={() => setMode('snowy')}
                className={`flex items-center gap-2 text-sm uppercase tracking-widest transition-colors ${mode === 'snowy' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                <Snowflake size={14} /> Snowy
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Editor */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="w-full max-w-4xl aspect-[4/3] md:aspect-[16/10] glass rounded-3xl p-8 md:p-12 relative group"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onScroll={handleScroll}
          style={{ fontSize: `${fontSize}px` }}
          className={`w-full h-full bg-transparent border-none outline-none resize-none leading-relaxed text-white/90 no-scrollbar ${fontClasses[font]}`}
          spellCheck={false}
        />

        {/* Vertical Progress Indicator */}
        <AnimatePresence>
          {canScroll && isScrolling && (
            <motion.div 
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 5 }}
              className="absolute right-4 top-12 bottom-12 w-1 rounded-full bg-white/5 pointer-events-none"
            >
              <motion.div 
                className="w-full bg-white/20 rounded-full"
                initial={false}
                animate={{ 
                  height: '30%',
                  top: `${scrollProgress * 0.7}%` 
                }}
                style={{ position: 'absolute' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Blinking Cursor Placeholder */}
        {content === '' && (
          <div className="absolute top-8 md:top-12 left-8 md:left-12 pointer-events-none">
            <div 
              style={{ height: `${fontSize * 1.4}px` }}
              className="w-[2px] bg-white/40 animate-slow-blink" 
            />
          </div>
        )}
        
        {/* Floating Actions (Unified Menu) */}
        <div 
          className="absolute top-6 right-6 z-50"
          onMouseEnter={handleMenuEnter}
          onMouseLeave={handleMenuLeave}
        >
          <button 
            className={`p-2 rounded-full glass-dark text-white/60 hover:text-white transition-all duration-300 ${isMenuOpen ? 'rotate-90 text-white' : ''}`}
          >
            <Menu size={20} />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-full right-0 mt-2 w-64 glass-dark rounded-2xl p-4 shadow-2xl border border-white/5 backdrop-blur-xl"
              >
                {/* Section A: Font Settings */}
                <div className="space-y-4 pb-4 border-bottom border-white/5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">
                    <Type size={12} /> Font Settings
                  </div>
                  
                  <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
                    {(['sans', 'serif', 'mono'] as Font[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFont(f)}
                        className={`flex-1 py-1.5 text-[10px] uppercase tracking-widest rounded-md transition-all ${font === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                      <span>Size</span>
                      <span>{fontSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="14" 
                      max="32" 
                      value={fontSize} 
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                    />
                  </div>
                </div>

                <div className="h-px bg-white/5 my-4" />

                {/* Section B: Export Options */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/30 font-medium">
                    <Download size={12} /> Export
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={exportTxt}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all group"
                    >
                      <FileText size={16} className="text-white/20 group-hover:text-white/60" />
                      <span className="text-xs tracking-wide">Plain Text (.txt)</span>
                    </button>
                    <button 
                      onClick={exportPDF}
                      disabled={isExportingPDF}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all group ${isExportingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <File size={16} className={`text-white/20 group-hover:text-white/60 ${isExportingPDF ? 'animate-spin' : ''}`} />
                      <span className="text-xs tracking-wide">{isExportingPDF ? 'Exporting...' : 'PDF Document (.pdf)'}</span>
                    </button>
                    <button 
                      onClick={exportWord}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 text-white/60 hover:text-white transition-all group"
                    >
                      <FileCode size={16} className="text-white/20 group-hover:text-white/60" />
                      <span className="text-xs tracking-wide">Word Document (.docx)</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Bottom Controls Trigger Area */}
      <div 
        className="fixed bottom-0 left-0 w-full h-24 flex justify-center items-end pb-8 z-40"
        onMouseEnter={() => setIsBottomHovered(true)}
        onMouseLeave={() => setIsBottomHovered(false)}
      >
        <AnimatePresence>
          {isUIActive && (
            <motion.div 
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ 
                duration: 0.2, 
                ease: [0.22, 1, 0.36, 1] 
              }}
              className="glass-dark px-6 py-3 rounded-full flex gap-8 items-center shadow-2xl pointer-events-auto will-change-transform"
            >
              <motion.button 
                whileHover={{ scale: 1.1, color: "rgba(255, 255, 255, 1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowMixer(!showMixer);
                  setShowTimer(false);
                  setShowBackgrounds(false);
                }}
                className={`p-2 rounded-full ${showMixer ? 'text-white' : 'text-white/40'}`}
                title="Vibe Mixer"
              >
                <Settings2 size={22} />
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.1, color: "rgba(255, 255, 255, 1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowBackgrounds(!showBackgrounds);
                  setShowMixer(false);
                  setShowTimer(false);
                }}
                className={`p-2 rounded-full ${showBackgrounds ? 'text-white' : 'text-white/40'}`}
                title="Backgrounds"
              >
                <ImageIcon size={22} />
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.1, color: "rgba(255, 255, 255, 1)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowTimer(!showTimer);
                  setShowMixer(false);
                  setShowBackgrounds(false);
                }}
                className={`p-2 rounded-full ${showTimer ? 'text-white' : 'text-white/40'}`}
                title="Zen Timer"
              >
                <TimerIcon size={22} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vibe Mixer Panel */}
      <AnimatePresence>
        {showMixer && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 glass-dark p-8 rounded-[2rem] w-80 flex flex-col items-center gap-6 z-50"
            onMouseEnter={() => setIsBottomHovered(true)}
            onMouseLeave={() => setIsBottomHovered(false)}
          >
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">Vibe Mixer</h3>
            
            <div className="w-full space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/60">
                  <span>Intensity</span>
                  <span>{intensity}%</span>
                </div>
                <input 
                  type="range" value={intensity} onChange={(e) => setIntensity(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/60">
                  <span>Blur</span>
                  <span>{blur}%</span>
                </div>
                <input 
                  type="range" value={blur} onChange={(e) => setBlur(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/60">
                  <span>Volume</span>
                  <span>{volume}%</span>
                </div>
                <input 
                  type="range" value={volume} onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Selector Panel */}
      <AnimatePresence>
        {showBackgrounds && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 glass-dark p-8 rounded-[2rem] w-80 flex flex-col items-center gap-6 z-50"
            onMouseEnter={() => setIsBottomHovered(true)}
            onMouseLeave={() => setIsBottomHovered(false)}
          >
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">Backgrounds</h3>
            
            <div className="w-full grid grid-cols-2 gap-3">
              {BACKGROUNDS.map((bg) => (
                <motion.button
                  key={bg.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setBackgroundImageUrl(bg.url);
                    setBackgroundMode('default');
                  }}
                  className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-colors duration-300 ${backgroundMode === 'default' && backgroundImageUrl === bg.url ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/20 flex items-end p-2">
                    <span className="text-[8px] uppercase tracking-widest text-white">{bg.name}</span>
                  </div>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => bgInputRef.current?.click()}
                className="relative aspect-video rounded-xl overflow-hidden border-2 border-dashed border-white/20 hover:border-white/40 transition-all flex flex-col items-center justify-center gap-2 bg-white/5"
              >
                <Upload size={16} className="text-white/40" />
                <span className="text-[8px] uppercase tracking-widest text-white/40">Upload Custom</span>
                <input 
                  type="file" 
                  ref={bgInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleBackgroundUpload} 
                />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zen Timer Panel */}
      <AnimatePresence>
        {showTimer && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 glass-dark p-8 rounded-[2rem] w-80 flex flex-col items-center gap-6 z-50"
            onMouseEnter={() => setIsBottomHovered(true)}
            onMouseLeave={() => setIsBottomHovered(false)}
          >
            <h3 className="text-xs uppercase tracking-[0.2em] text-white/40 font-medium">Zen Timer</h3>
            
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle 
                  cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="2"
                  className="text-white/5"
                />
                <motion.circle 
                  cx="64" cy="64" r="60" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeDasharray="377"
                  animate={{ strokeDashoffset: 377 * (1 - timerSeconds / initialTime) }}
                  className="text-white"
                />
              </svg>
              <span className="text-2xl font-mono tracking-tighter">{formatTime(timerSeconds)}</span>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="p-3 rounded-full bg-white text-black hover:bg-white/90 transition-colors"
              >
                {isTimerRunning ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button 
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(initialTime);
                }}
                className="p-3 rounded-full glass text-white hover:bg-white/10 transition-colors"
              >
                <RotateCcw size={20} />
              </button>
            </div>

            <div className="flex gap-2">
              {[15, 25, 45].map(m => (
                <button 
                  key={m}
                  onClick={() => {
                    const s = m * 60;
                    setInitialTime(s);
                    setTimerSeconds(s);
                    setIsTimerRunning(false);
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-widest transition-colors ${initialTime === m * 60 ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'}`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Music Attribution / Info (Very subtle) */}
      <div className="fixed bottom-4 right-6 text-[8px] uppercase tracking-[0.3em] text-white/10 pointer-events-none">
        Writher — Cyber Zen Editor
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {toast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            <div className="glass-dark px-6 py-2.5 rounded-full border border-white/10 shadow-2xl flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-xs uppercase tracking-[0.2em] text-white/80 font-medium">
                {toast.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
