"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, web3, Idl, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json"; 
import GameCanvas, { GameRef, BloqueVivo } from "../components/GameCanvas";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplTokenMetadata, fetchAllDigitalAssetByOwner } from '@metaplex-foundation/mpl-token-metadata';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';

const WalletMultiButton = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });
const PROGRAM_ID = new PublicKey("9bygE6GBpYoj6Yz77VEJEy1Rpf59uaWHcdNdzFwbg6Yu"); 

// CHAT (Ahora más alto)
const ChatBox = ({ usuario }: { usuario: string }) => {
    const [mensajes, setMensajes] = useState<{usr: string, txt: string}[]>([{ usr: "System", txt: "Pot is distributing rewards!" }]);
    const [input, setInput] = useState("");
    const endRef = useRef<HTMLDivElement>(null);
    const enviar = () => { if (!input.trim()) return; setMensajes(prev => [...prev, { usr: usuario || "Anon", txt: input }]); setInput(""); };
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);
    return (
        // CAMBIO: Aumenté h-48 a h-64 para llenar mejor el espacio
        <div className="bg-gray-900 border-t border-gray-700 h-64 flex flex-col p-4 rounded-b-xl shadow-2xl">
            <div className="flex-grow overflow-y-auto space-y-2 mb-2 pr-2 scrollbar-thin">
                {mensajes.map((m, i) => (
                    <div key={i} className="text-sm">
                        <span className="font-bold text-purple-400">{m.usr}: </span>
                        <span className="text-gray-300">{m.txt}</span>
                    </div>
                ))}
                <div ref={endRef} />
            </div>
            <div className="flex gap-2">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && enviar()} placeholder="Type here..." className="flex-grow bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
                <button onClick={enviar} className="bg-purple-600 px-6 py-2 rounded text-sm font-bold hover:bg-purple-500 transition-colors">Send</button>
            </div>
        </div>
    );
};

