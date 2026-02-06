'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { sdk } from '@farcaster/miniapp-sdk';
import Squares from '@/components/Squares';
import dynamic from 'next/dynamic';
import Lenis from 'lenis';

const Silk = dynamic(() => import('@/components/Silk'), { ssr: false });

export default function LandingPage() {

  // Platform preview scroll stack
  const platformRef = useRef<HTMLDivElement>(null);
  const [platformProgress, setPlatformProgress] = useState(0);
  const [platformPosition, setPlatformPosition] = useState<'before' | 'fixed' | 'after'>('before');

  // Text scramble effect for scroll stack text
  const platformTexts = [
    { title: 'Professional Trading Interface', subtitle: 'Experience institutional-grade trading tools in a decentralized environment' },
    { title: 'Choose Your Market', subtitle: 'Pick any coin you want to trade from a wide selection of markets' },
    { title: 'Tap to Trade', subtitle: 'Tap for position, tap for profit — fast and simple trading at your fingertips' },
  ];
  const scramblePhaseRef = useRef(-1);
  const [displayTitle, setDisplayTitle] = useState('');
  const scrambleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Smooth scroll with Lenis
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  // Text scramble - run on every platformProgress change, but only act on phase change
  const scrambleChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const startScramble = (phase: number) => {
    if (scrambleRef.current) clearInterval(scrambleRef.current);

    const targetTitle = platformTexts[phase].title;
    let tick = 0;
    const totalTicks = 15;

    scrambleRef.current = setInterval(() => {
      tick++;
      const progress = tick / totalTicks;

      const resolvedTitle = Math.floor(progress * targetTitle.length);
      setDisplayTitle(
        targetTitle.split('').map((ch, i) => {
          if (i < resolvedTitle) return ch;
          if (ch === ' ') return ' ';
          return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
        }).join('')
      );

      if (tick >= totalTicks) {
        setDisplayTitle(targetTitle);
        if (scrambleRef.current) clearInterval(scrambleRef.current);
        scrambleRef.current = null;
      }
    }, 30);
  };

  // Check phase on every progress change (no cleanup that kills the interval)
  const currentPhase = platformProgress < 0.3 ? 0 : platformProgress < 0.65 ? 1 : 2;
  if (currentPhase !== scramblePhaseRef.current) {
    scramblePhaseRef.current = currentPhase;
    startScramble(currentPhase);
  }

  // Platform preview scroll progress (JS-based fixed positioning)
  useEffect(() => {
    const handlePlatformScroll = () => {
      if (!platformRef.current) return;
      const rect = platformRef.current.getBoundingClientRect();
      const scrollSpace = platformRef.current.offsetHeight - window.innerHeight;
      if (scrollSpace <= 0) return;

      if (rect.top > 0) {
        // Haven't reached section yet
        setPlatformPosition('before');
        setPlatformProgress(0);
      } else if (rect.bottom <= window.innerHeight) {
        // Scrolled past section
        setPlatformPosition('after');
        setPlatformProgress(1);
      } else {
        // Inside the section - fix content
        setPlatformPosition('fixed');
        const progress = Math.max(0, Math.min(1, -rect.top / scrollSpace));
        setPlatformProgress(progress);
      }
    };

    window.addEventListener('scroll', handlePlatformScroll, { passive: true });
    handlePlatformScroll();
    return () => window.removeEventListener('scroll', handlePlatformScroll);
  }, []);


  return (
    <div className="w-full bg-black text-white overflow-x-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 w-full z-30 p-8 md:px-12">
        <nav className="flex items-center justify-between w-full">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/tethra-logo.png"
              alt="Tethra Finance Logo"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="font-semibold text-xl">Tethra Finance</span>
          </Link>

          

          <Link
            href="/trade"
            className="font-semibold text-white py-2 px-6 rounded-lg
                       bg-cyan-700 hover:bg-cyan-800
                       transition-all duration-300 ease-in-out
                       hover:shadow-lg hover:shadow-cyan-500/30"
          >
            Launch App
          </Link>
        </nav>
      </header>

      {/* Hero Section with Layered Text */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0">
          <Silk
            color="#06b6d4"
            speed={5}
            scale={1}
            noiseIntensity={1.5}
            rotation={0}
          />
        </div>
        <div className="absolute inset-0">
          <Squares
            direction="left"
            speed={0.3}
            squareSize={55}
            borderColor="#333"
            hoverFillColor="#0a1a3a"
            clickImage="/tethra-polos.png"
          />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-black z-10 pointer-events-none"></div>
      </section>

      {/* Platform Preview Section - Scroll Stack */}
      <section id="features" ref={platformRef} className="relative z-20 bg-black" style={{ height: '300vh' }}>
        <div
          className="w-full min-h-screen flex flex-col justify-center px-4 py-20"
          style={
            platformPosition === 'fixed'
              ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20 }
              : platformPosition === 'after'
                ? { position: 'absolute', bottom: 0, left: 0, right: 0 }
                : { position: 'relative' }
          }
        >
          <div className="container mx-auto max-w-7xl">
            {/* Text - scramble title + fade subtitle */}
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-4 font-mono">
                {displayTitle}
              </h2>
              <div className="relative h-8">
                {platformTexts.map((text, i) => (
                  <p
                    key={i}
                    className="text-xl text-gray-400 absolute inset-0 transition-opacity duration-500"
                    style={{ opacity: currentPhase === i ? 1 : 0 }}
                  >
                    {text.subtitle}
                  </p>
                ))}
              </div>
            </div>

            {/* Images stack */}
            <div className="relative">
              {/* Base image - taptotrade */}
              <div
                className="relative rounded-xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20"
                style={{
                  filter: platformProgress >= 0.3 && platformProgress < 0.65 ? 'blur(3px) brightness(0.7)' : 'blur(0px) brightness(1)',
                  transition: 'filter 0.6s ease-out',
                }}
              >
                <Image
                  src="/taptotrade.png"
                  alt="Tap to Trade"
                  width={1920}
                  height={1080}
                  className="w-full h-auto"
                  priority
                />
              </div>

              {/* Overlay image 2 - menucoin, slides in from top-left */}
              <div
                className="absolute top-[7%] left-[11%] w-[45%]"
                style={{
                  opacity: platformProgress >= 0.3 && platformProgress < 0.65 ? 1 : 0,
                  transform: platformProgress >= 0.3 && platformProgress < 0.65
                    ? 'translate(0, 0) scale(1)'
                    : platformProgress < 0.3
                      ? 'translate(-60px, 40px) scale(0.3)'
                      : 'translate(-60px, 40px) scale(0.3)',
                  transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="rounded-xl overflow-hidden shadow-2xl shadow-cyan-500/30">
                  <Image
                    src="/menucoin.png"
                    alt="Choose Your Market"
                    width={800}
                    height={600}
                    className="w-full h-auto"
                  />
                </div>
              </div>

              {/* Overlay image 3 - taptotrademenu, slides in from top-left (smaller) */}
              <div
                className="absolute top-[7%] left-[0%] w-[12%]"
                style={{
                  opacity: platformProgress >= 0.65 ? 1 : 0,
                  transform: platformProgress >= 0.65
                    ? 'translate(0, 0) scale(1)'
                    : 'translate(-60px, 40px) scale(0.3)',
                  transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="rounded-full overflow-hidden shadow-2xl shadow-cyan-500/30 aspect-square">
                  <Image
                    src="/taptotrademenu.png"
                    alt="Tap to Trade Menu"
                    width={800}
                    height={600}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Coins Section - Marquee */}
      <section
        id="supported-coins"
        className="relative py-20 bg-black overflow-hidden"
      >
        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl">
            <span className="text-white">Supported </span>
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Coins</span>
          </h2>
        </div>

        {/* Marquee Container */}
        <div className="relative overflow-hidden group/marquee">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

          <div
            className="flex w-max group-hover/marquee:[animation-play-state:paused]"
            style={{ animation: 'marqueeScroll 30s linear infinite' }}
          >
            {/* Coin cards - duplicated for seamless loop */}
            {[...Array(2)].map((_, setIndex) => (
              <div key={setIndex} className="flex shrink-0">
                {[
                  { name: 'AAVE', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png' },
                  { name: 'ARB', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
                  { name: 'AVAX', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png' },
                  { name: 'BNB', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png' },
                  { name: 'BTC', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png' },
                  { name: 'DOGE', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png' },
                  { name: 'ETH', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
                  { name: 'LINK', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png' },
                  { name: 'SOL', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png' },
                  { name: 'XRP', logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ripple/info/logo.png' },
                ].map((coin) => (
                  <div
                    key={coin.name}
                    className="flex flex-col items-center gap-3 bg-transparent rounded-xl py-5 border border-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer w-[200px] mx-3 shrink-0"
                  >
                    <img
                      src={coin.logo}
                      alt={coin.name}
                      className="w-12 h-12 rounded-full"
                    />
                    <span className="text-white text-sm font-medium">{coin.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Contract Code Section */}
      <section
        id="smart-contracts"
        className="relative py-20 px-6 sm:px-15 bg-black overflow-hidden"
      >
        <div className="container mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - VS Code Style Editor */}
            <div className="relative">
              {/* VS Code Window */}
              <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
                {/* Title Bar */}
                <div className="bg-[#323233] px-4 py-2 flex items-center justify-between border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
                    </div>
                    <span className="text-gray-400 text-sm ml-4">OneTapProfit.sol</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 text-gray-500">
                      <svg fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Tab Bar */}
                <div className="bg-[#252526] px-2 py-1 flex items-center gap-2 border-b border-gray-800">
                  <div className="bg-[#1e1e1e] px-3 py-1 rounded-t text-gray-300 text-xs flex items-center gap-2 border-t-2 border-cyan-500">
                    <span>OneTapProfit.sol</span>
                    <span className="text-gray-500">×</span>
                  </div>
                </div>

                {/* Code Editor */}
                <div className="bg-[#1e1e1e] p-4 font-mono text-xs md:text-sm overflow-x-auto">
                  <pre className="text-gray-300">
                    <code>
                      {`1  // SPDX-License-Identifier: MIT
2  pragma solidity ^0.8.20;
3
4  import "@openzeppelin/contracts/access/AccessControl.sol";
5  import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
6  import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
7
8  /**
9   * @title OneTapProfit
10  * @notice Binary option-style trading
11  * @dev Users tap grid, pay USDC, win if price hits
12  */
13 contract OneTapProfit is AccessControl {
14
15    IERC20 public immutable usdc;
16    ITreasuryManager public treasuryManager;
17
18    uint256 public constant GRID_DURATION = 10;
19    uint256 public constant BASE_MULTIPLIER = 110;
20    uint256 public constant TRADING_FEE_BPS = 5;
21
22    mapping(uint256 => Bet) public bets;
23
24    function `}
                      <span className="text-cyan-400">placeBet</span>
                      {`(
25       uint256 targetPrice,
26       uint256 amount
27    ) external {
28       // Tap to profit logic
29    }
30 }`}
                    </code>
                  </pre>
                </div>

                {/* Status Bar */}
                <div className="bg-[#007acc] px-4 py-1 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4 text-white">
                    <span>Solidity</span>
                    <span>UTF-8</span>
                    <span>LF</span>
                  </div>
                  <div className="text-white">
                    <span>Ln 24, Col 14</span>
                  </div>
                </div>
              </div>

              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 blur-2xl -z-10"></div>
            </div>

            {/* Right Side - Description */}
            <div className="space-y-6">
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Smart Contracts
              </h2>

              <p className="text-xl text-gray-300 leading-relaxed">
                Built with security and efficiency in mind. Our smart contracts power the entire
                trading ecosystem.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Audited & Secure</h3>
                    <p className="text-gray-400">Thoroughly tested and audited smart contracts</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Gas Optimized</h3>
                    <p className="text-gray-400">
                      Minimal transaction costs for maximum efficiency
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 group">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Non-Custodial</h3>
                    <p className="text-gray-400">You always maintain full control of your assets</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <a
                  href="https://github.com/Tethra-Dex"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white font-semibold rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/30"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 mt-20">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/tethra-logo.png"
                alt="Tethra Finance Logo"
                width={24}
                height={24}
                className="w-6 h-6"
              />
              <span className="text-gray-400">© 2025 Tethra Finance. All rights reserved.</span>
            </div>
            <div className="flex gap-6 text-gray-400">
              <span className="hover:text-white transition-colors">Twitter</span>
              <span className="hover:text-white transition-colors">Discord</span>
              <Link
                href="https://github.com/Tethra-Dex"
                target="_blank"
                className="hover:text-white transition-colors"
              >
                GitHub
              </Link>
              <span className="hover:text-white transition-colors">Docs</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Animations */}
      <style jsx global>{`
        /* Smooth scroll */
        html {
          scroll-behavior: smooth;
        }

        /* Hide scrollbar for Chrome, Safari and Opera */
        body::-webkit-scrollbar {
          width: 8px;
        }

        body::-webkit-scrollbar-track {
          background: #000;
        }

        body::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #06b6d4, #10b981);
          border-radius: 4px;
        }

        body::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #0891b2, #059669);
        }

        @keyframes gradientShift {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1) rotate(0deg);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1) rotate(5deg);
          }
        }

        @keyframes gridMove {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(50px, 50px);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes floatSlow {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, -40px) rotate(90deg);
          }
          50% {
            transform: translate(-30px, -20px) rotate(180deg);
          }
          75% {
            transform: translate(-10px, 30px) rotate(270deg);
          }
        }

        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes marqueeScroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }

        /* Enhance existing animations */
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        /* Scroll-based animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        /* Glow effect */
        @keyframes glow {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(6, 182, 212, 0.6), 0 0 60px rgba(16, 185, 129, 0.4);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
