import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Crown, Play, Timer, User, Maximize, Minimize
} from 'lucide-react';

// --- Configuration & Mock Data ---
const GAME_TIME = 30; 
const POINTS_PER_MATCH = 10;

const PRODUCT_IMAGES = [
  './card-image/3 sec lc patch cord.png',
  './card-image/3Y plug.png',
  './card-image/5 angle toolless plug.png',
  './card-image/cable clamp toolless ksj.png',
  './card-image/fiber front sliding panel.png',
  './card-image/lgx panel.png',
  './card-image/bendable patch cord.png',
  './card-image/multi entry toolless ksj.png',
  './card-image/angled empty panel.png',
  './card-image/c6 patch panel.png'
];

const initialLeaderboard = [
  { id: 'test-1', name: 'Y4', score: 100, timestamp: Date.now() - 400000 },
  { id: 'test-2', name: 'Y2', score: 60, timestamp: Date.now() - 300000 },
  { id: 'test-3', name: 'Y3', score: 50, timestamp: Date.now() - 200000 },
  { id: 'test-4', name: 'Yen', score: 20, timestamp: Date.now() - 100000 },
  { id: 'test-5', name: 'Guest', score: 10, timestamp: Date.now() - 50000 },
];

export default function App() {
  const [currentView, setCurrentView] = useState('cover');
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  
  const [bgFailed, setBgFailed] = useState(false);

  // Game State
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPlayerResult, setCurrentPlayerResult] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
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
    e.stopPropagation();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setScale(Math.min(scaleX, scaleY));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNameChange = (e) => {
    const input = e.target;
    const start = input.selectionStart;
    const val = input.value;

    if (val.length <= 15) {
      const formatted = val.split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
      setPlayerName(formatted);
      
      setTimeout(() => {
        if (input) input.setSelectionRange(start, start);
      }, 0);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && playerName.trim()) {
      initializeGame();
    }
  };

  const initializeGame = () => {
    const deck = [...PRODUCT_IMAGES, ...PRODUCT_IMAGES]
      .map((imagePath, index) => ({ id: index, imagePath }))
      .sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlippedIndices([]);
    setMatchedIndices([]);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setCurrentView('playing');
  };

  useEffect(() => {
    let timer;
    if (currentView === 'playing' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (currentView === 'playing' && timeLeft === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [currentView, timeLeft]);

  const handleCardClick = (index) => {
    if (isProcessing || flippedIndices.includes(index) || matchedIndices.includes(index)) return;
    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);
    if (newFlipped.length === 2) {
      setIsProcessing(true);
      if (cards[newFlipped[0]].imagePath === cards[newFlipped[1]].imagePath) {
        setMatchedIndices(prev => [...prev, ...newFlipped]);
        setScore(prev => prev + POINTS_PER_MATCH);
        setFlippedIndices([]);
        setIsProcessing(false);
      } else {
        setTimeout(() => {
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 500);
      }
    }
  };

  const endGame = () => {
    setCurrentView('score_reveal');
    const newResult = { id: Date.now().toString(), name: playerName || 'Guest', score, timestamp: Date.now() };
    setCurrentPlayerResult(newResult);
    setLeaderboard(prev => [...prev, newResult].sort((a, b) => b.score !== a.score ? b.score - a.score : b.timestamp - a.timestamp));
    setTimeout(() => setCurrentView('leaderboard'), 2000);
  };

  const resetToCover = () => {
    setPlayerName('');
    setCurrentView('cover');
  };

  const renderPlayerRow = (player, index, isCurrentPlayer, isRankedTop5, isCoverView = false) => {
    let rowBgClass = '';
    
    const isHighContrastRow = isCurrentPlayer && isRankedTop5 && index >= 3 && !isCoverView;
    
    if (isCoverView) {
      rowBgClass = index < 3
        ? 'bg-[#F59E0B]/85 backdrop-blur-xl border border-amber-300/80 shadow-[0_8px_25px_rgba(245,158,11,0.4)] rounded-[1.5rem]'
        : 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[1.5rem]';
    } else {
      if (isCurrentPlayer) {
        if (index < 3) {
          rowBgClass = 'bg-yellow-500/50 backdrop-blur-xl border-2 border-yellow-300 shadow-[0_0_35px_rgba(250,204,21,0.9),inset_0_0_20px_rgba(255,255,255,0.5)] transform scale-110 z-30 rounded-3xl';
        } else if (isRankedTop5) {
          rowBgClass = 'bg-white/20 backdrop-blur-xl border-2 border-white shadow-[0_0_30px_rgba(255,255,255,0.8),inset_0_0_20px_rgba(255,255,255,0.5)] transform scale-[1.05] z-30 rounded-3xl';
        } else {
          rowBgClass = 'bg-emerald-500/50 backdrop-blur-xl border-2 border-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.8),inset_0_0_20px_rgba(255,255,255,0.3)] transform scale-[1.02] z-30 rounded-3xl';
        }
      } else {
        if (index < 3) {
          rowBgClass = 'bg-[#F59E0B]/90 backdrop-blur-xl border border-[#F59E0B] shadow-[inset_0_0_20px_rgba(255,255,255,0.2),0_10px_30px_rgba(245,158,11,0.3)] transform scale-105 z-10 rounded-3xl';
        } else {
          rowBgClass = 'bg-black/20 backdrop-blur-md border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-3xl';
        }
      }
    }

    return (
      <div 
        key={player.id} 
        className={`relative px-8 py-5 flex items-center justify-between transition-all duration-500 ${rowBgClass}`}
      >
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] flex items-center justify-center ${
            isCoverView 
              ? 'bg-black/10 border border-white/20' 
              : isHighContrastRow 
                ? 'bg-slate-800/20 border border-white/40' 
                : 'bg-black/10 border border-white/10' 
          }`}>
            {index < 3 ? (
              <Crown className={`w-8 h-8 ${
                index === 0 ? 'text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.9)]' : 
                index === 1 ? 'text-[#E3E4E5] drop-shadow-[0_0_12px_rgba(227,228,229,0.9)]' : 
                'text-[#8B4513] drop-shadow-[0_0_12px_rgba(139,69,19,0.9)]'
              }`} fill="currentColor" />
            ) : (
              <span className={`text-2xl font-black ${isHighContrastRow ? 'text-white drop-shadow-md' : 'text-white/50'}`}>{index + 1}</span>
            )}
          </div>
          <span className={`text-4xl font-bold tracking-wide ${isHighContrastRow ? 'text-slate-800 drop-shadow-sm' : 'text-white drop-shadow-md'}`}>
            {player.name}
          </span>
        </div>
        <div className="flex flex-col items-end">
           <span className={`text-5xl font-black ${isHighContrastRow ? 'text-slate-800 drop-shadow-sm' : 'text-white drop-shadow-lg'}`}>
             {player.score}
           </span>
           <span className={`text-xs font-bold uppercase tracking-widest ${index < 3 ? 'text-white/80' : (isHighContrastRow ? 'text-slate-600' : 'text-white/50')}`}>
             Points
           </span>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    if (currentView === 'cover') {
      return (
        <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-white">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-white to-[#E0E0E0]">
            {!bgFailed && (
              <img src="./bg.png" onError={() => setBgFailed(true)} className="w-full h-full object-cover mix-blend-multiply opacity-100" alt="Background" />
            )}
          </div>

          <div className="w-[1780px] h-[960px] relative z-10 flex flex-row items-center justify-center gap-24">
            <div className="flex-1 max-w-[950px] flex flex-col items-center justify-center h-full">
              <div className="mb-16 flex flex-col items-center w-full">
                <h1 
                  className="text-[7.5rem] uppercase text-center leading-[1.1] drop-shadow-2xl mb-2 whitespace-nowrap" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#0099D0',
                    textShadow: '2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white, 0px 2px 0 white, 0px -2px 0 white, 2px 0px 0 white, -2px 0px 0 white',
                    wordSpacing: '10px'   
                  }}
                >
                  REACH TOP 3,
                </h1>
                <h1 
                  className="text-[7.5rem] uppercase text-center leading-[1.1] drop-shadow-2xl mb-6 whitespace-nowrap" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#0099D0',
                    textShadow: '2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white, 0px 2px 0 white, 0px -2px 0 white, 2px 0px 0 white, -2px 0px 0 white',
                    wordSpacing: '10px'   
                  }}
                >
                  WIN A PRIZE!
                </h1>
                <h2 
                  className="text-[2.75rem] text-center tracking-[0.15em] uppercase drop-shadow-lg whitespace-nowrap" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#007BA8',
                    textShadow: '2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white, 0px 2px 0 white, 0px -2px 0 white, 2px 0px 0 white, -2px 0px 0 white',
                    wordSpacing: '10px'   
                  }}
                >
                  30 Second Memory Challenge
                </h2>
              </div>

              <div className="w-full max-w-xl bg-slate-800/30 backdrop-blur-2xl border border-white/30 border-t-white/50 border-l-white/50 p-8 rounded-[2.5rem] shadow-[0_15px_30px_rgba(0,0,0,0.2),inset_0_0_15px_rgba(255,255,255,0.1)] flex flex-col items-center relative overflow-hidden">
                <label className="text-2xl mb-8 font-bold flex items-center text-white drop-shadow-md uppercase tracking-widest text-center">
                  <User className="mr-4 w-8 h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
                  Enter Your Name to Play
                </label>
                
                <div className="w-full relative">
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Player Name"
                    className="w-full text-3xl p-6 rounded-2xl bg-white/20 border border-white/40 shadow-[0_4px_10px_rgba(0,0,0,0.1),inset_0_2px_15px_rgba(255,255,255,0.3)] text-white text-center focus:outline-none focus:bg-white/30 focus:border-white/60 focus:ring-2 focus:ring-white/50 transition-all placeholder-white/70 font-bold backdrop-blur-xl"
                    maxLength={15}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <button 
                  onClick={initializeGame}
                  disabled={!playerName.trim()}
                  className={`w-full text-4xl font-black py-6 mt-10 rounded-2xl flex items-center justify-center transition-all duration-300 uppercase tracking-widest ${
                    playerName.trim() 
                      ? 'bg-[#22d3ee] border-none shadow-[0_10px_30px_rgba(34,211,238,0.5)] text-white scale-105 hover:bg-[#22d3ee] hover:shadow-[0_0_45px_rgba(34,211,238,0.9)]' 
                      : 'bg-white/5 border border-white/10 backdrop-blur-sm text-white/30 shadow-none cursor-not-allowed'
                  }`}
                >
                  <Play className="mr-6 w-10 h-10" fill="currentColor" />
                  30s Go!
                </button>
              </div>
            </div>

            <div className="w-[650px] flex flex-col justify-center bg-white/10 backdrop-blur-2xl border border-white/30 border-t-white/50 border-l-white/50 rounded-[3rem] p-12 shadow-[0_15px_40px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.1)] relative">
              <h3 
                className="text-[3.5rem] w-full text-center mt-4 font-black text-slate-800 mb-12 flex items-center justify-center uppercase tracking-widest relative z-10 drop-shadow-md whitespace-nowrap"
                style={{ fontFamily: "'Train One', sans-serif" }}
              >
                Top 5 Masters
              </h3>
              
              <div className="flex flex-col gap-6 w-full relative z-10">
                {leaderboard.slice(0, 5).map((player, idx) => renderPlayerRow(player, idx, false, true, true))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'playing') {
      return (
        <div className="w-full h-full text-white flex flex-col p-12 font-sans relative overflow-hidden bg-[#0a0f1e]">
          <div className="absolute inset-0 z-0">
             <img src="./bg-2.png" className="w-full h-full object-cover" alt="Game Background" />
          </div>
          
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-600/10 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none z-0" />
          
          <div className="h-36 bg-white/20 backdrop-blur-[60px] border-2 border-white/50 rounded-[3rem] mb-12 shadow-[0_20px_50px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.4)] relative z-10 w-full flex">
            <div className="absolute left-10 top-1/2 -translate-y-1/2 flex items-center gap-6">
              <div className="flex flex-col ml-4">
                <span className="text-slate-500 text-lg font-bold uppercase tracking-widest text-left">Player</span>
                <span className="text-4xl font-black text-slate-800 text-left">{playerName || 'Guest'}</span>
              </div>
            </div>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <span className="text-slate-500 text-lg font-bold uppercase tracking-widest mb-1 text-center">Time Remaining</span>
              <div className={`text-7xl font-black flex items-center ${timeLeft <= 10 ? 'text-red-500 animate-pulse drop-shadow-md' : 'text-slate-800'}`}>
                <Timer className="mr-4 w-12 h-12" />
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="absolute right-10 top-1/2 -translate-y-1/2 flex flex-col items-end mr-4">
              <span className="text-slate-500 text-lg font-bold uppercase tracking-widest text-right">Score</span>
              <span className="text-6xl font-black text-cyan-400 text-right">
                {score}
              </span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-5 grid-rows-4 gap-6 pb-6 relative z-10">
            {cards.map((card, index) => {
              const isFlipped = flippedIndices.includes(index) || matchedIndices.includes(index);
              const isMatched = matchedIndices.includes(index);
              return (
                <div key={card.id} onClick={() => handleCardClick(index)} className="relative cursor-pointer perspective-1000 group">
                  <div 
                    className={`w-full h-full duration-500 transition-all relative rounded-3xl shadow-xl border-2 ${
                      isMatched 
                        ? 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.8)] bg-yellow-900/20' 
                        : isFlipped 
                          ? 'border-green-400/80' 
                          : 'border-white/10 hover:border-green-400/80 hover:bg-green-500/10'
                    }`}
                    style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                  >
                    <div className="absolute inset-0 w-full h-full rounded-[1.4rem] overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                      <img src="./card-image/exw card.png" alt="Card Back" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    </div>
                    <div className="absolute inset-0 w-full h-full bg-white rounded-[1.4rem] flex items-center justify-center shadow-2xl" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <img src={card.imagePath} alt="Product Card" className={`w-3/4 h-3/4 object-contain transition-all duration-300 ${isMatched ? 'scale-110' : ''}`} />
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
        <div className="w-full h-full text-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-700 relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img src="./bg-3.png" className="w-full h-full object-cover blur-[2px]" alt="Score Background" />
          </div>
          <div className="relative z-10 flex flex-col items-center -translate-y-8">
            <h2 className="text-9xl font-black text-white mb-24 tracking-widest uppercase italic drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-center">Times Up!</h2>
            <div className="bg-[#e0e0e0] p-24 rounded-[4rem] shadow-[20px_20px_60px_#bebebe,-20px_-20px_60px_#ffffff,inset_0_0_15px_rgba(0,0,0,0.02),0_4px_10px_rgba(0,0,0,0.1)] border border-white/20 flex flex-col items-center transform scale-125">
              <p className="text-4xl text-slate-600 mb-6 font-bold uppercase tracking-widest text-center -mt-8">Your Score</p>
              <p className="text-[12rem] font-black text-black leading-none text-center">{score}</p>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'leaderboard') {
      const top5 = leaderboard.slice(0, 5);
      const playerRankIndex = currentPlayerResult ? leaderboard.findIndex(p => p.id === currentPlayerResult.id) : -1;
      const isInTop5 = playerRankIndex >= 0 && playerRankIndex < 5;

      return (
        <div className="w-full h-full flex flex-col items-center justify-center py-12 px-16 font-sans relative overflow-hidden">
          <div className="absolute inset-0 z-0 bg-white">
             <img src="./bg-4.png" className="w-full h-full object-cover" alt="Leaderboard Background" />
          </div>

          <div className="w-[1000px] flex flex-col justify-center bg-white/20 backdrop-blur-[60px] border-2 border-white/50 rounded-[4rem] p-16 shadow-[0_20px_50px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.4)] relative z-10">
            <h3 
              className="text-6xl font-bold text-white mb-12 flex items-center justify-center uppercase tracking-[0.1em] relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              style={{ fontFamily: "'Train One', sans-serif" }}
            >
              Top 5 Masters
            </h3>
            
            <div className="flex flex-col gap-5 w-full relative z-10">
              {top5.map((player, idx) => {
                const isMe = currentPlayerResult && player.id === currentPlayerResult.id;
                return renderPlayerRow(player, idx, isMe, true, false);
              })}

              {!isInTop5 && currentPlayerResult && (
                <>
                  <div className="h-px bg-white/40 w-full my-6" />
                  {renderPlayerRow({ ...currentPlayerResult, rank: playerRankIndex + 1 }, playerRankIndex, true, false, false)}
                </>
              )}
            </div>
          </div>

          <div className="absolute bottom-8 right-8 z-10">
            <button 
              onClick={resetToCover}
              className="px-6 py-3 bg-orange-500/90 hover:bg-orange-400 border-2 border-orange-300 rounded-[1rem] text-xl font-bold text-white transition-all shadow-[0_8px_15px_rgba(249,115,22,0.4)] flex items-center justify-center uppercase tracking-wider active:scale-95"
            >
              <Play className="mr-2 w-5 h-5" fill="currentColor" />
              Rematch!
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex items-center justify-center w-full h-screen bg-black overflow-hidden relative" onClick={requestFullScreen} style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bungee+Inline&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Train+One&display=swap');
      `}</style>
      {!isFullscreen && (
        <button onClick={toggleFullScreen} className="absolute top-10 right-10 z-[100] p-4 text-white/40 hover:text-emerald-400 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full transition-all shadow-2xl border border-white/10">
          <Maximize className="w-10 h-10" />
        </button>
      )}
      <div className="relative shadow-2xl overflow-hidden bg-[#0a0f1e]" style={{ width: '1920px', height: '1080px', transform: `scale(${scale})`, transformOrigin: 'center' }}>
        {renderCurrentView()}
      </div>
    </div>
  );
}