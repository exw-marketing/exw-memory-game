import React, { useState, useEffect, useRef } from 'react';
import { 
  Trophy, Crown, Play, Timer, User, Maximize, Minimize
} from 'lucide-react';

// --- Cloud Database (Firebase) Setup ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

let app, auth, db;
let appId = 'default-app-id';

// Replace the entire try/catch block with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAxDqxVtZJxUx8TlCCXhQgNqfTbs8XePBc",
  authDomain: "exw-memory-game.firebaseapp.com",
  projectId: "exw-memory-game",
  storageBucket: "exw-memory-game.firebasestorage.app",
  messagingSenderId: "192558533697",
  appId: "1:192558533697:web:890c8f28c170146f550ac0",
  measurementId: "G-3R581H4H63"
};

app = initializeApp(firebaseConfig);
auth = getAuth(app);
db = getFirestore(app);
appId = 'exw-memory-game-live'; // Give your app a unique ID

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

export default function App() {
  const [currentView, setCurrentView] = useState('cover');
  const [playerName, setPlayerName] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [user, setUser] = useState(null);
  
  const [bgFailed, setBgFailed] = useState(false);

  // Game State
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedIndices, setMatchedIndices] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [scorePhase, setScorePhase] = useState('timesUp');
  const [currentPlayerResult, setCurrentPlayerResult] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const sequenceTimeouts = useRef([]);

  // --- Cloud Database Authentication & Syncing ---
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Auth Error: Did you enable Anonymous Sign-in in the console?", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // FETCH LEADERBOARD (Modified to ALWAYS fetch, even if user auth is delayed)
  useEffect(() => {
    if (!db) return; 
    
    const q = collection(db, 'leaderboard');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      
      // Sort Rule: Highest Score First. If tied, Most Recent Start Time First!
      data.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.startTime - a.startTime; 
      });
      
      setLeaderboard(data);
    }, (error) => {
      console.error("Error fetching leaderboard. Check your Firestore Rules:", error);
    });
    
    return () => unsubscribe();
  }, []);

  // --- Window Resizing & Fullscreen ---
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

  // --- Input & Navigation ---
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

  const showRules = () => {
    setCurrentView('rules');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && playerName.trim()) {
      if (currentView === 'cover') {
        showRules();
      }
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter' && currentView === 'rules') {
        initializeGame();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentView]);

  const clearSequenceTimeouts = () => {
    sequenceTimeouts.current.forEach(clearTimeout);
    sequenceTimeouts.current = [];
  };

  // --- Core Game Logic ---
  const initializeGame = () => {
    clearSequenceTimeouts();
    const deck = [...PRODUCT_IMAGES, ...PRODUCT_IMAGES]
      .map((imagePath, index) => ({ id: index, imagePath }))
      .sort(() => Math.random() - 0.5);
    setCards(deck);
    setFlippedIndices([]);
    setMatchedIndices([]);
    setScore(0);
    setTimeLeft(GAME_TIME);
    setIsPreviewing(true);
    setScorePhase('timesUp'); 
    setGameStartTime(Date.now()); 
    setCurrentView('playing');
  };

  useEffect(() => {
    let previewTimer;
    if (currentView === 'playing' && isPreviewing) {
      previewTimer = setTimeout(() => {
        setIsPreviewing(false);
      }, 3000);
    }
    return () => clearTimeout(previewTimer);
  }, [currentView, isPreviewing]);

  useEffect(() => {
    let timer;
    if (currentView === 'playing' && !isPreviewing && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (currentView === 'playing' && !isPreviewing && timeLeft === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [currentView, timeLeft, isPreviewing]);

  const handleCardClick = (index) => {
    if (isProcessing || isPreviewing || flippedIndices.includes(index) || matchedIndices.includes(index)) return;
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
        // Reduced timeout to 300ms to allow faster gameplay
        setTimeout(() => {
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 300);
      }
    }
  };

  const endGame = async () => {
    clearSequenceTimeouts();
    setScorePhase('timesUp');
    setCurrentView('score_reveal');
    
    // Package the results to save
    const newResult = { 
      id: (user?.uid || 'guest-' + Math.random().toString(36).substr(2, 9)) + '-' + Date.now(), 
      userId: user?.uid || 'guest',
      name: playerName || 'Guest', 
      score: score, 
      startTime: gameStartTime || Date.now() 
    };
    
    setCurrentPlayerResult(newResult);

    // Save to Cloud Database (Modified to ALWAYS attempt to save if DB exists)
    if (db) {
      try {
        const docRef = doc(db, 'leaderboard', newResult.id);
        await setDoc(docRef, newResult);
        console.log("Successfully saved score to Firebase!");
      } catch (err) {
        console.error("Firebase Save Error! Are Anonymous Sign-in AND Firestore Rules set correctly? Error:", err);
        // Fallback so the user at least sees their score locally for this session
        setLeaderboard(prev => {
          const updated = [...prev, newResult];
          updated.sort((a, b) => b.score !== a.score ? b.score - a.score : b.startTime - a.startTime);
          return updated;
        });
      }
    }
    
    // UI Transitions
    const t1 = setTimeout(() => setScorePhase('fadeTimesUp'), 2000); 
    const t2 = setTimeout(() => setScorePhase('score'), 2500); 
    const t3 = setTimeout(() => setCurrentView('leaderboard'), 7500); 

    sequenceTimeouts.current = [t1, t2, t3];
  };

  const resetToCover = () => {
    setPlayerName('');
    clearSequenceTimeouts();
    setScorePhase('timesUp'); 
    setCurrentView('cover');
  };

  // Ensure we always have 5 rows to display, padding with empty slots if needed
  const getPaddedTop5 = () => {
    const top5 = [];
    for (let i = 0; i < 5; i++) {
      if (leaderboard[i]) {
        top5.push(leaderboard[i]);
      } else {
        top5.push({ id: `empty-${i}`, name: '---', score: 0 });
      }
    }
    return top5;
  };

  const renderPlayerRow = (player, index, isCurrentPlayer, isRankedTop5, isCoverView = false) => {
    let rowBgClass = '';
    const isEmptyPlaceholder = player.name === '---';
    
    if (isCoverView) {
      rowBgClass = index < 3
        ? 'bg-[#F59E0B] shadow-[0_8px_25px_rgba(245,158,11,0.3)] rounded-[1.25rem]'
        : 'bg-white/30 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-[1.25rem]';
    } else {
      if (isCurrentPlayer) {
        if (index < 3) {
          // TARGET VISUAL MATCH from image_4f742f.jpg
          rowBgClass = 'bg-yellow-500/50 backdrop-blur-xl border-2 border-yellow-300 shadow-[0_0_35px_rgba(250,204,21,0.9),inset_0_0_20px_rgba(255,255,255,0.5)] transform scale-110 z-30 rounded-3xl';
        } else if (isRankedTop5) {
          // Standard highlight for 4th/5th place
          rowBgClass = 'bg-white/10 backdrop-blur-xl border-2 border-white shadow-[0_0_25px_rgba(255,255,255,0.4)] transform scale-105 z-30 rounded-3xl';
        } else {
          // TARGET VISUAL MATCH from image_4e7850.jpg (Current player NOT in top 5)
          rowBgClass = 'bg-emerald-500/50 backdrop-blur-xl border-2 border-emerald-300 shadow-[0_0_30px_rgba(52,211,153,0.8),inset_0_0_20px_rgba(255,255,255,0.3)] transform scale-[1.02] z-30 rounded-3xl';
        }
      } else {
        if (index < 3) {
          // Standard solid orange for Top 3 Masters
          rowBgClass = 'bg-[#F59E0B] shadow-[0_8px_25px_rgba(245,158,11,0.3)] rounded-3xl';
        } else {
          // Standard glassy white for 4th/5th place
          rowBgClass = 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-3xl';
        }
      }
    }

    return (
      <div 
        key={player.id} 
        className={`relative px-4 xl:px-6 2xl:px-8 py-3 2xl:py-5 flex items-center justify-between transition-all duration-500 ${rowBgClass} ${isEmptyPlaceholder ? 'opacity-50' : 'opacity-100'}`}
      >
        <div className="flex items-center gap-3 xl:gap-4 2xl:gap-6">
          <div className={`w-10 h-10 xl:w-12 xl:h-12 2xl:w-16 2xl:h-16 rounded-xl 2xl:rounded-2xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.2)] flex items-center justify-center shrink-0 ${
            isCoverView 
              ? 'bg-black/10 border border-white/20' 
              : 'bg-black/20 border border-white/10'
          }`}>
            {index < 3 ? (
              <Crown className={`w-5 h-5 xl:w-6 xl:h-6 2xl:w-8 2xl:h-8 ${
                index === 0 ? 'text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.9)]' : 
                index === 1 ? 'text-[#E3E4E5] drop-shadow-[0_0_12px_rgba(227,228,229,0.9)]' : 
                'text-[#8B4513] drop-shadow-[0_0_12px_rgba(139,69,19,0.9)]'
              }`} fill="currentColor" />
            ) : (
              <span className={`text-lg xl:text-xl 2xl:text-2xl font-black ${index >= 3 ? 'text-white' : 'text-white/70'}`}>{index + 1}</span>
            )}
          </div>
          <span 
            className="text-xl xl:text-2xl 2xl:text-4xl font-bold tracking-wide truncate text-white drop-shadow-md"
            style={index >= 3 ? { WebkitTextStroke: '0.8px rgba(229, 231, 235, 0.4)' } : {}}
          >
            {player.name}
          </span>
        </div>
        <div className="flex flex-col items-end pl-2">
           <span className="text-2xl xl:text-3xl 2xl:text-5xl font-black text-white drop-shadow-lg">
             {player.score}
           </span>
           <span className={`text-[10px] 2xl:text-xs font-black uppercase tracking-widest text-white drop-shadow-lg ${index < 3 ? 'opacity-90' : 'opacity-100'}`}>
             Points
           </span>
        </div>
      </div>
    );
  };

  const renderCurrentView = () => {
    if (currentView === 'cover') {
      const top5Display = getPaddedTop5();
      
      return (
        <div className="w-full min-h-screen flex items-center justify-center relative overflow-y-auto overflow-x-hidden bg-white">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-white to-[#E0E0E0] fixed">
            {!bgFailed && (
              <img src="./bg.png" onError={() => setBgFailed(true)} className="w-full h-full object-cover mix-blend-multiply opacity-100" alt="Background" />
            )}
          </div>

          <div className="w-full max-w-[1780px] px-4 md:px-8 relative z-10 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-10 2xl:gap-24 py-12 lg:py-8 min-h-screen">
            {/* Left Content / Titles */}
            <div className="flex-1 w-full flex flex-col items-center justify-center mt-8 lg:mt-0 min-w-0">
              <div className="mb-8 2xl:mb-16 flex flex-col items-center w-full min-w-0">
                <h1 
                  className="text-5xl md:text-7xl lg:text-5xl xl:text-6xl 2xl:text-[7.5rem] uppercase text-center leading-[1.1] drop-shadow-2xl mb-2 2xl:mb-4 whitespace-normal lg:whitespace-nowrap w-full" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#0099D0',
                    textShadow: '2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white, 0px 2px 0 white, 0px -2px 0 white, 2px 0px 0 white, -2px 0px 0 white',
                    wordSpacing: '5px'   
                  }}
                >
                  REACH TOP 3,
                </h1>
                <h1 
                  className="text-5xl md:text-7xl lg:text-5xl xl:text-6xl 2xl:text-[7.5rem] uppercase text-center leading-[1.1] drop-shadow-2xl mb-4 2xl:mb-6 whitespace-normal lg:whitespace-nowrap w-full" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#0099D0',
                    textShadow: '2px 2px 0 white, -2px -2px 0 white, 2px -2px 0 white, -2px 2px 0 white, 0px 2px 0 white, 0px -2px 0 white, 2px 0px 0 white, -2px 0px 0 white',
                    wordSpacing: '5px'   
                  }}
                >
                  WIN A PRIZE!
                </h1>
                <h2 
                  className="text-xl md:text-3xl lg:text-xl xl:text-2xl 2xl:text-[2.75rem] text-center tracking-[0.1em] 2xl:tracking-[0.15em] uppercase drop-shadow-lg whitespace-normal lg:whitespace-nowrap w-full" 
                  style={{ 
                    fontFamily: "'Bungee Inline', sans-serif", 
                    fontWeight: 400,
                    color: '#007BA8',
                    textShadow: '1px 1px 0 white, -1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 0px 1px 0 white, 0px -1px 0 white, 1px 0px 0 white, -1px 0px 0 white',
                    wordSpacing: '5px'   
                  }}
                >
                  30 Second Memory Challenge
                </h2>
              </div>

              <div className="w-full max-w-sm md:max-w-md 2xl:max-w-xl bg-slate-800/30 backdrop-blur-2xl border border-white/30 border-t-white/50 border-l-white/50 p-6 2xl:p-8 rounded-3xl 2xl:rounded-[2.5rem] shadow-[0_15px_30px_rgba(0,0,0,0.2),inset_0_0_15px_rgba(255,255,255,0.1)] flex flex-col items-center relative overflow-hidden">
                <label className="text-lg xl:text-xl 2xl:text-2xl mb-6 2xl:mb-8 font-bold flex items-center text-white drop-shadow-md uppercase tracking-widest text-center">
                  <User className="mr-3 2xl:mr-4 w-6 h-6 2xl:w-8 2xl:h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
                  Enter Your Name to Play
                </label>
                
                <div className="w-full relative">
                  <input 
                    type="text" 
                    value={playerName}
                    onChange={handleNameChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Player Name"
                    className="w-full text-xl 2xl:text-3xl p-4 2xl:p-6 rounded-2xl bg-white/20 border border-white/40 shadow-[0_4px_10px_rgba(0,0,0,0.1),inset_0_2px_15px_rgba(255,255,255,0.3)] text-white text-center focus:outline-none focus:bg-white/30 focus:border-white/60 focus:ring-2 focus:ring-white/50 transition-all placeholder-white/70 font-bold backdrop-blur-xl"
                    maxLength={15}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>

                <button 
                  onClick={showRules}
                  disabled={!playerName.trim()}
                  className={`w-full text-xl 2xl:text-4xl font-black py-4 2xl:py-6 mt-6 2xl:mt-10 rounded-2xl flex items-center justify-center transition-all duration-300 uppercase tracking-widest ${
                    playerName.trim() 
                      ? 'bg-[#22d3ee] border-none shadow-[0_10px_30px_rgba(34,211,238,0.5)] text-white scale-105 hover:bg-[#22d3ee] hover:shadow-[0_0_45px_rgba(34,211,238,0.9)]' 
                      : 'bg-white/5 border border-white/10 backdrop-blur-sm text-white/30 shadow-none cursor-not-allowed'
                  }`}
                >
                  <Play className="mr-3 2xl:mr-6 w-6 h-6 2xl:w-10 2xl:h-10" fill="currentColor" />
                  30s Go!
                </button>
              </div>
            </div>

            {/* Right Content / Leaderboard */}
            <div className="w-full lg:w-[400px] xl:w-[500px] 2xl:w-[650px] flex flex-col justify-center bg-white/10 backdrop-blur-2xl border border-white/30 border-t-white/50 border-l-white/50 rounded-3xl 2xl:rounded-[3rem] p-6 2xl:p-12 shadow-[0_15px_40px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.1)] relative shrink-0">
              <h3 
                className="text-3xl xl:text-4xl 2xl:text-[3.5rem] w-full text-center mt-2 2xl:mt-4 font-black text-slate-800 mb-6 2xl:mb-12 flex items-center justify-center uppercase tracking-widest relative z-10 drop-shadow-md whitespace-nowrap"
                style={{ fontFamily: "'Train One', sans-serif" }}
              >
                Top 5 Masters
              </h3>
              
              <div className="flex flex-col gap-3 2xl:gap-6 w-full relative z-10">
                {top5Display.map((player, idx) => renderPlayerRow(player, idx, false, true, true))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentView === 'rules') {
      return (
        <div className="w-full min-h-screen flex items-center justify-center relative overflow-y-auto overflow-x-hidden bg-white">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-white to-[#E0E0E0] fixed">
            {!bgFailed && (
              <img src="./bg.png" onError={() => setBgFailed(true)} className="w-full h-full object-cover mix-blend-multiply opacity-100" alt="Background" />
            )}
          </div>
          
          <div className="relative z-10 w-full max-w-2xl bg-[#0a0f1e]/80 backdrop-blur-2xl border-2 border-white/20 p-8 md:p-12 2xl:p-16 rounded-3xl md:rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.4),inset_0_0_20px_rgba(255,255,255,0.1)] flex flex-col items-center animate-in zoom-in duration-500 mx-4 my-8">
             <h2 className="text-4xl md:text-5xl 2xl:text-6xl font-black text-white mb-8 2xl:mb-12 tracking-widest uppercase text-center drop-shadow-lg" style={{ fontFamily: "'Train One', sans-serif" }}>
               How to Play
             </h2>

             <div className="flex flex-col gap-4 md:gap-6 2xl:gap-8 w-full mb-10 2xl:mb-14">
               <div className="flex items-start gap-4 md:gap-6 bg-white/10 p-5 md:p-6 rounded-2xl border border-white/20 shadow-inner">
                 <span className="text-3xl md:text-4xl shrink-0">👀</span>
                 <div>
                   <h4 className="text-xl md:text-2xl font-bold text-cyan-300 mb-1 uppercase tracking-wider">3s Quick Peek</h4>
                   <p className="text-base md:text-lg 2xl:text-xl text-white/90">Get a 3-second flash of all the cards.</p>
                 </div>
               </div>
               
               <div className="flex items-start gap-4 md:gap-6 bg-white/10 p-5 md:p-6 rounded-2xl border border-white/20 shadow-inner">
                 <span className="text-3xl md:text-4xl shrink-0">⏱️</span>
                 <div>
                   <h4 className="text-xl md:text-2xl font-bold text-red-400 mb-1 uppercase tracking-wider">30s Memory Race</h4>
                   <p className="text-base md:text-lg 2xl:text-xl text-white/90">The 30-second timer drops!</p>
                 </div>
               </div>

               <div className="flex items-start gap-4 md:gap-6 bg-white/10 p-5 md:p-6 rounded-2xl border border-white/20 shadow-inner">
                 <span className="text-3xl md:text-4xl shrink-0">🃏</span>
                 <div>
                   <h4 className="text-xl md:text-2xl font-bold text-yellow-400 mb-1 uppercase tracking-wider">Match</h4>
                   <p className="text-base md:text-lg 2xl:text-xl text-white/90">Find all 10 pairs before time runs out!</p>
                 </div>
               </div>
             </div>

             <button 
               onClick={initializeGame}
               className="w-full max-w-md text-2xl md:text-3xl 2xl:text-4xl font-black py-4 2xl:py-6 rounded-2xl flex items-center justify-center transition-all duration-300 uppercase tracking-widest bg-[#22d3ee] border-none shadow-[0_10px_30px_rgba(34,211,238,0.5)] text-white hover:scale-105 hover:bg-[#22d3ee] hover:shadow-[0_0_45px_rgba(34,211,238,0.9)]"
             >
               <Play className="mr-3 md:mr-4 w-8 h-8 md:w-10 md:h-10" fill="currentColor" />
               Go!
             </button>
          </div>
        </div>
      );
    }

    if (currentView === 'playing') {
      return (
        <div className="w-full min-h-screen text-white flex flex-col p-4 md:p-8 2xl:p-12 font-sans relative overflow-x-hidden overflow-y-auto bg-[#0a0f1e]">
          <div className="absolute inset-0 z-0 fixed">
             <img src="./bg-2.png" className="w-full h-full object-cover" alt="Game Background" />
          </div>
          
          <div className="absolute top-0 right-0 w-[400px] h-[400px] 2xl:w-[800px] 2xl:h-[800px] bg-blue-600/10 blur-[100px] 2xl:blur-[200px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none z-0 fixed" />
          
          <div className="py-4 2xl:py-0 2xl:h-36 bg-white/20 backdrop-blur-3xl 2xl:backdrop-blur-[60px] border border-white/30 2xl:border-2 2xl:border-white/50 rounded-3xl 2xl:rounded-[3rem] mb-6 2xl:mb-12 shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.4)] relative z-10 w-full flex flex-col md:flex-row items-center justify-between px-6 2xl:px-10 gap-4 md:gap-0">
            <div className="flex items-center gap-4 w-full md:w-1/3 justify-center md:justify-start">
              <div className="flex flex-col">
                <span className="text-slate-300 md:text-slate-500 text-xs 2xl:text-lg font-bold uppercase tracking-widest text-center md:text-left">Player</span>
                <span className="text-xl md:text-2xl 2xl:text-4xl font-black text-white md:text-slate-800 text-center md:text-left truncate max-w-[150px] 2xl:max-w-[250px]">{playerName || 'Guest'}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center w-full md:w-1/3 justify-center order-first md:order-none mb-2 md:mb-0">
              <span className="text-slate-300 md:text-slate-500 text-xs 2xl:text-lg font-bold uppercase tracking-widest mb-1 text-center">
                {isPreviewing ? 'Memorize Cards!' : 'Time Remaining'}
              </span>
              <div className={`text-4xl md:text-5xl 2xl:text-7xl font-black flex items-center ${timeLeft <= 10 && !isPreviewing ? 'text-red-400 md:text-red-500 animate-pulse drop-shadow-md' : 'text-white md:text-slate-800'}`}>
                <Timer className="mr-2 2xl:mr-4 w-6 h-6 md:w-8 md:h-8 2xl:w-12 2xl:h-12" />
                {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end w-full md:w-1/3 justify-center md:justify-end">
              <span className="text-slate-300 md:text-slate-500 text-xs 2xl:text-lg font-bold uppercase tracking-widest text-center md:text-right">Score</span>
              <span className="text-3xl md:text-4xl 2xl:text-6xl font-black text-cyan-300 md:text-cyan-400 text-center md:text-right">
                {score}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-4 md:grid-cols-5 gap-3 sm:gap-4 xl:gap-6 pb-6 relative z-10 min-h-[50vh]">
            {cards.map((card, index) => {
              const isFlipped = isPreviewing || flippedIndices.includes(index) || matchedIndices.includes(index);
              const isMatched = matchedIndices.includes(index);
              return (
                <div key={card.id} onClick={() => handleCardClick(index)} className="relative cursor-pointer perspective-1000 group aspect-[3/4] md:aspect-auto">
                  <div 
                    className={`w-full h-full duration-300 transition-all relative rounded-xl 2xl:rounded-3xl shadow-xl border-2 ${
                      isMatched 
                        ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)] md:shadow-[0_0_40px_rgba(250,204,21,0.8)] bg-yellow-900/20' 
                        : isFlipped 
                          ? 'border-green-400/80' 
                          : 'border-white/10 hover:border-green-400/80 hover:bg-green-500/10'
                    }`}
                    style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                  >
                    <div className="absolute inset-0 w-full h-full rounded-[0.8rem] 2xl:rounded-[1.4rem] overflow-hidden bg-white" style={{ backfaceVisibility: 'hidden' }}>
                      <img src="./card-image/exw card.png" alt="Card Back" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    </div>
                    <div className="absolute inset-0 w-full h-full bg-white rounded-[0.8rem] 2xl:rounded-[1.4rem] flex items-center justify-center shadow-2xl p-2 md:p-3 2xl:p-4 overflow-hidden" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <img src={card.imagePath} alt="Product Card" className="w-full h-full object-contain transition-all duration-300" />
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
      const getScoreImage = (s) => {
        if (s <= 29) return './score-bg/0-29.gif';
        if (s <= 49) return './score-bg/30-49.gif';
        if (s <= 69) return './score-bg/50-69.gif';
        if (s <= 89) return './score-bg/70-89.gif';
        return './score-bg/90-100.gif';
      };
      
      const reactionImage = getScoreImage(score);

      return (
        <div className="w-full h-full min-h-screen text-white flex flex-col items-center justify-center p-4 2xl:p-8 relative overflow-hidden">
          <div className="absolute inset-0 z-0 fixed">
            <img src="./bg-3.png" className="w-full h-full object-cover blur-[2px]" alt="Score Background" />
          </div>
          
          {scorePhase !== 'score' && (
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out z-20 ${scorePhase === 'timesUp' ? 'opacity-100 scale-100' : 'opacity-0 scale-125 pointer-events-none'}`}>
              <h2 className="text-7xl md:text-8xl lg:text-9xl 2xl:text-[10rem] font-black text-white tracking-widest uppercase italic drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)] text-center">
                Times Up!
              </h2>
            </div>
          )}

          {scorePhase !== 'timesUp' && (
            <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out z-10 ${scorePhase === 'score' ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
              <div className="bg-[#e0e0e0] p-6 md:p-8 lg:p-12 rounded-3xl 2xl:rounded-[4rem] shadow-[10px_10px_40px_rgba(0,0,0,0.4),inset_0_0_15px_rgba(255,255,255,0.5)] border border-white/50 flex flex-col md:flex-row items-center gap-6 lg:gap-12 w-11/12 max-w-[1300px]">
                
                <div className="flex-1 w-full h-[40vh] md:h-[50vh] 2xl:h-[60vh] rounded-2xl 2xl:rounded-3xl overflow-hidden shadow-[inset_0_4px_15px_rgba(0,0,0,0.3)] border-[6px] lg:border-8 border-white shrink-0 bg-black/10">
                  <img src={reactionImage} alt="Score Reaction" className="w-full h-full object-cover" />
                </div>

                <div className="flex flex-col items-center justify-center px-4 md:px-10 shrink-0">
                  <p className="text-2xl md:text-3xl lg:text-4xl text-slate-600 mb-2 lg:mb-4 font-bold uppercase tracking-widest text-center">Your Score</p>
                  <p className="text-[7rem] md:text-[9rem] lg:text-[11rem] 2xl:text-[14rem] font-black text-black leading-none text-center drop-shadow-md">{score}</p>
                </div>

              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentView === 'leaderboard') {
      const top5Display = getPaddedTop5();
      const playerRankIndex = currentPlayerResult ? leaderboard.findIndex(p => p.id === currentPlayerResult.id) : -1;
      const isInTop5 = playerRankIndex >= 0 && playerRankIndex < 5;

      return (
        <div className="w-full min-h-screen flex flex-col items-center justify-center p-4 md:p-8 font-sans relative overflow-x-hidden overflow-y-auto">
          <div className="absolute inset-0 z-0 bg-white fixed">
             <img src="./bg-4.png" className="w-full h-full object-cover" alt="Leaderboard Background" />
          </div>

          <div className={`w-[90%] max-w-[1000px] flex flex-col justify-center bg-white/20 backdrop-blur-2xl 2xl:backdrop-blur-[60px] border border-white/30 2xl:border-2 2xl:border-white/50 rounded-3xl 2xl:rounded-[4rem] shadow-[0_10px_30px_rgba(0,0,0,0.2),inset_0_0_20px_rgba(255,255,255,0.4)] relative z-10 transition-all duration-500 ${!isInTop5 ? 'p-4 md:p-6 2xl:p-10 my-4' : 'p-6 md:p-10 2xl:p-16 mt-8 mb-24'}`}>
            <h3 
              className={`text-3xl md:text-4xl xl:text-5xl 2xl:text-6xl font-bold text-white flex items-center justify-center uppercase tracking-[0.05em] 2xl:tracking-[0.1em] relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] text-center transition-all ${!isInTop5 ? 'mb-4 2xl:mb-8' : 'mb-8 2xl:mb-12'}`}
              style={{ fontFamily: "'Train One', sans-serif" }}
            >
              Top 5 Masters
            </h3>
            
            <div className="flex flex-col gap-3 2xl:gap-5 w-full relative z-10">
              {top5Display.map((player, idx) => {
                const isMe = currentPlayerResult && player.id === currentPlayerResult.id;
                return renderPlayerRow(player, idx, isMe, true, false);
              })}

              {!isInTop5 && currentPlayerResult && (
                <>
                  <div className="h-px bg-white/40 w-full my-4 2xl:my-6" />
                  {renderPlayerRow({ ...currentPlayerResult, rank: playerRankIndex + 1 }, playerRankIndex, true, false, false)}
                </>
              )}
            </div>
          </div>

          <div className="fixed bottom-4 2xl:bottom-8 right-4 2xl:right-8 z-50">
            <button 
              onClick={resetToCover}
              className="px-4 py-3 2xl:px-6 2xl:py-3 bg-orange-500/90 hover:bg-orange-400 border-2 border-orange-300 rounded-[1rem] text-lg 2xl:text-xl font-bold text-white transition-all shadow-[0_8px_15px_rgba(249,115,22,0.4)] flex items-center justify-center uppercase tracking-wider active:scale-95"
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
    <div className="flex w-full min-h-screen bg-[#0a0f1e] overflow-x-hidden relative" onClick={requestFullScreen} style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Bungee+Inline&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Train+One&display=swap');
      `}</style>
      {!isFullscreen && (
        <button onClick={toggleFullScreen} className="fixed top-4 right-4 2xl:top-10 2xl:right-10 z-[100] p-3 2xl:p-4 text-white/60 hover:text-emerald-400 bg-black/20 2xl:bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full transition-all shadow-2xl border border-white/10">
          <Maximize className="w-6 h-6 2xl:w-10 2xl:h-10" />
        </button>
      )}
      <div className="relative w-full min-h-screen">
        {renderCurrentView()}
      </div>
    </div>
  );
}