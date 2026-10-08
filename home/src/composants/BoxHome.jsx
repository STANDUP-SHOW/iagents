// The white Box Home, drawn rather than photographed: no product photo exists
// yet, and a rendering of someone else's mini-PC would promise a device we
// have not chosen. White and light aluminium (MASTER §4, §13).
export default function BoxHome({ titre = 'La Box Home, blanche et aluminium clair', taille = 360 }) {
  return (
    <svg className="box-home" viewBox="0 0 360 260" width={taille} height={(taille * 260) / 360} role="img" aria-label={titre}>
      <defs>
        <linearGradient id="bh-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EEF0F2" />
        </linearGradient>
        <linearGradient id="bh-dessus" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F3F4F5" />
        </linearGradient>
        <linearGradient id="bh-alu" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9CED4" />
          <stop offset=".5" stopColor="#E6E9EC" />
          <stop offset="1" stopColor="#C3C8CE" />
        </linearGradient>
        <radialGradient id="bh-ombre" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#1F2A37" stopOpacity=".16" />
          <stop offset="1" stopColor="#1F2A37" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bh-lueur" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#76CAE9" stopOpacity=".9" />
          <stop offset="1" stopColor="#76CAE9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="180" cy="228" rx="150" ry="18" fill="url(#bh-ombre)" />
      {/* top */}
      <rect x="72" y="62" width="216" height="44" rx="20" fill="url(#bh-dessus)" stroke="#E2E5E8" />
      {/* front */}
      <rect x="60" y="84" width="240" height="124" rx="22" fill="url(#bh-face)" stroke="#DDE1E5" />
      {/* aluminium base band */}
      <rect x="60" y="192" width="240" height="16" rx="8" fill="url(#bh-alu)" />
      {/* speaker grille */}
      {Array.from({ length: 5 }).map((_, i) => (
        <circle key={i} cx={150 + i * 15} cy={160} r="2.4" fill="#D3D7DC" />
      ))}
      {/* status light */}
      <circle cx="180" cy="118" r="18" fill="url(#bh-lueur)" />
      <circle cx="180" cy="118" r="5" fill="#76CAE9" />
      <image href="/icone.svg" x="88" y="104" width="30" height="25" />
    </svg>
  );
}
