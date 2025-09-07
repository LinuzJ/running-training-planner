import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Session = {
  type: "Run" | "Bike";
  subtype: string;
  distOrTime: string; // "X km" or "Y h"
};

type DayPlan = {
  day: string;
  sessions: Session[];
};

type ZonePacesNum = {
  easy: number; // min/km
  subT: number; // min/km
  hi: number; // min/km
};

type ZonePercentages = {
  easy: number; // %
  subT: number; // %
  hi: number; // %
};

export default function App() {
  // --- Core inputs ---
  const [weeklyMileage, setWeeklyMileage] = useState<number>(60);

  // Race / VDOT inputs (Box 1)
  const [raceDistance, setRaceDistance] = useState<number>(10);
  const [raceTime, setRaceTime] = useState<string>("40:00");
  const [vdot, setVdot] = useState<number | null>(null);

  // Numeric paces used for calculations (min/km)
  const [pacesNum, setPacesNum] = useState<ZonePacesNum>({
    easy: 5.0,
    subT: 4.0,
    hi: 3.5,
  });

  // Display paces as strings (MM:SS)
  const [pacesStr, setPacesStr] = useState<{
    easy: string;
    subT: string;
    hi: string;
  }>({
    easy: "5:00 min/km",
    subT: "4:00 min/km",
    hi: "3:30 min/km",
  });

  // --- Toggles / Advanced ---
  const [satHighIntensity, setSatHighIntensity] = useState<boolean>(false);
  const [advancedOptions, setAdvancedOptions] = useState<boolean>(false);
  const [removeMon, setRemoveMon] = useState<boolean>(false);
  const [removeFri, setRemoveFri] = useState<boolean>(false);

  // Cycling (inside Advanced)
  const [enableCycling, setEnableCycling] = useState<boolean>(false);
  const [cyclingHours, setCyclingHours] = useState<number>(0);

  // Zone % distribution (time basis)
  const [percentages, setPercentages] = useState<ZonePercentages>({
    easy: 75,
    subT: 25,
    hi: 0,
  });

  // If HI is toggled, auto-set 75/18/7; otherwise 75/25/0 (still editable in Advanced)
  useEffect(() => {
    if (satHighIntensity) {
      setPercentages({ easy: 75, subT: 18, hi: 7 });
    } else {
      setPercentages({ easy: 75, subT: 25, hi: 0 });
    }
  }, [satHighIntensity]);

  // --- Helpers ---
  const formatPace = (minPerKm: number): string => {
    const minutes = Math.floor(minPerKm);
    let seconds = Math.round((minPerKm - minutes) * 60);
    if (seconds === 60) {
      // handle rounding edge cases like 3:59.6 -> 4:00
      seconds = 0;
      return `${minutes + 1}:00 min/km`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
  };

  // --- VDOT calculator (simplified placeholder as requested) ---
  const calculateVdot = () => {
    const [minStr, secStr] = raceTime.split(":");
    const min = parseInt(minStr, 10) || 0;
    const sec = parseInt(secStr, 10) || 0;
    const totalMin = min + sec / 60;

    const v = (raceDistance / totalMin) * 60; // km/h
    const estVDOT = Math.round(10 + v * 2);

    // dummy conversions → could be replaced with Daniels VDOT tables
    const easyMinPerKm = 7.5 / (v / 10);
    const subTMinPerKm = 6 / (v / 10);
    const hiMinPerKm = 5 / (v / 10);

    setVdot(estVDOT);
    setPacesNum({
      easy: easyMinPerKm,
      subT: subTMinPerKm,
      hi: hiMinPerKm,
    });
    setPacesStr({
      easy: formatPace(easyMinPerKm),
      subT: formatPace(subTMinPerKm),
      hi: formatPace(hiMinPerKm),
    });
  };

  // --- Zone time allocation (time basis) ---
  const zones = useMemo(() => {
    // total time baseline estimated from weekly mileage run at easy pace
    const totalTimeMin = weeklyMileage * pacesNum.easy; // minutes
    const easyTime = (totalTimeMin * percentages.easy) / 100;
    const subTTime = (totalTimeMin * percentages.subT) / 100;
    const hiTime = (totalTimeMin * percentages.hi) / 100;

    // Distances from time and zone pace
    const easyDist = easyTime / pacesNum.easy;
    const subTDist = subTTime / pacesNum.subT;
    const hiDist = hiTime / pacesNum.hi;

    return {
      totalTimeMin,
      easy: { timeMin: easyTime, distKm: easyDist },
      subT: { timeMin: subTTime, distKm: subTDist },
      hi: { timeMin: hiTime, distKm: hiDist },
    };
  }, [weeklyMileage, percentages, pacesNum]);

  // --- Weekly plan generation ---
  const plan: DayPlan[] = useMemo(() => {
    // SubT days: Tue, Thu always. Saturday is SubT if HI is off; HI if on.
    const numSubTDays = satHighIntensity ? 2 : 3;
    const subTDistPerDay = zones.subT.distKm / Math.max(1, numSubTDays);

    // Warmup + cooldown per intensity session
    const warmupCooldownPerSessionKm = 4; // 2 km warmup + 2 km cooldown
    const numIntensitySessions = satHighIntensity ? 3 : 3; // Tue, Thu, and Sat (either SubT or HI) are intensity days
    const totalWUCDKm = warmupCooldownPerSessionKm * numIntensitySessions;

    // The Easy bucket must also cover all warmup/cooldown.
    const freeEasyDistKm = Math.max(0, zones.easy.distKm - totalWUCDKm);

    // Easy day allocation across Mon, Wed, Fri, Sun (Sun is 1.5x)
    let easyDayCount = 4;
    if (removeMon) easyDayCount--;
    if (removeFri) easyDayCount--;
    const denom = easyDayCount + 0.5; // Sun weight = 1.5
    const easyBlock = denom > 0 ? freeEasyDistKm / denom : 0;
    const longRun = easyBlock * 1.5;

    // Saturday HI distance
    const hiDist = zones.hi.distKm;

    // Cycling distribution (Mon/Wed/Sun Endurance, Tue/Thu SubT, never Fri)
    const bikeEndurancePerDayH =
      enableCycling && cyclingHours > 0 ? (cyclingHours * 0.75) / 3 : 0;
    const bikeSubTPerDayH =
      enableCycling && cyclingHours > 0 ? (cyclingHours * 0.25) / 2 : 0;

    const days: DayPlan[] = [];

    // Monday
    days.push({
      day: "Mon",
      sessions: removeMon
        ? []
        : [
            {
              type: "Run",
              subtype: "Easy",
              distOrTime: `${easyBlock.toFixed(1)} km`,
            },
            ...(enableCycling && bikeEndurancePerDayH > 0
              ? [
                  {
                    type: "Bike",
                    subtype: "Endurance",
                    distOrTime: `${bikeEndurancePerDayH.toFixed(1)} h`,
                  },
                ]
              : []),
          ],
    });

    // Tuesday (SubT + WU/CD)
    days.push({
      day: "Tue",
      sessions: [
        { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
        {
          type: "Run",
          subtype: "SubT",
          distOrTime: `${subTDistPerDay.toFixed(1)} km`,
        },
        { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ...(enableCycling && bikeSubTPerDayH > 0
          ? [
              {
                type: "Bike",
                subtype: "SubT",
                distOrTime: `${bikeSubTPerDayH.toFixed(1)} h`,
              },
            ]
          : []),
      ],
    });

    // Wednesday
    days.push({
      day: "Wed",
      sessions: [
        {
          type: "Run",
          subtype: "Easy",
          distOrTime: `${easyBlock.toFixed(1)} km`,
        },
        ...(enableCycling && bikeEndurancePerDayH > 0
          ? [
              {
                type: "Bike",
                subtype: "Endurance",
                distOrTime: `${bikeEndurancePerDayH.toFixed(1)} h`,
              },
            ]
          : []),
      ],
    });

    // Thursday (SubT + WU/CD)
    days.push({
      day: "Thu",
      sessions: [
        { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
        {
          type: "Run",
          subtype: "SubT",
          distOrTime: `${subTDistPerDay.toFixed(1)} km`,
        },
        { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ...(enableCycling && bikeSubTPerDayH > 0
          ? [
              {
                type: "Bike",
                subtype: "SubT",
                distOrTime: `${bikeSubTPerDayH.toFixed(1)} h`,
              },
            ]
          : []),
      ],
    });

    // Friday
    days.push({
      day: "Fri",
      sessions: removeFri
        ? []
        : [
            {
              type: "Run",
              subtype: "Easy",
              distOrTime: `${easyBlock.toFixed(1)} km`,
            },
          ],
    });

    // Saturday (SubT + WU/CD) OR (HI + WU/CD)
    if (satHighIntensity) {
      days.push({
        day: "Sat",
        sessions: [
          { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
          {
            type: "Run",
            subtype: "High Intensity",
            distOrTime: `${hiDist.toFixed(1)} km`,
          },
          { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ],
      });
    } else {
      days.push({
        day: "Sat",
        sessions: [
          { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
          {
            type: "Run",
            subtype: "SubT",
            distOrTime: `${subTDistPerDay.toFixed(1)} km`,
          },
          { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ],
      });
    }

    // Sunday
    days.push({
      day: "Sun",
      sessions: [
        {
          type: "Run",
          subtype: "Long Run",
          distOrTime: `${longRun.toFixed(1)} km`,
        },
        ...(enableCycling && bikeEndurancePerDayH > 0
          ? [
              {
                type: "Bike",
                subtype: "Endurance",
                distOrTime: `${bikeEndurancePerDayH.toFixed(1)} h`,
              },
            ]
          : []),
      ],
    });

    return days;
  }, [
    zones.easy.distKm,
    zones.subT.distKm,
    zones.hi.distKm,
    satHighIntensity,
    enableCycling,
    cyclingHours,
    removeMon,
    removeFri,
  ]);

  // --- Aggregates for chart and summary ---
  const chartData = useMemo(() => {
    const arr: { name: string; hours: number }[] = [
      { name: "Run Easy", hours: zones.easy.timeMin / 60 },
      { name: "Run SubT", hours: zones.subT.timeMin / 60 },
    ];
    if (satHighIntensity && zones.hi.timeMin > 0) {
      arr.push({ name: "Run HI", hours: zones.hi.timeMin / 60 });
    }
    if (enableCycling && cyclingHours > 0) {
      arr.push({ name: "Bike Endurance", hours: cyclingHours * 0.75 });
      arr.push({ name: "Bike SubT", hours: cyclingHours * 0.25 });
    }
    return arr;
  }, [zones, satHighIntensity, enableCycling, cyclingHours]);

  // Totals (numeric) for summary
  const totals = useMemo(() => {
    // Sum run km by parsing plan items
    let runEasyKm = 0;
    let runSubTKm = 0;
    let runHiKm = 0;

    plan.forEach((d) => {
      d.sessions.forEach((s) => {
        if (s.type === "Run") {
          const val = parseFloat(s.distOrTime);
          if (["Easy", "Long Run", "Warmup", "Cooldown"].includes(s.subtype)) {
            runEasyKm += val;
          } else if (s.subtype === "SubT") {
            runSubTKm += val;
          } else if (s.subtype === "High Intensity") {
            runHiKm += val;
          }
        }
      });
    });

    const bikeEnduranceH = enableCycling ? cyclingHours * 0.75 : 0;
    const bikeSubTH = enableCycling ? cyclingHours * 0.25 : 0;

    return {
      runKm: runEasyKm + runSubTKm + runHiKm,
      runEasyKm,
      runSubTKm,
      runHiKm,
      bikeHours: bikeEnduranceH + bikeSubTH,
      bikeEnduranceH,
      bikeSubTH,
      totalTimeH: zones.totalTimeMin / 60 + (enableCycling ? cyclingHours : 0),
    };
  }, [plan, enableCycling, cyclingHours, zones.totalTimeMin]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-3xl font-bold mb-2">Norwegian Singles Planner</h1>
      <p className="text-m font-bold mb-2">
        Inspired by Norwegian Singles method{" "}
        <a
          href="https://norwegiansingles.run/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
        >
          Learn more here
        </a>
        .
      </p>
      <p className="text-m font-bold mb-2">
        Created by{" "}
        <a
          href="https://www.linusjern.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800"
        >
          Linus Jern
        </a>
        .
      </p>

      {/* ===== Box 1: VDOT & Paces ===== */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">VDOT Calculator</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Race distance (km)
            </label>
            <input
              type="number"
              value={raceDistance}
              onChange={(e) => setRaceDistance(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">
              Race time (MM:SS)
            </label>
            <input
              value={raceTime}
              onChange={(e) => setRaceTime(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={calculateVdot}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
            >
              Calculate VDOT & Paces
            </button>
          </div>
        </div>
        {vdot !== null && (
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div>
              <b>VDOT:</b> {vdot}
            </div>
            <div>
              <b>Easy:</b> {pacesStr.easy}
            </div>
            <div>
              <b>SubT:</b> {pacesStr.subT}
            </div>
            <div>
              <b>HI:</b> {pacesStr.hi}
            </div>
          </div>
        )}
      </div>

      {/* ===== Box 2: Plan Inputs (basic) ===== */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6 space-y-3">
        <h2 className="text-lg font-semibold">Plan Inputs</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Weekly run goal (km)
            </label>
            <input
              type="number"
              value={weeklyMileage}
              onChange={(e) => setWeeklyMileage(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={satHighIntensity}
                onChange={() => setSatHighIntensity(!satHighIntensity)}
                className="h-4 w-4"
              />
              Saturday High Intensity
            </label>
          </div>

          <div className="flex items-end justify-start">
            <button
              onClick={() => setAdvancedOptions((v) => !v)}
              className="rounded-lg bg-gray-200 px-3 py-2 text-sm hover:bg-gray-300"
            >
              {advancedOptions
                ? "Hide Advanced Options"
                : "Show Advanced Options"}
            </button>
          </div>
        </div>

        {/* Advanced Options */}
        {advancedOptions && (
          <div className="mt-3 space-y-6 border-t pt-4">
            {/* Intensity distribution */}
            <div>
              <h3 className="font-semibold mb-2">
                Intensity Distribution (by time)
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                {(["easy", "subT", "hi"] as (keyof ZonePercentages)[]).map(
                  (zone) => (
                    <div key={zone}>
                      <label className="block text-sm font-medium">
                        {zone.toUpperCase()} %
                      </label>
                      <input
                        type="number"
                        value={percentages[zone]}
                        onChange={(e) =>
                          setPercentages({
                            ...percentages,
                            [zone]: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
                      />
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tip: Aim for totals ~100%.
              </p>
            </div>

            {/* Cycling Section */}
            <div>
              <h3 className="font-semibold mb-2">Cycling</h3>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableCycling}
                  onChange={() => setEnableCycling(!enableCycling)}
                  className="h-4 w-4"
                />
                Add Cycling
              </label>
              {enableCycling && (
                <div className="mt-2 grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">
                      Weekly cycling hours
                    </label>
                    <input
                      type="number"
                      value={cyclingHours}
                      onChange={(e) => setCyclingHours(Number(e.target.value))}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Remove day toggles */}
            <div>
              <h3 className="font-semibold mb-2">Run Day Options</h3>
              <div className="flex gap-6 flex-wrap">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={removeMon}
                    onChange={() => setRemoveMon(!removeMon)}
                    className="h-4 w-4"
                  />
                  Remove Monday Run
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={removeFri}
                    onChange={() => setRemoveFri(!removeFri)}
                    className="h-4 w-4"
                  />
                  Remove Friday Run
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Plan */}
      <h2 className="text-xl font-semibold mb-3">Weekly Plan</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 mb-8">
        {plan.map((d) => (
          <div
            key={d.day}
            className="min-w-[170px] flex-shrink-0 bg-white rounded-xl shadow p-4 text-center"
          >
            <p className="font-bold mb-2">{d.day}</p>
            <div className="space-y-2">
              {d.sessions.length === 0 && <p className="text-gray-400">Rest</p>}
              {d.sessions.map((s, j) => (
                <div
                  key={`${d.day}-${j}`}
                  className={`rounded-lg p-2 text-sm ${
                    s.type === "Run"
                      ? s.subtype === "SubT"
                        ? "bg-orange-100 text-orange-800" // flipped color for SubT
                        : s.subtype === "High Intensity"
                        ? "bg-red-100 text-red-800" // HI in red
                        : "bg-green-100 text-green-800"
                      : s.subtype === "SubT"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  <p className="font-medium">
                    {s.type}: {s.subtype}
                  </p>
                  <p>{s.distOrTime}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Totals */}
      <h2 className="text-xl font-semibold mb-3">Training Load Distribution</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-xl shadow p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis
                label={{ value: "Hours", angle: -90, position: "insideLeft" }}
              />
              <Tooltip />
              <Legend />
              <Bar dataKey="hours" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl shadow p-4 text-sm">
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          <p>
            <b>Total Time:</b> {totals.totalTimeH.toFixed(1)} h
          </p>
          <p>
            <b>Total Run:</b> {totals.runKm.toFixed(1)} km
          </p>
          <ul className="ml-4 list-disc">
            <li>
              Easy: {totals.runEasyKm.toFixed(1)} km (~
              {((totals.runEasyKm * pacesNum.easy) / 60).toFixed(1)} h)
            </li>
            <li>
              SubT: {totals.runSubTKm.toFixed(1)} km (~
              {((totals.runSubTKm * pacesNum.subT) / 60).toFixed(1)} h)
            </li>
            {totals.runHiKm > 0 && (
              <li>
                High Intensity: {totals.runHiKm.toFixed(1)} km (~
                {((totals.runHiKm * pacesNum.hi) / 60).toFixed(1)} h)
              </li>
            )}
          </ul>

          {enableCycling && (
            <>
              <p className="mt-2">
                <b>Total Bike:</b> {totals.bikeHours.toFixed(1)} h
              </p>
              <ul className="ml-4 list-disc">
                <li>Endurance: {totals.bikeEnduranceH.toFixed(1)} h</li>
                <li>SubT: {totals.bikeSubTH.toFixed(1)} h</li>
              </ul>
            </>
          )}

          {vdot !== null && (
            <div className="mt-4">
              <h4 className="font-semibold">Paces (from VDOT)</h4>
              <p>Easy: {pacesStr.easy}</p>
              <p>SubT: {pacesStr.subT}</p>
              <p>HI: {pacesStr.hi}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
