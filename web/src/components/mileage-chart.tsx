import { recordType, type VehicleRecord } from "@/lib/registry";
import { formatKm } from "@/lib/utils";

const DAY_MS = 86_400_000;

/**
 * Figure 3: the odometer against the calendar.
 *
 * This is the product's one guarantee drawn as a picture: the red dashed rule
 * marks today's floor, the value no garage can go under. An accident is a red
 * square on the line where it happened.
 *
 * The contract keeps mileage rising in the order records were *written*; this
 * plots them by the day the work was *done*. The two agree unless a garage
 * backdates a reading, in which case the line can dip - which is the honest
 * picture of a late entry, so the caption does not claim otherwise.
 */
export function MileageChart({ records }: { records: VehicleRecord[] }) {
  // Oldest first, as a timing diagram reads left to right.
  const points = [...records]
    .map((r) => ({ day: r.serviceDay, km: Number(r.mileage), type: recordType(r.recordType) }))
    .sort((a, b) => a.day - b.day || a.km - b.km);

  if (points.length === 0) return null;

  const W = 720;
  const H = 260;
  const pad = { l: 64, r: 20, t: 18, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const firstDay = points[0].day;
  const lastDay = points[points.length - 1].day;
  const span = Math.max(lastDay - firstDay, 1);
  const dayPad = Math.max(span * 0.04, 20);
  const x0 = firstDay - dayPad;
  const x1 = lastDay + dayPad;

  const maxKm = Math.max(...points.map((p) => p.km));
  const yMax = niceCeil(maxKm * 1.08);

  const x = (day: number) => pad.l + ((day - x0) / (x1 - x0)) * iw;
  const y = (km: number) => pad.t + ih - (km / yMax) * ih;

  const years = yearTicks(x0, x1);
  const kmTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const floorKm = maxKm;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.km)}`).join(" ");

  return (
    <figure className="m-0">
      <div className="fig-frame overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby="fig3-title"
          className="block h-auto w-full min-w-[520px]"
        >
          <title id="fig3-title">
            Kilometre, servis tarihine göre. {points.length} okuma, en düşük{" "}
            {formatKm(points[0].km)} km, en yüksek {formatKm(maxKm)} km.
          </title>

          {/* Grid */}
          {kmTicks.map((km) => (
            <g key={km}>
              <line x1={pad.l} x2={W - pad.r} y1={y(km)} y2={y(km)} stroke="#ecece7" />
              <text
                x={pad.l - 8}
                y={y(km) + 3.5}
                fontSize="10"
                textAnchor="end"
                fill="#6a6a64"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {km >= 1000 ? `${Math.round(km / 1000)}k` : km}
              </text>
            </g>
          ))}
          {years.map((year) => (
            <g key={year.day}>
              <line x1={x(year.day)} x2={x(year.day)} y1={pad.t} y2={pad.t + ih} stroke="#ecece7" />
              <text
                x={x(year.day)}
                y={H - 12}
                fontSize="10"
                textAnchor="middle"
                fill="#6a6a64"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {year.label}
              </text>
            </g>
          ))}

          {/* Axes */}
          <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="#121212" strokeWidth="1.5" />
          <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="#121212" strokeWidth="1.5" />

          {/* Today's floor */}
          <line
            x1={pad.l}
            x2={W - pad.r}
            y1={y(floorKm)}
            y2={y(floorKm)}
            stroke="#c8102e"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
          <text
            x={W - pad.r - 4}
            y={y(floorKm) - 6}
            fontSize="10"
            textAnchor="end"
            fill="#a50d25"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            taban {formatKm(floorKm)} km
          </text>

          {/* The odometer */}
          <path d={path} fill="none" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
          {points.map((p, i) => {
            const accident = p.type.tone === "bad";
            return (
              <rect
                key={i}
                x={x(p.day) - 4}
                y={y(p.km) - 4}
                width="8"
                height="8"
                fill={accident ? "#c8102e" : "#fff"}
                stroke={accident ? "#c8102e" : "#121212"}
                strokeWidth="1.5"
              >
                <title>
                  {p.type.label} · {formatKm(p.km)} km
                </title>
              </rect>
            );
          })}
        </svg>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-5 bg-ink" /> Kilometre
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block size-2 bg-red" /> Kaza / ağır hasar
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-5 border-t-[1.5px] border-dashed border-red" /> Bugünkü taban
        </span>
      </div>
      <figcaption className="mt-2 text-[12.5px] text-ink-2">
        <span className="font-bold text-ink">Şekil 3.</span> Kilometre, servis tarihine göre.
        Kontrat son okumanın altındaki hiçbir değeri kabul etmez; kırmızı çizgi bugünkü taban.
      </figcaption>
    </figure>
  );
}

/** 142_500 -> 150_000, so the top gridline lands on a round number. */
function niceCeil(value: number) {
  if (value <= 0) return 1000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = magnitude / 2;
  return Math.ceil(value / step) * step;
}

/** A tick at each January the chart spans, thinned out on long histories. */
function yearTicks(fromDay: number, toDay: number) {
  const fromYear = new Date(fromDay * DAY_MS).getUTCFullYear();
  const toYear = new Date(toDay * DAY_MS).getUTCFullYear();
  const every = toYear - fromYear > 8 ? 2 : 1;

  const ticks: { day: number; label: string }[] = [];
  for (let year = fromYear; year <= toYear + 1; year += every) {
    const day = Date.UTC(year, 0, 1) / DAY_MS;
    if (day >= fromDay && day <= toDay) ticks.push({ day, label: String(year) });
  }
  return ticks;
}