export default function Home() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const wallet = useAnchorWallet();
  const gameRef = useRef<GameRef>(null);

  // GAME STATES
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [bloquesDisponibles, setBloquesDisponibles] = useState(0); 
  const [rankingSupervivencia, setRankingSupervivencia] = useState<BloqueVivo[]>([]);
  const [eventosActivos, setEventosActivos] = useState<string[]>([]);
  
  const rankingRef = useRef<BloqueVivo[]>([]);

  // ECONOMY
  const [saldoBilleteraJuego, setSaldoBilleteraJuego] = useState(0.0000); 
  const [pozoComun, setPozoComun] = useState(10.0000); 
  const [totalInvertido, setTotalInvertido] = useState(0.0000); 
  const [totalGanado, setTotalGanado] = useState(0.0000); 
  
  // Dynamic Cost Logic
  const [montoDeposito, setMontoDeposito] = useState<string>("0.5");
  const [lastLaunchTime, setLastLaunchTime] = useState(0); 
  const [penaltyCount, setPenaltyCount] = useState(0); 
  const [costoActualBloque, setCostoActualBloque] = useState(0.01); 
  const [tiempoRestanteCooldown, setTiempoRestanteCooldown] = useState(0); 

  // Customization
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [zonaElegida, setZonaElegida] = useState(0);
  const [modoPersonalizacion, setModoPersonalizacion] = useState<'color' | 'imagen'>('color');
  const [colorElegido, setColorElegido] = useState("#3B82F6");
  const [letraElegida, setLetraElegida] = useState("ABC");
  const [urlImagen, setUrlImagen] = useState("");
  const [misNFTs, setMisNFTs] = useState<any[]>([]);
  const [cargandoNFTs, setCargandoNFTs] = useState(false);
  const [simulacionActiva, setSimulacionActiva] = useState(false);
  
  // AUDIO BGM
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.5);
  
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const tensionAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIndex = useRef(0);
  const oneShotAudioRef = useRef<HTMLAudioElement | null>(null);
  const oneShotTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Web Audio API refs para el filtro reactivo
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Layer 1: Atmospheric "Bed" - long, looping ambient tracks
  // Place your base ambient sounds here (e.g., deep drones, server hums)
  const ambientPlaylist = [
      '/sounds/ambient_sound.mp3'
  ];

  // Layer 2: Random "One-Shots" - short, unpredictable SFX
  // Place your short glitch/sci-fi sounds here
  const oneShotPlaylist = [
      '/sounds/sfx_data.m4a',
      '/sounds/sfx_chain.m4a',
      '/sounds/sfx_metal.m4a',
  ];

  // Effect for BGM (Atmospheric Bed)
  useEffect(() => {
      if (typeof window !== 'undefined') {
          bgmRef.current = new Audio(ambientPlaylist[0]);
          bgmRef.current.crossOrigin = "anonymous"; // Requerido para procesar el audio con Web Audio API
          bgmRef.current.volume = masterVolume;
          bgmRef.current.loop = true; // <-- AÑADIDO: Esto hace que el sonido ambiental se repita automáticamente.

          // 1. Configurar Web Audio API (Filtro Pasa-Bajos)
          try {
              const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
              audioCtxRef.current = new AudioContextClass();
              filterNodeRef.current = audioCtxRef.current.createBiquadFilter();
              filterNodeRef.current.type = 'lowpass';
              filterNodeRef.current.frequency.value = 400; // Empieza sordo por defecto

              sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(bgmRef.current);
              sourceNodeRef.current.connect(filterNodeRef.current);
              filterNodeRef.current.connect(audioCtxRef.current.destination);
          } catch (e) { console.warn("Web Audio API no soportada", e); }

          // Also initialize the one-shot player here
          oneShotAudioRef.current = new Audio();

          // Initialize Tension Layer
          tensionAudioRef.current = new Audio('/sounds/tension_pulse.m4a');
          tensionAudioRef.current.loop = true;
          tensionAudioRef.current.volume = 0.5;
      }
  }, []);

  // Effect to update BGM volume when slider changes
  useEffect(() => {
      if (bgmRef.current) {
          bgmRef.current.volume = audioEnabled ? masterVolume : 0;
      }
  }, [masterVolume, audioEnabled]);

  // Effect for handling the random one-shot playback loop
  useEffect(() => {
      const playRandomOneShot = () => {
          if (!audioEnabled || !oneShotAudioRef.current || oneShotPlaylist.length === 0) return;
          
          const randomIndex = Math.floor(Math.random() * oneShotPlaylist.length);
          oneShotAudioRef.current.src = oneShotPlaylist[randomIndex];
          oneShotAudioRef.current.volume = audioEnabled ? masterVolume : 0;
          oneShotAudioRef.current.play().catch(() => {});
          
          const randomDelay = Math.random() * 25000 + 20000; // 20-45s
          oneShotTimeoutRef.current = setTimeout(playRandomOneShot, randomDelay);
      };

      if (audioEnabled) {
          const initialDelay = Math.random() * 10000 + 5000; // 5-15s
          oneShotTimeoutRef.current = setTimeout(playRandomOneShot, initialDelay);
      } else {
          if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
          oneShotAudioRef.current?.pause();
      }

      return () => { if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current); };
  }, [audioEnabled, masterVolume]);

  // AUDIO REACTIVO: Ajustar Filtro y Tensión según la cantidad de bloques vivos
  useEffect(() => {
      // Calcular los bloques del jugador actual
      const myBlocks = publicKey ? rankingSupervivencia.filter(b => b.owner === publicKey.toString()).length : 0;
      
      // 1. Dinámica del Filtro Pasa-Bajos (Abre el filtro cuantas más piezas tengas)
      if (filterNodeRef.current && audioCtxRef.current) {
          const MAX_BLOCKS = 4; // A los 4 bloques alcanza la máxima claridad
          const MIN_FREQ = 400;   // Sordo y lejano
          const MAX_FREQ = 20000; // Sonido totalmente abierto
          
          const ratio = Math.min(myBlocks, MAX_BLOCKS) / MAX_BLOCKS;
          // Usamos una curva exponencial porque el oído humano percibe las frecuencias logarítmicamente
          const targetFreq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, ratio);
          
          filterNodeRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.5); // 0.5s de transición suave
      }

      // 2. Control de la capa de "Tensión / High-stakes"
      if (tensionAudioRef.current) {
          const tensionRatio = Math.min(myBlocks, 3) / 3; // Alcanza el volumen máximo a los 3 bloques
          tensionAudioRef.current.volume = audioEnabled ? (tensionRatio * masterVolume) : 0;
          
          if (audioEnabled && myBlocks > 0) {
              if (tensionAudioRef.current.paused) tensionAudioRef.current.play().catch(() => {});
          } else {
              if (!tensionAudioRef.current.paused) tensionAudioRef.current.pause();
          }
      }
  }, [rankingSupervivencia, publicKey, audioEnabled, masterVolume]);

  const toggleAudio = () => {
      if (!bgmRef.current) return;
      
      // Los navegadores requieren interacción del usuario para reanudar el AudioContext
      if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume();
      }

      const newState = !audioEnabled;
      setAudioEnabled(newState);

      if (newState) {
          bgmRef.current.play().catch(() => {});
          // Tension is handled by the ranking/volume useEffect
      } else {
          bgmRef.current.pause();
          tensionAudioRef.current?.pause();
          oneShotAudioRef.current?.pause();
          if (oneShotTimeoutRef.current) clearTimeout(oneShotTimeoutRef.current);
      }
  };

  const playSfx = (soundUrl: string) => {
      if (!audioEnabled || !oneShotAudioRef.current) return;
      oneShotAudioRef.current.src = soundUrl;
      oneShotAudioRef.current.volume = audioEnabled ? masterVolume : 0;
      oneShotAudioRef.current.play().catch(() => {});
  };

  useEffect(() => { rankingRef.current = rankingSupervivencia; }, [rankingSupervivencia]);

  // DISTRIBUTION LOGIC
  useEffect(() => {
      const timer = setInterval(() => {
          const currentRanking = rankingRef.current;
          if (pozoComun <= 0.0001 || currentRanking.length === 0) return;
          const porcentajeReparto = 0.01; 
          const montoARepartir = pozoComun * porcentajeReparto;
          const pagoPorBloque = montoARepartir / currentRanking.length;

          if (publicKey && isRegistered) {
              const misBloques = currentRanking.filter(b => b.owner === publicKey.toString());
              if (misBloques.length > 0) {
                  const miGanancia = misBloques.length * pagoPorBloque;
                  setPozoComun(prev => Math.max(0, prev - miGanancia)); 
                  setSaldoBilleteraJuego(prev => prev + miGanancia);
                  setTotalGanado(prev => prev + miGanancia);
              }
              const bloquesOtros = currentRanking.length - misBloques.length;
              if (bloquesOtros > 0) {
                  const gananciaOtros = bloquesOtros * pagoPorBloque;
                  setPozoComun(prev => Math.max(0, prev - gananciaOtros));
              }
          }
      }, 1000); 
      return () => clearInterval(timer);
  }, [pozoComun, publicKey, isRegistered]); 

  // DYNAMIC PRICE
  useEffect(() => {
      const timer = setInterval(() => {
          const ahora = Date.now();
          const tiempoPasado = (ahora - lastLaunchTime) / 1000; 
          const PRECIO_BASE = 0.01;
          const TIEMPO_COOLDOWN = 15;
          if (tiempoPasado >= TIEMPO_COOLDOWN) {
              setPenaltyCount(0);
              setCostoActualBloque(PRECIO_BASE); 
              setTiempoRestanteCooldown(0);
          } else {
              const factorTiempo = (TIEMPO_COOLDOWN - tiempoPasado) / TIEMPO_COOLDOWN;
              const penalizacionAcumulada = 0.01 * penaltyCount;
              const costoExtra = penalizacionAcumulada * factorTiempo;
              setCostoActualBloque(PRECIO_BASE + costoExtra);
              setTiempoRestanteCooldown(TIEMPO_COOLDOWN - tiempoPasado);
          }
      }, 50); 
      return () => clearInterval(timer);
  }, [lastLaunchTime, penaltyCount]);

  useEffect(() => { if (publicKey) setLetraElegida(publicKey.toString().slice(0,3).toUpperCase()); }, [publicKey]);
  
  // AUTOMATIC EVENTS LOOP
  useEffect(() => {
    const intervalo = setInterval(() => {
        const nuevos: string[] = [];
        if (Math.random() < 0.3) { gameRef.current?.triggerFloorTrap(); nuevos.push("FLOOR CRACK 🕳️"); }
        if (Math.random() < 0.3) { 
            gameRef.current?.triggerFloorTrap(); 
            playSfx('/sounds/trap.m4a'); // <-- Aquí se reproduce el sonido
            nuevos.push("FLOOR CRACK 🕳️"); 
        }
        if (Math.random() < 0.6) { gameRef.current?.triggerEarthquake(); nuevos.push("EARTHQUAKE 🌍"); }
        if (Math.random() < 0.35) { gameRef.current?.triggerFire(); nuevos.push("FIRE 🔥"); }
        if (Math.random() < 0.25) { gameRef.current?.triggerBlackHole(); nuevos.push("BLACK HOLE ⚫"); }
        if (nuevos.length > 0) { setEventosActivos(prev => [...prev, ...nuevos]); setTimeout(() => setEventosActivos([]), 2500); }
    }, 5000); 
    return () => clearInterval(intervalo);
  }, []);

  // SIMULATION & WATCHDOG LOOP (TESTING AUTOMATIZADO)
  useEffect(() => {
    if (!simulacionActiva) return;
    const interval = setInterval(() => {
        // 1. Spawn Test Bots (Simula jugadores lanzando bloques)
        if (gameRef.current) {
            const z = Math.floor(Math.random() * 8);
            gameRef.current.spawnBlock({ tipo: 'color', valor: '#' + Math.floor(Math.random()*16777215).toString(16), letra: 'BOT', zona: z, owner: 'test-bot', userName: 'AutoBot' });
        }
        // 2. Trigger Random Events (Genera caos para probar físicas)
        if (Math.random() < 0.5) {
             const r = Math.random();
             if (r < 0.25) gameRef.current?.triggerFloorTrap();
             else if (r < 0.5) gameRef.current?.triggerEarthquake();
             else if (r < 0.75) gameRef.current?.triggerFire();
             else gameRef.current?.triggerBlackHole();
        }
        // 3. Watchdog for Infinite Winners (Detecta bloques inmortales)
        const infiniteWinners = rankingRef.current.filter(b => b.tiempoVida > 60); // >60s es sospechoso en modo caos
        if (infiniteWinners.length > 0) {
            setMensaje(`⚠️ ALERT: ${infiniteWinners.length} blocks surviving too long! Check physics.`);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [simulacionActiva]);
  
  const cargarMisNFTs = async () => { if (!publicKey) return; setCargandoNFTs(true); try { const umi = createUmi(connection.rpcEndpoint).use(mplTokenMetadata()); const assets = await fetchAllDigitalAssetByOwner(umi, umiPublicKey(publicKey.toBase58())); const loaded: any[] = []; for (const asset of assets.slice(0, 10)) { if (asset.metadata.uri) { const res = await fetch(asset.metadata.uri); const json = await res.json(); if (json.image) loaded.push({ name: json.name, image: json.image, mint: asset.publicKey }); } } setMisNFTs(loaded); } catch (e) { console.error(e); } finally { setCargandoNFTs(false); } };
  const getProgram = () => { if (!wallet) return null; const provider = new AnchorProvider(connection, wallet, { preflightCommitment: "processed" }); (idl as any).address = PROGRAM_ID.toString(); return new Program(idl as Idl, provider); };
  
  const depositarFondos = async () => {
    if (!publicKey || !wallet) return; const amount = parseFloat(montoDeposito); if (isNaN(amount) || amount <= 0) { setMensaje("Invalid Amount"); setTimeout(() => setMensaje(""), 3000); return; }
    setLoading(true); setMensaje("Processing...");
    try {
      const program = getProgram(); if (!program) return;
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from("jugador"), publicKey.toBuffer()], PROGRAM_ID);
      await program.methods.comprarBloques(new BN(1)).accounts({ jugadorStats: pda, user: publicKey, tesoreria: TESORERIA_WALLET, systemProgram: web3.SystemProgram.programId }).rpc();
      await program.methods.comprarBloques(new BN(1)).accounts({ jugadorStats: pda, user: publicKey, tesoreria: publicKey, systemProgram: web3.SystemProgram.programId }).rpc();
      setSaldoBilleteraJuego(prev => prev + amount); setMensaje(`Deposit Successful: ${amount} SOL`); setTimeout(() => setMensaje(""), 3000);
    } catch (error: any) { setMensaje("Error: " + error.message); setTimeout(() => setMensaje(""), 3000); } finally { setLoading(false); }
  };

  const lanzarBloque = () => {
      if (!isRegistered) { setMensaje("⚠️ Please register your name first!"); setTimeout(() => setMensaje(""), 3000); return; }
      if (saldoBilleteraJuego < costoActualBloque) { setMensaje("⚠️ Insufficient Funds"); setTimeout(() => setMensaje(""), 3000); return; }
      if (gameRef.current && publicKey) {
          setSaldoBilleteraJuego(prev => prev - costoActualBloque);
          setTotalInvertido(prev => prev + costoActualBloque);
          
          const feeDev = costoActualBloque * 0.01; 
          const aportePozo = costoActualBloque * 0.99; 

          // Simula el envío de la comisión a la billetera designada (esto debería hacerse on-chain)
          // Por ahora, solo es una simulación visual en la consola.
          console.log(`Enviando ${feeDev.toFixed(6)} SOL de comisión a ${COMISION_WALLET.toString()}`);
          // En una implementación real, aquí llamarías a una instrucción de tu programa
          // que transfiera `feeDev` a la `COMISION_WALLET`.
          // Ejemplo: await program.methods.pagarComision(new BN(feeDev * 1e9))...

          const feeDev = costoActualBloque * 0.01; const aportePozo = costoActualBloque * 0.99; 
          setPozoComun(prev => prev + aportePozo);

          setLastLaunchTime(Date.now());
          setPenaltyCount(prev => prev + 1); 
          
          if (modoPersonalizacion === 'color') gameRef.current.spawnBlock({ tipo: 'color', valor: colorElegido, letra: letraElegida, zona: zonaElegida, owner: publicKey.toString(), userName: nombreUsuario });
          else gameRef.current.spawnBlock({ tipo: 'imagen', valor: urlImagen || 'https://placehold.co/100x100/png', zona: zonaElegida, owner: publicKey.toString(), userName: nombreUsuario });
      }
  };

  const registrarUsuario = () => { if(nombreUsuario.trim().length < 3) { setMensaje("Name too short!"); setTimeout(() => setMensaje(""), 3000); return; } setIsRegistered(true); };
  const retirarFondos = async () => { if(saldoBilleteraJuego <= 0) return; setLoading(true); setTimeout(() => { setMensaje(`Withdrawn ${saldoBilleteraJuego.toFixed(4)} SOL!`); setSaldoBilleteraJuego(0); setTotalInvertido(0); setTotalGanado(0); setLoading(false); setTimeout(() => setMensaje(""), 3000); }, 1500); };
  const inicializarJugador = async () => { if (!publicKey || !wallet) return; setLoading(true); try { const program = getProgram(); if (!program) return; const [pda] = PublicKey.findProgramAddressSync([Buffer.from("jugador"), publicKey.toBuffer()], PROGRAM_ID); await program.methods.inicializarJugador().accounts({ jugadorStats: pda, user: publicKey, systemProgram: web3.SystemProgram.programId }).rpc(); setMensaje("Account Created!"); setTimeout(() => setMensaje(""), 3000); } catch (error: any) { setMensaje("Error: " + error.message); setTimeout(() => setMensaje(""), 3000); } finally { setLoading(false); } };
  const neto = totalGanado - totalInvertido;

  return (
    <main className="flex min-h-screen bg-gray-950 text-white p-4 gap-4 overflow-x-auto">
      
      {/* LEFT PANEL - INSTRUCTIONS */}
      <div className="w-72 flex flex-col gap-4 h-screen overflow-y-auto pb-10 sticky top-0 hidden 2xl:flex">
        <div className="bg-gray-900 border border-gray-700 p-5 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <h2 className="text-sm font-bold text-purple-400 mb-6 uppercase border-b border-gray-700 pb-3 flex items-center gap-2">
                📜 How to Play
            </h2>
            
            <ul className="space-y-6">
                <li className="flex gap-4 group">
                    <span className="bg-gray-800 border border-purple-500/30 text-purple-400 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">1</span>
                    <div className="flex flex-col">
                        <strong className="text-sm text-gray-200">Connect Wallet</strong>
                        <span className="text-[11px] text-gray-500 leading-tight mt-1">Link your Phantom or Backpack wallet to enter the game.</span>
                    </div>
                </li>
                <li className="flex gap-4 group">
                    <span className="bg-gray-800 border border-green-500/30 text-green-400 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs shrink-0 group-hover:bg-green-600 group-hover:text-white transition-colors">2</span>
                    <div className="flex flex-col">
                        <strong className="text-sm text-gray-200">Deposit Funds</strong>
                        <span className="text-[11px] text-gray-500 leading-tight mt-1">Add SOL to your in-game balance via the Cashier panel.</span>
                    </div>
                </li>
                <li className="flex gap-4 group">
                    <span className="bg-gray-800 border border-blue-500/30 text-blue-400 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">3</span>
                    <div className="flex flex-col">
                        <strong className="text-sm text-gray-200">Drop Blocks</strong>
                        <span className="text-[11px] text-gray-500 leading-tight mt-1">Select a Zone (Z1-Z8) and drop your block. Watch out for physics!</span>
                    </div>
                </li>
                <li className="flex gap-4 group">
                    <span className="bg-gray-800 border border-yellow-500/30 text-yellow-400 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-xs shrink-0 group-hover:bg-yellow-600 group-hover:text-white transition-colors">4</span>
                    <div className="flex flex-col">
                        <strong className="text-sm text-gray-200">Survive & Earn</strong>
                        <span className="text-[11px] text-gray-500 leading-tight mt-1">Earn passive SOL every second your block stays on the tower.</span>
                    </div>
                </li>
            </ul>

            <div className="mt-8 p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-400">💡 Pro Tip:</span>
                </div>
                <p className="text-[10px] text-blue-200/70 leading-relaxed">
                    Events like <span className="text-red-400">Earthquakes</span> and <span className="text-purple-400">Black Holes</span> are triggered by the blockchain hash. They are unpredictable!
                </p>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-[1200px] items-center">
        {/* HEADER */}
        <div className="w-full flex justify-between items-center mb-2 px-4 bg-gray-900/50 p-2 rounded-xl border border-gray-800 backdrop-blur-sm">
             <div className="flex flex-col">
                 <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">Casino Block Tower</h1>
                 <div className="flex gap-4 text-xs mt-1 font-mono">
                    <span className="text-gray-400">Invested: <span className="text-red-400">-{totalInvertido.toFixed(4)}</span></span>
                    <span className="text-gray-400">Earned: <span className="text-green-400">+{totalGanado.toFixed(4)}</span></span>
                    <span className="text-gray-400">Net: <span className={`font-bold ${neto >= 0 ? 'text-green-400' : 'text-red-500'}`}>{neto >= 0 ? '+' : ''}{neto.toFixed(4)}</span></span>
                 </div>
             </div>
             <div className="flex flex-col items-center">
                 <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">🔥 Shared Pot 🔥</div>
                 <div className="text-3xl font-black text-yellow-400 drop-shadow-lg tabular-nums">
                     {pozoComun.toFixed(4)} <span className="text-sm text-yellow-600">SOL</span>
                 </div>
                 <div className="text-[9px] text-gray-500">Payout 1% per sec</div>
             </div>
             <div className="flex gap-4 items-center">
                <button onClick={toggleAudio} className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${audioEnabled ? 'bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-gray-800 border-gray-600 text-gray-500 hover:border-gray-400'}`}>
                    {audioEnabled ? "🔊" : "🔇"}
                </button>
                {audioEnabled && (
                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 p-2 rounded-lg">
                    <span className="text-[10px] text-gray-400">Volume</span>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.05" 
                        value={masterVolume} 
                        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                </div>
                )}
                <div className="bg-gray-800 border border-green-500 px-4 py-1 rounded-lg shadow-lg flex items-center gap-2">
                    <span className="text-xs text-gray-400">BALANCE:</span>
                    <span className="text-xl font-mono font-bold text-green-400">{saldoBilleteraJuego.toFixed(4)}</span>
                </div>
                <WalletMultiButton />
             </div>
        </div>

        <div className="relative">
             <div className="absolute top-10 w-full flex justify-center z-10 pointer-events-none">
                {eventosActivos.length > 0 && (<div className="px-6 py-2 rounded-full border bg-red-900/90 border-red-500 text-white font-bold animate-pulse shadow-xl">⚠️ {eventosActivos.join(" + ")}</div>)}
             </div>
         <GameCanvas ref={gameRef} onReportSurvival={setRankingSupervivencia} masterVolume={masterVolume} audioEnabled={audioEnabled} />
        </div>

        {/* CHAT BOX (Ancho Completo 1200px) */}
        <div className="w-[1200px] mt-2">
            <ChatBox usuario={isRegistered ? nombreUsuario : "Anon"} />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-80 flex flex-col gap-4 h-screen overflow-y-auto pb-10 sticky top-0">
        
        {!isRegistered && (
            <div className="bg-purple-900 border border-purple-500 p-4 rounded-xl shadow-lg animate-pulse">
                <h2 className="text-sm font-bold text-white mb-2 uppercase">📝 Registration</h2>
                <p className="text-[10px] text-gray-300 mb-2">Choose a unique username to start playing.</p>
                <input type="text" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} className="w-full bg-black border border-purple-400 rounded px-2 py-1 text-white font-bold mb-2 text-xs" placeholder="Username..." />
                <button onClick={registrarUsuario} className="w-full py-2 bg-purple-600 hover:bg-purple-500 rounded text-xs font-bold text-white shadow-lg">REGISTER & PLAY</button>
            </div>
        )}

        <div className={`transition-opacity duration-500 ${isRegistered ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="bg-gray-900 border border-blue-600 p-4 rounded-xl shadow-lg relative overflow-hidden mb-4">
                <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-red-500 to-yellow-500 transition-all duration-100 ease-linear" style={{ width: `${(tiempoRestanteCooldown / 15) * 100}%` }} />
                <h2 className="text-sm font-bold text-white mb-3 uppercase flex justify-between items-center">
                    🏗️ Drop Block
                    {tiempoRestanteCooldown > 0 && <span className="text-[10px] text-red-400 font-bold animate-pulse">HOT 🔥 x{penaltyCount}</span>}
                </h2>
                <div className="grid grid-cols-4 gap-1 mb-4">
                    {[0,1,2,3,4,5,6,7].map(z => (<button key={z} onClick={() => setZonaElegida(z)} className={`py-1 text-[10px] font-bold rounded border ${zonaElegida === z ? 'bg-yellow-600 border-yellow-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-500'}`}>Z{z+1}</button>))}
                </div>
                <button onClick={lanzarBloque} disabled={saldoBilleteraJuego < costoActualBloque} className={`w-full py-4 rounded-lg font-bold text-lg shadow-xl transition-all active:scale-95 flex flex-col items-center justify-center border-b-4 ${saldoBilleteraJuego >= costoActualBloque ? (tiempoRestanteCooldown > 0 ? "bg-orange-600 border-orange-800 hover:bg-orange-500" : "bg-blue-600 border-blue-800 hover:bg-blue-500") : "bg-gray-700 border-gray-800 cursor-not-allowed text-gray-500"}`}>
                    <span>DROP BLOCK</span>
                    <span className="text-xs font-mono opacity-80 mt-1">Cost: {costoActualBloque.toFixed(4)} SOL</span>
                </button>
            </div>

            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-lg mb-4">
                <h2 className="text-sm font-bold text-green-400 uppercase mb-3 border-b border-gray-700 pb-2">🏦 Cashier</h2>
                <div className="mb-4">
                    <label className="text-xs text-gray-400 mb-1 block">Deposit Amount (SOL):</label>
                    <div className="flex gap-2 mb-2">
                        <input type="number" step="0.1" min="0" value={montoDeposito} onChange={(e) => setMontoDeposito(e.target.value)} className="w-full bg-gray-800 border border-green-700 rounded px-2 py-1 text-white font-mono text-sm focus:outline-none focus:border-green-500" placeholder="0.00" />
                    </div>
                    <button onClick={depositarFondos} disabled={loading} className="w-full py-2 bg-green-700 hover:bg-green-600 rounded text-xs font-bold text-white shadow-lg">{loading ? "Processing..." : "DEPOSIT FUNDS"}</button>
                </div>
                <button onClick={retirarFondos} disabled={saldoBilleteraJuego <= 0} className="w-full py-2 border border-red-500 text-red-400 hover:bg-red-900/20 rounded text-xs font-bold">WITHDRAW ALL ({saldoBilleteraJuego.toFixed(4)})</button>
                {mensaje && <p className="mt-2 text-xs text-center text-blue-300 bg-blue-900/20 p-1 rounded animate-in fade-in zoom-in duration-300">{mensaje}</p>}
                <button onClick={inicializarJugador} className="w-full mt-2 text-[9px] text-gray-600 underline text-center">Create Account (If new)</button>
            </div>

            <div className="bg-gray-900 border border-purple-500 p-4 rounded-xl shadow-lg mb-4">
                <h2 className="text-sm font-bold text-white mb-2">🎨 Skin</h2>
                <div className="flex mb-2 text-xs border-b border-gray-700"> <button onClick={() => setModoPersonalizacion('color')} className={`flex-1 py-1 ${modoPersonalizacion === 'color' ? 'text-purple-400' : 'text-gray-500'}`}>Color</button> <button onClick={() => setModoPersonalizacion('imagen')} className={`flex-1 py-1 ${modoPersonalizacion === 'imagen' ? 'text-purple-400' : 'text-gray-500'}`}>NFT</button> </div>
                {modoPersonalizacion === 'color' ? (
                    <div className="flex gap-2"> <input type="color" value={colorElegido} onChange={(e) => setColorElegido(e.target.value)} className="h-6 w-full bg-transparent cursor-pointer" /> <input type="text" maxLength={3} value={letraElegida} onChange={(e) => setLetraElegida(e.target.value.toUpperCase())} className="w-12 bg-gray-800 border border-gray-600 rounded text-center font-bold text-xs" /> </div>
                ) : (
                    <div className="space-y-2">
                        <button onClick={cargarMisNFTs} disabled={cargandoNFTs} className="w-full py-1 bg-blue-600 hover:bg-blue-500 rounded text-[10px] font-bold text-white transition-colors">
                            {cargandoNFTs ? "SCANNING WALLET..." : "📂 LOAD MY NFTs"}
                        </button>
                        {misNFTs.length === 0 && !cargandoNFTs && <p className="text-[9px] text-gray-500 text-center italic">No NFTs found or not loaded.</p>}
                        <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto scrollbar-thin">
                            {misNFTs.map(nft => (
                                <img key={nft.mint} src={nft.image} onClick={() => setUrlImagen(nft.image)} className={`w-full aspect-square object-cover rounded cursor-pointer border-2 transition-all ${urlImagen === nft.image ? 'border-green-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow-lg flex-grow overflow-hidden flex flex-col">
                <h2 className="text-yellow-400 font-bold text-sm mb-2 border-b border-gray-700 pb-1">🏆 Live Survivors</h2>
                <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                    {rankingSupervivencia.slice(0, 10).map((b, i) => (
                        <div key={b.id} className="bg-gray-800 p-2 rounded flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2"> 
                                <span className="font-bold text-gray-500">#{i+1}</span> 
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: b.color }}></div> 
                                <span className="text-white font-bold truncate max-w-[80px]">
                                    {b.userName || (b.owner === publicKey?.toString() ? "YOU" : "Player")}
                                </span> 
                            </div> 
                            <span className="text-yellow-400 font-mono">{b.tiempoVida}s</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
        
        {/* DEV TOOLS PANEL */}
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl shadow-lg mt-4">
            <h2 className="text-sm font-bold text-red-400 mb-2 uppercase">🛠️ Auto-Test</h2>
            <button onClick={() => setSimulacionActiva(!simulacionActiva)} className={`w-full py-2 rounded text-xs font-bold border ${simulacionActiva ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-transparent text-red-400 border-red-500'}`}>{simulacionActiva ? "⏹ STOP SIMULATION" : "▶ START STRESS TEST"}</button>
            <p className="text-[9px] text-gray-400 mt-2">Spawns bots & monitors infinite winners.</p>
        </div>

      </div>
    </main>
  );
}