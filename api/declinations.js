import SwissEph from "swisseph-wasm";

function setCORS(req, res) {
  const reqHeaders = req.headers["access-control-request-headers"];
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", reqHeaders || "Content-Type, Accept, X-Requested-With, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

const NAME_DE = {
  Sun: "Sonne",
  Moon: "Mond",
  Mercury: "Merkur",
  Venus: "Venus",
  Mars: "Mars",
  Jupiter: "Jupiter",
  Saturn: "Saturn",
  Uranus: "Uranus",
  Neptune: "Neptun",
  Pluto: "Pluto",
  Chiron: "Chiron",
};

function parseDateYMD(ymd) {
  // erwartet: YYYY-MM-DD
  if (!ymd || typeof ymd !== "string") return null;
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 1900 || y > 2050) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return { y, mo, d };
}

function formatDeg(val) {
  // z.B. -12.3456 -> "-12.35°"
  const s = Math.round(val * 100) / 100;
  return `${s.toFixed(2)}°`;
}

function nsFromDecl(deg) {
  if (deg > 0) return "Nördlich (+)";
  if (deg < 0) return "Südlich (-)";
  return "Äquator (0)";
}

export default async function handler(req, res) {
  try {
    setCORS(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();

    const url = new URL(req.url, "http://x");
    const ymd = url.searchParams.get("date"); // YYYY-MM-DD
    const parsed = parseDateYMD(ymd);
    if (!parsed) {
      return res.status(400).json({
        ok: false,
        error: 'Bitte "date=YYYY-MM-DD" angeben (1900–2050). Beispiel: ?date=2026-01-13',
      });
    }

    // UT 00:00
    const hourUT = 0.0;

    const swe = new SwissEph();
    await swe.initSwissEph();

    const tjd = swe.julday(parsed.y, parsed.mo, parsed.d, hourUT, swe.SE_GREG_CAL);

    // WICHTIG: Für Deklination brauchen wir äquatoriale Koordinaten:
    // SEFLG_EQUATORIAL liefert: [RA, DEC, DIST, ...]
    const flags = swe.SEFLG_SWIEPH | swe.SEFLG_EQUATORIAL;

    const bodies = [
      { key: "Sun", id: swe.SE_SUN },
      { key: "Moon", id: swe.SE_MOON },
      { key: "Mercury", id: swe.SE_MERCURY },
      { key: "Venus", id: swe.SE_VENUS },
      { key: "Mars", id: swe.SE_MARS },
      { key: "Jupiter", id: swe.SE_JUPITER },
      { key: "Saturn", id: swe.SE_SATURN },
      { key: "Uranus", id: swe.SE_URANUS },
      { key: "Neptune", id: swe.SE_NEPTUNE },
      { key: "Pluto", id: swe.SE_PLUTO },
      { key: "Chiron", id: swe.SE_CHIRON },
    ];

    const out = [];
    for (const b of bodies) {
      const r = swe.calc_ut(tjd, b.id, flags);
      const dec = r[1]; // Deklination in Grad
      out.push({
        body: NAME_DE[b.key] || b.key,
        declination_deg: Math.round(dec * 1000000) / 1000000,
        declination_text: formatDeg(dec),
        hemisphere: nsFromDecl(dec),
      });
    }

    return res.status(200).json({
      ok: true,
      meta: {
        date: ymd,
        ut: "00:00",
        tjd,
        note: "Deklinationen sind ortsunabhängig; nur UT ist hier fix (00:00).",
      },
      data: out,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
