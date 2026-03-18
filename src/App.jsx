import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Crown, Play, Timer, User, Delete, Maximize, Minimize,
  Network, Cable, Cpu, Server, Wifi, Plug, Monitor, HardDrive, Database, Router 
} from 'lucide-react';

// --- Configuration & Mock Data ---
const GAME_TIME = 60; // 60 seconds (1 minute)
const POINTS_PER_MATCH = 10;

// Placeholder icons for your products (Replace with image URLs later if needed)
const PRODUCT_ICONS = [Network, Cable, Cpu, Server, Wifi, Plug, Monitor, HardDrive, Database, Router];

// Pre-populated with your test scores to see the Top 3 styling
const initialLeaderboard = [
  { id: 'test-1', name: 'Y4', score: 100, timestamp: Date.now() - 400000 },
  { id: 'test-2', name: 'Y2', score: 60, timestamp: Date.now() - 300000 },
  { id: 'test-3', name: 'Y3', score: 50, timestamp: Date.now() - 200000 },
  { id: 'test-4', name: 'Yen', score: 20, timestamp: Date.now() - 100000 },
];

export default function App() {
  // --- State Management ---
  // Views: 'cover', 'playing', 'score_reveal', 'leaderboard'
  const [currentView, setCurrentView] = useState('cover');
  const [playerName, setPlayerName] = useState('');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const inputRef = useRef(null);
  const formContainerRef = useRef(null);
  
  // Game State
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // End Game State
  const [currentPlayerResult, setCurrentPlayerResult] = useState(null);

  // --- Fullscreen Logic ---
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const requestFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    }
  };

  const toggleFullScreen = (e) => {
    e.stopPropagation(); // Prevents the outer click listener from firing immediately
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // --- Auto-Scaling Display Logic ---
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      // Calculate the scale needed to fit 1920x1080 into the current window
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      // Use the smaller scale to ensure the whole 16:9 canvas is always visible
      setScale(Math.min(scaleX, scaleY));
    };

    handleResize(); // Trigger on initial load
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Title Case Formatter ---
  const formatTitleCase = (str) => {
    return str.split(' ').map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
  };

  // --- Input Handler (Supports Cursor & Selection) ---
  const handleInputText = (charOrAction) => {
    const input = inputRef.current;
    if (!input) return;

    // Grab the exact start and end positions of the user's text selection
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;

    setPlayerName(prev => {
      let newVal = prev;
      let newCursorPos = start;

      if (charOrAction === 'DEL' || charOrAction === 'Backspace') {
        if (start !== end) {
          // Delete highlighted text all at once
          newVal = prev.slice(0, start) + prev.slice(end);
          newCursorPos = start;
        } else if (start > 0) {
          // Delete single character behind the cursor
          newVal = prev.slice(0, start - 1) + prev.slice(end);
          newCursorPos = start - 1;
        }
      } else { 
        // Insert new character at the exact cursor position (or replace highlighted text)
        newVal = prev.slice(0, start) + charOrAction + prev.slice(end);
        newCursorPos = start + 1;
      }

      if (newVal.length <= 15) {
        // Update the visible blinking cursor position after React updates the text
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
        return formatTitleCase(newVal);
      }
      
      return prev;
    });
  };

  // --- Physical Keyboard Listener ---
  useEffect(() => {
    if (currentView !== 'cover') return;

    const handleGlobalKeyDown = (e) => {
      // Ignore special shortcuts like Ctrl+C, Alt+Tab
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Backspace') {
        handleInputText('Backspace');
      } else if (e.key.length === 1 && /[a-zA-Z0-9 ]/.test(e.key)) {
        handleInputText(e.key);
        // Automatically expand the UI to show the start button if they start typing physically
        setShowKeyboard(true); 
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentView]);

  // --- Click Outside to Hide Keyboard Listener ---
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If the keyboard is showing, AND the user clicked somewhere that is NOT inside the form container
      if (showKeyboard && formContainerRef.current && !formContainerRef.current.contains(event.target)) {
        setShowKeyboard(false);
      }
    };

    // Listen for both mouse clicks and physical touch events
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showKeyboard]);

  // --- Initialization ---
  const initializeGame = () => {
    // Create pairs, shuffle them
    const deck = [...PRODUCT_ICONS, ...PRODUCT_ICONS]
      .map((Icon, index) => ({ id: index, Icon, isMatched: false }))
      .sort(() => Math.random() - 0.5);
    
    setCards(deck);
    setFlippedIndices([]);
    setMatchedIndices([]);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setCurrentView('playing');
    setCurrentPlayerResult(null);
  };

  // --- Game Logic ---
  useEffect(() => {
    let timer;
    if (currentView === 'playing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (currentView === 'playing' && timeLeft === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [currentView, timeLeft]);

  // Check for game win (all matched)
  useEffect(() => {
    if (currentView === 'playing' && matchedIndices.length === 20) {
      endGame();
    }
  }, [matchedIndices]);

  const handleCardClick = (index) => {
    // Prevent clicking if processing, card already flipped, or already matched
    if (isProcessing || flippedIndices.includes(index) || matchedIndices.includes(index)) {
      return;
    }

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      const [firstIndex, secondIndex] = newFlipped;
      
      if (cards[firstIndex].Icon === cards[secondIndex].Icon) {
        // Match found
        setMatchedIndices(prev => [...prev, firstIndex, secondIndex]);
        setScore(prev => prev + POINTS_PER_MATCH);
        setFlippedIndices([]);
        setIsProcessing(false);
      } else {
        // No match, flip back after delay
        setTimeout(() => {
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 500);
      }
    }
  };

  const endGame = () => {
    setCurrentView('score_reveal');
    
    const newResult = {
      id: Date.now().toString(),
      name: playerName || 'Guest',
      score: score,
      timestamp: Date.now()
    };
    setCurrentPlayerResult(newResult);

    // Update Leaderboard: Add new, sort by score (desc), then by timestamp (desc - newer is better in ties)
    const newLeaderboard = [...leaderboard, newResult].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.timestamp - a.timestamp; // Tie breaker: newer timestamp wins
    });
    
    setLeaderboard(newLeaderboard);

    // Transition to leaderboard after 3 seconds
    setTimeout(() => {
      setCurrentView('leaderboard');
    }, 3000);
  };

  const resetToCover = () => {
    setPlayerName('');
    setShowKeyboard(false);
    setCurrentView('cover');
  };

  // --- Keyboard Logic ---
  const handleKeyPress = (key) => {
    if (key === 'DEL') {
      handleInputText('DEL');
    } else {
      const char = key === 'SPACE' ? ' ' : key;
      handleInputText(char);
    }
  };

  const keyboardRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL']
  ];

  // --- View Renderer ---
  const renderCurrentView = () => {
    if (currentView === 'cover') {
      return (
        <div className="w-full h-full bg-slate-900 text-white flex flex-col items-center justify-center p-6 font-sans">
          {/* Branding */}
          <div className="mb-4 flex flex-col items-center">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2 tracking-tighter shadow-lg">
              EXW
            </h1>
            <h2 className="text-3xl font-bold tracking-wide text-slate-200 uppercase">Memory Challenge</h2>
            <p className="text-emerald-400 text-lg mt-2">Match the products. Win the prize.</p>
          </div>

          {/* Input Form & Keyboard */}
          <div ref={formContainerRef} className="w-full max-w-3xl bg-slate-800 p-6 rounded-3xl shadow-2xl border border-slate-700 mb-6 flex flex-col items-center">
            <label className="text-xl mb-3 font-semibold flex items-center text-slate-300">
              <User className="mr-3 w-6 h-6 text-emerald-400" />
              Enter Your Name to Play
            </label>
            
            <div className="w-full relative mb-4">
              <input 
                ref={inputRef}
                type="text" 
                value={playerName}
                readOnly={true} // Prevents Windows/Android virtual keyboard from opening!
                onClick={() => setShowKeyboard(true)}
                placeholder="Tap here to type..."
                className="w-full text-4xl p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 text-white text-center focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20 transition-all cursor-pointer"
                maxLength={15}
              />
              {/* Fake blinking cursor effect when empty */}
              {!playerName && showKeyboard && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 bg-emerald-400 animate-pulse pointer-events-none opacity-50"></span>
              )}
            </div>

            {/* Conditional Rendering for Keyboard & Start Button */}
            {showKeyboard && (
              <div className="w-full animate-in fade-in slide-in-from-top-4 duration-300">
                {/* Custom On-Screen Keyboard */}
                <div className="w-full flex flex-col gap-2 mb-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/50">
                  {keyboardRows.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex justify-center gap-2 w-full">
                      {row.map((key) => {
                        const isDel = key === 'DEL';
                        return (
                          <button
                            key={key}
                            onMouseDown={(e) => e.preventDefault()} // Keeps focus on input so selection isn't lost
                            onClick={() => handleKeyPress(key)}
                            className={`
                              ${isDel ? 'px-4 bg-red-900/40 hover:bg-red-800/60 text-red-300 border-red-900' : 'flex-1 max-w-[65px] bg-slate-700 hover:bg-slate-600 text-white border-slate-800'}
                              py-3 active:scale-95 active:bg-emerald-500 active:text-slate-900 transition-all
                              text-2xl font-bold rounded-xl shadow-lg border-b-4 select-none
                            `}
                          >
                            {isDel ? <Delete className="w-8 h-8 mx-auto" /> : key}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {/* Spacebar Row */}
                  <div className="flex justify-center gap-2 w-full">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleKeyPress('SPACE')}
                      className="w-2/3 py-3 bg-slate-700 hover:bg-slate-600 active:scale-95 active:bg-emerald-500 active:text-slate-900 transition-all text-2xl font-bold text-slate-400 rounded-xl shadow-lg border-b-4 border-slate-800 select-none uppercase tracking-widest"
                    >
                      Space
                    </button>
                  </div>
                </div>

                <button 
                  onClick={initializeGame}
                  disabled={!playerName.trim()}
                  className={`w-full text-3xl font-bold py-5 rounded-2xl flex items-center justify-center transition-all ${
                    playerName.trim() 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-900 shadow-[0_0_30px_rgba(16,185,129,0.4)]' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="mr-4 w-8 h-8" fill="currentColor" />
                  START GAME
                </button>
              </div>
            )}
          </div>

          {/* Mini Leaderboard on Cover */}
          <div className="w-full max-w-4xl text-center">
            <h3 className="text-xl font-bold text-slate-400 mb-3 flex items-center justify-center">
              <Trophy className="mr-3 w-5 h-5" /> Top 5 Memory Masters
            </h3>
            <div className="flex justify-center gap-4 flex-wrap mt-4">
              {leaderboard.length === 0 ? (
                <p className="text-slate-500 italic text-lg">No scores yet. Be the first to play!</p>
              ) : (
                leaderboard.slice(0, 5).map((player, idx) => (
                  <div 
                    key={player.id} 
                    className={`relative px-4 py-2 rounded-xl border-2 flex items-center text-base transition-all ${
                      idx === 0 ? 'bg-yellow-900/40 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)] scale-110 mx-2' :
                      idx === 1 ? 'bg-slate-700/80 border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.3)] scale-105 mx-2' :
                      idx === 2 ? 'bg-amber-900/50 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-105 mx-2' :
                      'bg-slate-800 border-slate-700'
                    }`}
                  >
                    {/* Top 3 Crowns */}
                    {idx < 3 && (
                      <div className={`absolute -top-4 -left-4 bg-slate-900 rounded-full p-1 shadow-lg border-2 z-10 ${
                        idx === 0 ? 'border-yellow-400' : 
                        idx === 1 ? 'border-slate-300' : 
                        'border-amber-500'
                      }`}>
                        <Crown className={`w-4 h-4 ${
                          idx === 0 ? 'text-yellow-400' : 
                          idx === 1 ? 'text-slate-200' : 
                          'text-amber-500'
                        }`} fill="currentColor" />
                      </div>
                    )}
                    
                    {/* Rank Number */}
                    <span className={`font-black mr-2 ${
                      idx === 0 ? 'text-yellow-400' :
                      idx === 1 ? 'text-slate-300' :
                      idx === 2 ? 'text-amber-500' :
                      'text-emerald-400'
                    }`}>#{idx + 1}</span>
                    
                    {/* Player Name */}
                    <span className="text-slate-100 mr-3 font-bold truncate max-w-[100px]">{player.name}</span>
                    
                    {/* Score */}
                    <span className="font-black text-white text-xl">{player.score}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'playing') {
      return (
        <div className="w-full h-full bg-slate-900 text-white flex flex-col p-8 font-sans">
          {/* Game Header */}
          <div className="flex justify-between items-center bg-slate-800 p-6 rounded-3xl mb-6 shadow-lg border border-slate-700">
            <div className="flex flex-col">
              <span className="text-slate-400 text-xl font-medium">Player</span>
              <span className="text-3xl font-bold text-emerald-400">{playerName || 'Guest'}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-slate-400 text-xl font-medium">Time Left</span>
              <div className={`text-6xl font-black flex items-center ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                <Timer className="mr-3 w-10 h-10" />
                0{Math.floor(timeLeft / 60)}:{timeLeft % 60 < 10 ? `0${timeLeft % 60}` : timeLeft % 60}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-slate-400 text-xl font-medium">Score</span>
              <span className="text-5xl font-black text-cyan-400">{score}</span>
            </div>
          </div>

          {/* Game Grid (4 rows, 5 columns for landscape) */}
          <div className="flex-1 grid grid-cols-5 grid-rows-4 gap-4 md:gap-6 pb-4">
            {cards.map((card, index) => {
              const isFlipped = flippedIndices.includes(index) || matchedIndices.includes(index);
              const isMatched = matchedIndices.includes(index);
              
              return (
                <div 
                  key={card.id}
                  onClick={() => handleCardClick(index)}
                  className="relative cursor-pointer group perspective-1000"
                  style={{ perspective: '1000px' }}
                >
                  <div 
                    className={`w-full h-full duration-500 transition-all relative rounded-2xl shadow-lg border-2 ${
                      isFlipped ? 'border-emerald-400/60' : 'border-emerald-500/30 hover:border-emerald-400/60'
                    } ${isMatched ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : ''}`}
                    style={{ 
                      transformStyle: 'preserve-3d',
                      WebkitTransformStyle: 'preserve-3d',
                      transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                    }}
                  >
                    {/* Front of Card (Cover) */}
                    <div 
                      className="absolute inset-0 w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl flex items-center justify-center border-2 border-slate-600 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                      style={{ 
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        opacity: isFlipped ? 0 : 1,
                        transition: 'opacity 0s linear 0.25s'
                      }}
                    >
                      <span className="text-4xl font-black text-emerald-500/20">EXW</span>
                    </div>

                    {/* Back of Card (Product Image/Icon) */}
                    <div 
                      className="absolute inset-0 w-full h-full bg-slate-100 rounded-xl flex items-center justify-center"
                      style={{ 
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        opacity: isFlipped ? 1 : 0,
                        transition: 'opacity 0s linear 0.25s'
                      }}
                    >
                      {/* Placeholder: Replace with actual image tag later, e.g., <img src={card.imgUrl} className="object-contain p-4" /> */}
                      <card.Icon className={`w-2/3 h-2/3 ${isMatched ? 'text-cyan-600' : 'text-emerald-700'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (currentView === 'score_reveal') {
      return (
        <div className="w-full h-full bg-slate-900 text-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-500 font-sans">
          <h2 className="text-7xl font-black text-white mb-8 tracking-wider uppercase">Time's Up!</h2>
          <div className="bg-slate-800 p-16 rounded-[3rem] border-4 border-emerald-500 shadow-[0_0_100px_rgba(16,185,129,0.3)] flex flex-col items-center transform scale-110 transition-transform">
            <p className="text-4xl text-slate-300 mb-4">Final Score</p>
            <p className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-cyan-500">
              {score}
            </p>
          </div>
        </div>
      );
    }

    if (currentView === 'leaderboard') {
      // Determine the top 5
      const top5 = leaderboard.slice(0, 5);
      // Check if current player is in top 5
      const playerRankIndex = leaderboard.findIndex(p => p.id === currentPlayerResult.id);
      const isInTop5 = playerRankIndex < 5;

      return (
        <div className="w-full h-full bg-slate-900 text-white flex flex-col items-center justify-center py-8 px-8 font-sans">
          <div className="flex items-center justify-center mb-8">
            <Trophy className="w-16 h-16 text-yellow-400 mr-6" />
            <h1 className="text-6xl font-black text-white uppercase tracking-widest">Hall of Fame</h1>
            <Trophy className="w-16 h-16 text-yellow-400 ml-6" />
          </div>

          <div className="w-full max-w-4xl bg-slate-800 rounded-[2.5rem] p-8 shadow-2xl border border-slate-700 flex-1 flex flex-col relative overflow-hidden">
            
            <div className="flex-1 flex flex-col justify-center gap-4">
              {/* Render Top 5 */}
              {top5.map((player, index) => {
                const isCurrentPlayer = player.id === currentPlayerResult.id;
                const isTop3 = index < 3;
                
                return (
                  <div 
                    key={player.id} 
                    className={`flex items-center justify-between p-6 rounded-2xl border-2 transition-all duration-700 ${
                      isCurrentPlayer 
                        ? 'bg-emerald-900/40 border-emerald-400 scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)] z-10' 
                        : 'bg-slate-800 border-slate-700'
                    }`}
                  >
                    <div className="flex items-center">
                      {/* Rank Number & Crown */}
                      <div className="w-20 flex justify-center items-center">
                        {isTop3 ? (
                          <Crown className={`w-12 h-12 ${
                            index === 0 ? 'text-yellow-400' : 
                            index === 1 ? 'text-slate-300' : 
                            'text-amber-600'
                          }`} fill="currentColor" />
                        ) : (
                          <span className="text-4xl font-bold text-slate-500">#{index + 1}</span>
                        )}
                      </div>
                      
                      <span className={`text-4xl ml-6 font-bold ${isCurrentPlayer ? 'text-white' : 'text-slate-200'}`}>
                        {player.name}
                      </span>
                      {isCurrentPlayer && <span className="ml-4 px-3 py-1 bg-emerald-500 text-xs font-bold rounded-full text-slate-900 uppercase tracking-wider animate-pulse">You</span>}
                    </div>
                    
                    <div className={`text-5xl font-black ${isCurrentPlayer ? 'text-emerald-400' : 'text-cyan-400'}`}>
                      {player.score}
                    </div>
                  </div>
                );
              })}

              {/* If player is NOT in top 5, append them at the bottom */}
              {!isInTop5 && (
                <>
                  <div className="w-full h-px bg-slate-700 my-2"></div>
                  <div className="flex items-center justify-between p-6 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 opacity-80">
                    <div className="flex items-center">
                      <div className="w-20 flex justify-center items-center">
                        <span className="text-3xl font-bold text-slate-500">#{playerRankIndex + 1}</span>
                      </div>
                      <span className="text-3xl ml-6 font-bold text-slate-400">
                        {currentPlayerResult.name}
                      </span>
                      <span className="ml-4 px-3 py-1 bg-slate-600 text-xs font-bold rounded-full text-slate-300 uppercase tracking-wider">You</span>
                    </div>
                    <div className="text-4xl font-black text-slate-400">
                      {currentPlayerResult.score}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-10 w-full max-w-4xl">
            <button 
              onClick={resetToCover}
              className="w-full py-8 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 rounded-2xl text-3xl font-bold text-white transition-all shadow-lg flex items-center justify-center"
            >
              <Play className="mr-3 w-8 h-8" />
              PLAY AGAIN / NEXT PLAYER
            </button>
          </div>

        </div>
      );
    }

    return null;
  };

  // --- Main Layout Wrapper ---
  return (
    <div 
      className="flex items-center justify-center w-full h-screen bg-black overflow-hidden relative"
      onClick={requestFullScreen}
    >
      {/* Fullscreen Toggle Button */}
      <button 
        onClick={toggleFullScreen}
        className="absolute top-6 right-6 z-50 p-3 text-slate-500 hover:text-emerald-400 bg-slate-800/50 hover:bg-slate-700 rounded-full transition-all shadow-lg border border-slate-700"
        title={isFullscreen ? "Exit Fullscreen (ESC)" : "Enter Fullscreen"}
      >
        {isFullscreen ? <Minimize className="w-8 h-8" /> : <Maximize className="w-8 h-8" />}
      </button>

      {/* This is the "Kiosk Scaler" box! 
        It forces the canvas to strictly be 1920x1080 to match your 55" screen,
        but dynamically shrinks down via CSS transform so you can view the entire UI
        without scrolling on smaller computers/laptops.
      */}
      <div 
        className="relative shadow-2xl overflow-hidden bg-slate-900"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          transformOrigin: 'center'
        }}
      >
        {renderCurrentView()}
      </div>
    </div>
  );
}