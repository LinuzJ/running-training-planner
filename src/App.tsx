import { useState } from "react";
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
  distOrTime: string;
};

type DayPlan = {
  day: string;
  sessions: Session[];
};

export default function App() {
  const [weeklyMiles, setWeeklyMiles] = useState<number>(60);
  const [enableCycling, setEnableCycling] = useState<boolean>(false);
  const [cyclingHours, setCyclingHours] = useState<number>(0);
  const [removeMon, setRemoveMon] = useState<boolean>(false);
  const [removeFri, setRemoveFri] = useState<boolean>(false);
  const [satHighIntensity, setSatHighIntensity] = useState<boolean>(false);
  const [raceDistance, setRaceDistance] = useState<number>(10); // km
  const [raceTime, setRaceTime] = useState<string>("40:00");
  const [vdot, setVdot] = useState<number | null>(null);
  const [paces, setPaces] = useState<{
    easy: string;
    subT: string;
    hi?: string;
  }>({
    easy: "",
    subT: "",
  });

  // --- Helper: format pace as MM:SS ---
  const formatPace = (minPerKm: number): string => {
    const minutes = Math.floor(minPerKm);
    const seconds = Math.round((minPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
  };

  // --- VDOT calculator (simplified placeholder) ---
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
    setPaces({
      easy: formatPace(easyMinPerKm),
      subT: formatPace(subTMinPerKm),
      hi: formatPace(hiMinPerKm),
    });
  };

  // --- Weekly Plan Generator ---
  const generatePlan = (): DayPlan[] => {
    const warmupCooldownPerSession = 4; // 2 km warmup + 2 km cooldown
    const subTWorkShare = 0.25; // 25% weekly mileage
    const hiWorkShare = satHighIntensity ? 0.07 : 0; // 7% HI if enabled

    // allocate blocks
    const totalSubTWork = weeklyMiles * subTWorkShare;
    const subTBlock = totalSubTWork / 2; // always Tue + Thu

    const hiVolume = weeklyMiles * hiWorkShare; // Saturday HI

    const totalWarmupCooldown =
      warmupCooldownPerSession * (2 + (satHighIntensity ? 1 : 0));

    // Easy mileage fills the rest
    const easyMileage =
      weeklyMiles - totalSubTWork - hiVolume - totalWarmupCooldown;

    // Easy days count (Mon, Wed, Fri, Sun)
    let easyDayCount = 4;
    if (removeMon) easyDayCount--;
    if (removeFri) easyDayCount--;

    const easyBlock = easyMileage / (easyDayCount + 0.5); // Sun = 1.5x
    const longRun = easyBlock * 1.5;

    // Cycling split
    const bikeSubTBlock =
      enableCycling && cyclingHours > 0
        ? ((cyclingHours * 0.25) / 3).toFixed(1)
        : null;
    const bikeEasyBlock =
      enableCycling && cyclingHours > 0
        ? ((cyclingHours * 0.75) / (3 - (removeMon ? 1 : 0))).toFixed(1)
        : null;

    const plan: DayPlan[] = [];

    // Monday
    plan.push({
      day: "Mon",
      sessions: removeMon
        ? []
        : [
            {
              type: "Run",
              subtype: "Easy",
              distOrTime: `${easyBlock.toFixed(1)} km`,
            },
            ...(bikeEasyBlock
              ? [
                  {
                    type: "Bike",
                    subtype: "Endurance",
                    distOrTime: `${bikeEasyBlock} h`,
                  },
                ]
              : []),
          ],
    });

    // Tuesday (SubT)
    plan.push({
      day: "Tue",
      sessions: [
        { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
        {
          type: "Run",
          subtype: "SubT",
          distOrTime: `${subTBlock.toFixed(1)} km`,
        },
        { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ...(bikeSubTBlock
          ? [
              {
                type: "Bike",
                subtype: "SubT",
                distOrTime: `${bikeSubTBlock} h`,
              },
            ]
          : []),
      ],
    });

    // Wednesday
    plan.push({
      day: "Wed",
      sessions: [
        {
          type: "Run",
          subtype: "Easy",
          distOrTime: `${easyBlock.toFixed(1)} km`,
        },
        ...(bikeEasyBlock
          ? [
              {
                type: "Bike",
                subtype: "Endurance",
                distOrTime: `${bikeEasyBlock} h`,
              },
            ]
          : []),
      ],
    });

    // Thursday (SubT)
    plan.push({
      day: "Thu",
      sessions: [
        { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
        {
          type: "Run",
          subtype: "SubT",
          distOrTime: `${subTBlock.toFixed(1)} km`,
        },
        { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ...(bikeSubTBlock
          ? [
              {
                type: "Bike",
                subtype: "SubT",
                distOrTime: `${bikeSubTBlock} h`,
              },
            ]
          : []),
      ],
    });

    // Friday
    plan.push({
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

    // Saturday
    if (satHighIntensity) {
      plan.push({
        day: "Sat",
        sessions: [
          { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
          {
            type: "Run",
            subtype: "High Intensity",
            distOrTime: `${hiVolume.toFixed(1)} km`,
          },
          { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
        ],
      });
    } else {
      plan.push({
        day: "Sat",
        sessions: [
          { type: "Run", subtype: "Warmup", distOrTime: "2 km" },
          {
            type: "Run",
            subtype: "SubT",
            distOrTime: `${subTBlock.toFixed(1)} km`,
          },
          { type: "Run", subtype: "Cooldown", distOrTime: "2 km" },
          ...(bikeSubTBlock
            ? [
                {
                  type: "Bike",
                  subtype: "SubT",
                  distOrTime: `${bikeSubTBlock} h`,
                },
              ]
            : []),
        ],
      });
    }

    // Sunday
    plan.push({
      day: "Sun",
      sessions: [
        {
          type: "Run",
          subtype: "Long Run",
          distOrTime: `${longRun.toFixed(1)} km`,
        },
        ...(bikeEasyBlock
          ? [
              {
                type: "Bike",
                subtype: "Endurance",
                distOrTime: `${bikeEasyBlock} h`,
              },
            ]
          : []),
      ],
    });

    return plan;
  };

  const plan: DayPlan[] = generatePlan();

  // --- Aggregated Data for Graph + Summary ---
  const aggregateData = () => {
    let runEasyKm = 0;
    let runSubTKm = 0;
    let runHiKm = 0;
    let bikeEnduranceH = 0;
    let bikeSubTH = 0;

    const kmToHours = (km: number) => km / 12;

    plan.forEach((day) => {
      day.sessions.forEach((s) => {
        const value = parseFloat(s.distOrTime);
        if (s.type === "Run") {
          if (["Easy", "Long Run", "Warmup", "Cooldown"].includes(s.subtype)) {
            runEasyKm += value;
          } else if (s.subtype === "SubT") {
            runSubTKm += value;
          } else if (s.subtype === "High Intensity") {
            runHiKm += value;
          }
        } else if (s.type === "Bike") {
          if (s.subtype === "Endurance") bikeEnduranceH += value;
          else if (s.subtype === "SubT") bikeSubTH += value;
        }
      });
    });

    const chart: { name: string; hours: number }[] = [
      { name: "Run Easy", hours: kmToHours(runEasyKm) },
      { name: "Run SubT", hours: kmToHours(runSubTKm) },
    ];
    if (runHiKm > 0) {
      chart.push({ name: "Run High Intensity", hours: kmToHours(runHiKm) });
    }
    if (enableCycling) {
      chart.push({ name: "Bike Endurance", hours: bikeEnduranceH });
      chart.push({ name: "Bike SubT", hours: bikeSubTH });
    }

    return {
      chart,
      totals: {
        runKm: runEasyKm + runSubTKm + runHiKm,
        runEasyKm,
        runSubTKm,
        runHiKm,
        bikeHours: bikeEnduranceH + bikeSubTH,
        bikeEnduranceH,
        bikeSubTH,
      },
    };
  };

  const { chart: chartData, totals } = aggregateData();

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-3xl font-bold mb-2">Norwegian Singles Planner</h1>
      <p className="text-m font-bold mb-2">
        Inspired by Norwegian Singles method.
      </p>
      <a
        href="https://scientifictriathlon.com/tts282-the-norwegian-training-methods-with-olav-alexander-bu/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800 mb-6 inline-block"
      >
        Learn more here
      </a>

      {/* Inputs */}
      <div className="bg-white rounded-2xl shadow p-4 mb-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">
              Weekly Run Goal (km)
            </label>
            <input
              type="number"
              value={weeklyMiles}
              onChange={(e) => setWeeklyMiles(Number(e.target.value))}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="enableCycling"
              type="checkbox"
              checked={enableCycling}
              onChange={() => setEnableCycling(!enableCycling)}
              className="h-4 w-4"
            />
            <label htmlFor="enableCycling" className="text-sm font-medium">
              Add Cycling
            </label>
          </div>
          {enableCycling && (
            <div>
              <label className="block text-sm font-medium">
                Weekly Cycling Goal (hours)
              </label>
              <input
                type="number"
                value={cyclingHours}
                onChange={(e) => setCyclingHours(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">
              Race Distance (km)
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
              Race Time (MM:SS)
            </label>
            <input
              value={raceTime}
              onChange={(e) => setRaceTime(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm"
            />
          </div>
        </div>

        {/* Toggles */}
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

        <button
          onClick={calculateVdot}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700"
        >
          Calculate VDOT & Paces
        </button>
      </div>

      {/* Weekly Plan */}
      <h2 className="text-xl font-semibold mb-3">Weekly Plan</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 mb-8">
        {plan.map((d, i) => (
          <div
            key={i}
            className="min-w-[170px] flex-shrink-0 bg-white rounded-xl shadow p-4 text-center"
          >
            <p className="font-bold mb-2">{d.day}</p>
            <div className="space-y-2">
              {d.sessions.length === 0 && <p className="text-gray-400">Rest</p>}
              {d.sessions.map((s, j) => (
                <div
                  key={j}
                  className={`rounded-lg p-2 text-sm ${
                    s.type === "Run"
                      ? s.subtype === "SubT"
                        ? "bg-orange-100 text-orange-800"
                        : s.subtype === "High Intensity"
                        ? "bg-red-100 text-red-800"
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
              <Bar dataKey="hours" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow p-4 text-sm">
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          <p>
            <b>Total Run:</b> {totals.runKm.toFixed(1)} km
          </p>
          <ul className="ml-4 list-disc">
            <li>
              Easy: {totals.runEasyKm.toFixed(1)} km (~
              {(totals.runEasyKm / 12).toFixed(1)} h)
            </li>
            <li>
              SubT: {totals.runSubTKm.toFixed(1)} km (~
              {(totals.runSubTKm / 12).toFixed(1)} h)
            </li>
            {totals.runHiKm > 0 && (
              <li>
                High Intensity: {totals.runHiKm.toFixed(1)} km (~
                {(totals.runHiKm / 12).toFixed(1)} h)
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
          {vdot && (
            <div className="mt-4">
              <h4 className="font-semibold">Paces</h4>
              <p>Easy: {paces.easy}</p>
              <p>SubT: {paces.subT}</p>
              {satHighIntensity && paces.hi && (
                <p>High Intensity: {paces.hi}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
