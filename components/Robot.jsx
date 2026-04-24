// Robot investigator — sleek white chassis with blue accents + magnifier
// Inspired by the reference: rounded white body, dark visor, glowing eyes.

function RobotInvestigator({ state = 'idle', progress = 0 }) {
  const scanning = state === 'scanning';
  const done = state === 'done';
  const eye = done ? '#70DC51' : '#56A3BC';

  return (
    <svg viewBox="0 0 220 240" width="190" height="200" className="robot-svg" aria-label="Robot investigator">
      <defs>
        <linearGradient id="chassis" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF"/>
          <stop offset="60%" stopColor="#F2F4F7"/>
          <stop offset="100%" stopColor="#D7DDE5"/>
        </linearGradient>
        <linearGradient id="chassisSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D7DDE5"/>
          <stop offset="100%" stopColor="#B7C1CC"/>
        </linearGradient>
        <radialGradient id="visor" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#1A2230"/>
          <stop offset="100%" stopColor="#05080D"/>
        </radialGradient>
        <radialGradient id="glassG" cx="0.35" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)"/>
          <stop offset="60%" stopColor="rgba(200,225,240,0.35)"/>
          <stop offset="100%" stopColor="rgba(86,163,188,0.15)"/>
        </radialGradient>
        <linearGradient id="blueAcc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DC3DA"/>
          <stop offset="100%" stopColor="#56A3BC"/>
        </linearGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="110" cy="222" rx="70" ry="5" fill="rgba(0,0,0,0.12)"/>

      {/* Legs */}
      <rect x="74" y="186" width="18" height="24" rx="4" fill="url(#chassisSide)"/>
      <rect x="128" y="186" width="18" height="24" rx="4" fill="url(#chassisSide)"/>
      <ellipse cx="83" cy="212" rx="16" ry="5" fill="#2D3440"/>
      <ellipse cx="137" cy="212" rx="16" ry="5" fill="#2D3440"/>
      {/* knee rings */}
      <rect x="72" y="182" width="22" height="5" rx="2" fill="#56A3BC"/>
      <rect x="126" y="182" width="22" height="5" rx="2" fill="#56A3BC"/>

      {/* Torso */}
      <path d="M 70 112 Q 70 104 78 104 L 142 104 Q 150 104 150 112 L 152 180 Q 152 188 144 188 L 76 188 Q 68 188 68 180 Z"
            fill="url(#chassis)" stroke="#B7C1CC" strokeWidth="1"/>
      {/* Torso side shade */}
      <path d="M 138 104 L 150 112 L 152 180 L 144 188 L 138 188 Z" fill="url(#chassisSide)" opacity="0.7"/>
      {/* Chest plate */}
      <rect x="86" y="122" width="48" height="36" rx="4" fill="#EEF2F6" stroke="#B7C1CC"/>
      <circle cx="110" cy="140" r="10" fill="url(#blueAcc)">
        {scanning && <animate attributeName="opacity" values="1;0.55;1" dur="1.2s" repeatCount="indefinite"/>}
      </circle>
      <circle cx="110" cy="140" r="4" fill="#E8F5FB"/>
      {/* chest status lights */}
      <circle cx="92" cy="170" r="2.5" fill="#70DC51"/>
      <circle cx="100" cy="170" r="2.5" fill="#F5B510"/>
      <circle cx="108" cy="170" r="2.5" fill={eye}>
        {scanning && <animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite"/>}
      </circle>
      <rect x="116" y="168" width="14" height="4" fill="#D7DDE5"/>

      {/* Neck */}
      <rect x="100" y="94" width="20" height="14" rx="3" fill="url(#chassisSide)"/>
      <rect x="98" y="100" width="24" height="3" fill="#56A3BC"/>

      {/* Head — rounded helmet */}
      <path d="M 70 58 Q 70 28 110 28 Q 150 28 150 58 L 150 82 Q 150 96 136 96 L 84 96 Q 70 96 70 82 Z"
            fill="url(#chassis)" stroke="#B7C1CC" strokeWidth="1"/>
      {/* Helmet top highlight */}
      <path d="M 78 42 Q 110 26 142 42" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3" opacity="0.7"/>
      {/* Visor */}
      <path d="M 82 54 Q 82 46 92 46 L 128 46 Q 138 46 138 54 L 138 76 Q 138 84 128 84 L 92 84 Q 82 84 82 76 Z"
            fill="url(#visor)" stroke="#2D3440" strokeWidth="1"/>
      {/* Eyes */}
      <circle cx="98" cy="66" r="5" fill={eye}>
        {scanning && <animate attributeName="r" values="5;3.5;5" dur="1.4s" repeatCount="indefinite"/>}
      </circle>
      <circle cx="98" cy="64" r="1.8" fill="#E8F5FB"/>
      <circle cx="122" cy="66" r="5" fill={eye}>
        {scanning && <animate attributeName="r" values="5;3.5;5" dur="1.4s" repeatCount="indefinite" begin="0.3s"/>}
      </circle>
      <circle cx="122" cy="64" r="1.8" fill="#E8F5FB"/>
      {/* Visor reflection */}
      <path d="M 86 52 Q 96 48 104 52" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
      {/* Ear ports */}
      <rect x="66" y="62" width="6" height="16" rx="2" fill="#56A3BC"/>
      <rect x="148" y="62" width="6" height="16" rx="2" fill="#56A3BC"/>

      {/* Left arm (robot's right, viewer's left) — hand on hip */}
      <g>
        <rect x="54" y="112" width="18" height="40" rx="6" fill="url(#chassisSide)"/>
        <circle cx="63" cy="112" r="9" fill="#EEF2F6" stroke="#B7C1CC"/>
        <circle cx="63" cy="152" r="7" fill="#56A3BC"/>
        <rect x="50" y="158" width="18" height="18" rx="4" fill="#EEF2F6" stroke="#B7C1CC"/>
      </g>

      {/* Right arm — holding magnifier, extended forward */}
      <g>
        {scanning && (
          <animateTransform attributeName="transform" type="rotate"
            values="-3 150 116; 4 150 116; -3 150 116"
            dur="2.6s" repeatCount="indefinite"/>
        )}
        {/* shoulder */}
        <circle cx="150" cy="112" r="9" fill="#EEF2F6" stroke="#B7C1CC"/>
        {/* upper arm */}
        <rect x="144" y="112" width="18" height="30" rx="6" fill="url(#chassisSide)"/>
        {/* elbow */}
        <circle cx="153" cy="142" r="7" fill="#56A3BC"/>
        {/* forearm — angled toward magnifier */}
        <rect x="150" y="140" width="16" height="38" rx="5" fill="url(#chassisSide)"
              transform="rotate(-28 158 159)"/>
        {/* wrist */}
        <circle cx="178" cy="130" r="6" fill="#EEF2F6" stroke="#B7C1CC"/>
        {/* hand gripping handle */}
        <rect x="173" y="122" width="14" height="14" rx="3" fill="#EEF2F6" stroke="#B7C1CC"/>

        {/* Magnifier handle */}
        <rect x="180" y="104" width="7" height="26" rx="3" fill="#2D3440"
              transform="rotate(35 183 117)"/>
        {/* Magnifier ring */}
        <circle cx="196" cy="82" r="26" fill="none" stroke="#2D3440" strokeWidth="5"/>
        <circle cx="196" cy="82" r="22" fill="url(#glassG)"/>
        {/* glass glint */}
        <ellipse cx="188" cy="74" rx="8" ry="4" fill="rgba(255,255,255,0.6)" transform="rotate(-30 188 74)"/>
      </g>

      {/* antenna */}
      <line x1="110" y1="28" x2="110" y2="14" stroke="#56A3BC" strokeWidth="2.5"/>
      <circle cx="110" cy="11" r="3.5" fill="#A01441">
        {scanning && <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite"/>}
      </circle>

      {/* progress ring on chest */}
      <circle cx="110" cy="140" r="14" fill="none" stroke="#E8F5FB" strokeWidth="2"/>
      <circle cx="110" cy="140" r="14" fill="none" stroke={eye} strokeWidth="2"
        strokeDasharray={2 * Math.PI * 14}
        strokeDashoffset={2 * Math.PI * 14 * (1 - Math.min(1, progress))}
        transform="rotate(-90 110 140)" strokeLinecap="round"/>
    </svg>
  );
}

window.RobotInvestigator = RobotInvestigator;
