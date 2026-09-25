/**
 * Figure 1: the registry drawn as a single integrated circuit.
 *
 * Inputs on the left are what a garage signs; outputs on the right are what a
 * buyer and a garage get back. The block that is filled red is the one the
 * product exists for - the mileage check - and the one red output is the
 * refusal it produces.
 */

const INPUTS = [
  { pin: "VIN", sub: "şasi numarası" },
  { pin: "KM", sub: "kilometre" },
  { pin: "TİP", sub: "işlem tipi" },
  { pin: "GÜN", sub: "servis tarihi" },
  { pin: "IPFS", sub: "fotoğraf · fatura" },
];

const OUTPUTS = [
  { pin: "dNFT", sub: "zincirde SVG" },
  { pin: "RAPOR", sub: "zaman çizelgesi" },
  { pin: "SKOR", sub: "0 – 100" },
  { pin: "GELİR", sub: "%30 · %70" },
  { pin: "RED", sub: "MileageRollback", alert: true },
];

const ROLES = ["USTA", "ALICI", "PLATFORM"];

const MONO = { fontFamily: "var(--font-mono)" } as const;
const LABEL = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  fontVariationSettings: '"wdth" 80',
} as const;

export function RegistrySchematic() {
  const top = 112;
  const step = 46;

  return (
    <figure className="m-0">
      <div className="fig-frame overflow-hidden">
        <svg
          viewBox="0 0 640 470"
          role="img"
          aria-labelledby="fig1-title"
          className="block h-auto w-full"
        >
          <title id="fig1-title">
            MonadDrive sicil şeması: şasi, kilometre, işlem tipi, tarih ve belge girişleri tek bir
            birime bağlı; çıkışlar dNFT, rapor, skor, gelir ve kilometre reddi.
          </title>

          {/* Engineering grid */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="#ecece7" strokeWidth="1" />
            </pattern>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill="#121212" />
            </marker>
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill="#c8102e" />
            </marker>
          </defs>
          <rect width="640" height="470" fill="url(#grid)" />

          <text x="18" y="30" fontSize="10.5" letterSpacing="1.2" fill="#3d3d3a" style={LABEL}>
            GİRİŞLER · usta imzalar
          </text>
          <text
            x="622"
            y="30"
            fontSize="10.5"
            letterSpacing="1.2"
            fill="#3d3d3a"
            textAnchor="end"
            style={LABEL}
          >
            ÇIKIŞLAR · alıcı ve servis okur
          </text>

          {/* Inputs */}
          {INPUTS.map((input, i) => {
            const y = top + i * step;
            return (
              <g key={input.pin}>
                <text x="186" y={y - 4} fontSize="12" textAnchor="end" fill="#121212" style={LABEL}>
                  {input.pin}
                </text>
                <text x="186" y={y + 11} fontSize="9.5" textAnchor="end" fill="#6a6a64" style={MONO}>
                  {input.sub}
                </text>
                <line
                  x1="194"
                  y1={y}
                  x2="236"
                  y2={y}
                  stroke="#121212"
                  strokeWidth="1.5"
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {/* The package */}
          <rect x="240" y="64" width="160" height="266" fill="#fff" stroke="#121212" strokeWidth="2" />
          <path d="M306 64a14 14 0 0 0 28 0" fill="#fff" stroke="#121212" strokeWidth="2" />
          <text x="320" y="104" fontSize="22" textAnchor="middle" fill="#121212" style={LABEL}>
            MDV-1
          </text>
          <text x="320" y="120" fontSize="9.5" textAnchor="middle" fill="#6a6a64" style={MONO}>
            sicil &quot;monaddrive&quot;
          </text>

          <g>
            <rect x="256" y="136" width="128" height="44" fill="#fff" stroke="#121212" strokeWidth="1.5" />
            <text x="266" y="154" fontSize="11" fill="#121212" style={LABEL}>
              KAYIT
            </text>
            <text x="266" y="170" fontSize="9" fill="#6a6a64" style={MONO}>
              yalnızca eklenir
            </text>
          </g>

          <g>
            <rect x="256" y="192" width="128" height="44" fill="#c8102e" />
            <text x="266" y="210" fontSize="11" fill="#fff" style={LABEL}>
              DOĞRULA
            </text>
            <text x="266" y="226" fontSize="9" fill="#fbe9ec" style={MONO}>
              km ≥ son km
            </text>
          </g>

          <g>
            <rect x="256" y="248" width="128" height="44" fill="#fff" stroke="#121212" strokeWidth="1.5" />
            <text x="266" y="266" fontSize="11" fill="#121212" style={LABEL}>
              SKOR
            </text>
            <text x="266" y="282" fontSize="9" fill="#6a6a64" style={MONO}>
              hasar · bakım tavanı
            </text>
          </g>

          <text x="320" y="316" fontSize="9" textAnchor="middle" fill="#6a6a64" style={MONO}>
            VehicleRegistry.sol
          </text>

          {/* Outputs */}
          {OUTPUTS.map((output, i) => {
            const y = top + i * step;
            const colour = output.alert ? "#c8102e" : "#121212";
            return (
              <g key={output.pin}>
                <line
                  x1="400"
                  y1={y}
                  x2="444"
                  y2={y}
                  stroke={colour}
                  strokeWidth="1.5"
                  strokeDasharray={output.alert ? "4 3" : undefined}
                  markerEnd={output.alert ? "url(#arrow-red)" : "url(#arrow)"}
                />
                <text x="454" y={y - 4} fontSize="12" fill={colour} style={LABEL}>
                  {output.pin}
                </text>
                <text x="454" y={y + 11} fontSize="9.5" fill={output.alert ? "#a50d25" : "#6a6a64"} style={MONO}>
                  {output.sub}
                </text>
              </g>
            );
          })}

          {/* The bus the three roles hang off */}
          <line x1="320" y1="330" x2="320" y2="370" stroke="#c8102e" strokeWidth="2" />
          <line x1="130" y1="370" x2="510" y2="370" stroke="#c8102e" strokeWidth="2" />
          {ROLES.map((role, i) => {
            const x = 150 + i * 170;
            return (
              <g key={role}>
                <line x1={x} y1="370" x2={x} y2="392" stroke="#c8102e" strokeWidth="2" />
                <rect x={x - 46} y="392" width="92" height="30" fill="#fff" stroke="#121212" strokeWidth="1.5" />
                <text x={x} y="412" fontSize="11" textAnchor="middle" fill="#121212" style={LABEL}>
                  {role}
                </text>
              </g>
            );
          })}

          <text x="18" y="456" fontSize="9" fill="#6a6a64" style={MONO}>
            Monad Testnet · chainId 10143
          </text>
        </svg>
      </div>
      <figcaption className="fig-cap">
        <span className="font-bold text-ink">Şekil 1.</span> Basitleştirilmiş şema: bir aracın
        geçmişi, tek bir birime bağlı.
      </figcaption>
    </figure>
  );
}
