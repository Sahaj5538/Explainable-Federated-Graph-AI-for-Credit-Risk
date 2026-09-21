import React, { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// VERTEX intro - cinematic, Netflix-style.
//
// A single silver "V" blooms out of black (blur + scale, like the Netflix N),
// the remaining letters settle in one by one, a light sweeps across the
// wordmark, the subtitle fades up - then the whole lockup scales forward and
// dissolves into the live dashboard behind it.
//
// SMOOTHNESS: every element animates ONLY transform / opacity / filter, so the
// browser composites the whole intro on the GPU. There is no canvas loop and
// no per-frame React state (the old design re-rendered React 60x/second -
// that was the lag). React state changes exactly once (the exit).
//
// Timeline: 0.0 V blooms · 0.6-1.1 letters · 1.5-2.6 sweep · 1.9 rule ·
//           2.3 subtitle · 2.8 tag · 4.3 zoom-out exit · 5.5 done
// ---------------------------------------------------------------------------

const LETTERS = ['E', 'R', 'T', 'E', 'X']

export default function IntroAnimation({ onComplete }) {
  const [exit, setExit] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('vertex_intro_seen')) {
      onComplete()
      return
    }
    const t1 = setTimeout(() => setExit(true), 4300)
    const t2 = setTimeout(() => {
      sessionStorage.setItem('vertex_intro_seen', 'true')
      onComplete()
    }, 5500)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onComplete])

  return (
    <div className={`intro2${exit ? ' intro2-exit' : ''}`} aria-hidden="true">
      <div className="intro2-lockup">
        <div className="intro2-word">
          <span className="intro2-v">V</span>
          {LETTERS.map((l, i) => (
            <span key={i} className="intro2-l" style={{ animationDelay: `${0.6 + i * 0.11}s` }}>
              {l}
            </span>
          ))}
          <span className="intro2-sweep" />
        </div>
        <div className="intro2-rule" />
        <div className="intro2-sub">Graph Credit Intelligence</div>
        <div className="intro2-tag">Privacy-Preserving AI for Decentralized Finance</div>
      </div>
    </div>
  )
}
