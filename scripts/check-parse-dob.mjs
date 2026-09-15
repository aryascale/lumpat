// Self-check for the DOB parsing used by age categories.
// Run: node scripts/check-parse-dob.mjs
// Mirrors parseDob/calculateAgeOnRaceDay in src/pages/EventPage.tsx —
// keep both in sync when editing.

const MONTHS_ID = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
  agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, agu: 7, agt: 7,
  sep: 8, okt: 9, nov: 10, des: 11,
  january: 0, february: 1, march: 2, may: 4, june: 5, july: 6,
  august: 7, october: 9, december: 11,
};

function parseDob(dobStr) {
  const s = String(dobStr || "").trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const txt = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (txt) {
    const mo = MONTHS_ID[txt[2].toLowerCase()];
    if (mo !== undefined) return new Date(Number(txt[3]), mo, Number(txt[1]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function ageOn(dobStr, raceDateStr) {
  if (!dobStr || !raceDateStr) return null;
  const dob = parseDob(dobStr);
  const raceDate = new Date(raceDateStr);
  if (!dob || isNaN(raceDate.getTime())) return null;
  let age = raceDate.getFullYear() - dob.getFullYear();
  const m = raceDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && raceDate.getDate() < dob.getDate())) age--;
  return age;
}

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// parseDob: day-first slash dates must NOT be read as US month-first
assertEq(iso(parseDob("1990-05-12")), "1990-05-12", "ISO passes through");
assertEq(iso(parseDob("12/05/1990")), "1990-05-12", "12/05/1990 = 12 May 1990");
assertEq(iso(parseDob("5/12/1990")), "1990-12-05", "5/12/1990 = 5 Dec 1990");
assertEq(iso(parseDob("12-05-1990")), "1990-05-12", "dash format day-first");
assertEq(iso(parseDob("12 Mei 1990")), "1990-05-12", "Indonesian month name");
assertEq(iso(parseDob("12 May 1990")), "1990-05-12", "English month name");
assertEq(parseDob("Jakarta"), null, "garbage → null");
assertEq(parseDob(""), null, "empty → null");

// ageOn: birthday-before/after race day boundaries
assertEq(ageOn("1990-05-12", "2026-09-15"), 36, "age this year");
assertEq(ageOn("1990-09-20", "2026-09-15"), 35, "birthday not yet passed");
assertEq(ageOn("1986-02-28", "2026-09-15"), 40, "Master boundary");
assertEq(ageOn("12/05/1990", "2026-09-15"), 36, "day-first DOB age");
assertEq(ageOn("12 Mei 1990", "2026-09-15"), 36, "Indonesian DOB age");

function assertEq(actual, expected, label) {
  const a = actual instanceof Date ? iso(actual) : actual;
  if (a !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${a}`);
    process.exit(1);
  }
  console.log(`ok   ${label}`);
}
console.log("All DOB parse checks passed.");
