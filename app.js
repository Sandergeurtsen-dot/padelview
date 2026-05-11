import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.querySelector("#cameraVideo");
const canvas = document.querySelector("#overlayCanvas");
const context = canvas.getContext("2d");
const trackingLayer = document.querySelector("#trackingLayer");
const insightGrid = document.querySelector(".insight-grid");

const statusText = document.querySelector("#statusText");
const fpsChip = document.querySelector("#fpsChip");
const emptyState = document.querySelector("#emptyState");
const trackingText = document.querySelector("#trackingText");
const strokeText = document.querySelector("#strokeText");
const scoreValue = document.querySelector("#scoreValue");
const techniqueBadge = document.querySelector("#techniqueBadge");
const scoreSummary = document.querySelector("#scoreSummary");
const detectionHeadline = document.querySelector("#detectionHeadline");
const detectionDetail = document.querySelector("#detectionDetail");
const confidenceValue = document.querySelector("#confidenceValue");
const armValue = document.querySelector("#armValue");
const focusValue = document.querySelector("#focusValue");
const feedbackList = document.querySelector("#feedbackList");
const liveFocusHeadline = document.querySelector("#liveFocusHeadline");
const liveFocusSummary = document.querySelector("#liveFocusSummary");
const liveFocusList = document.querySelector("#liveFocusList");

const sessionStatusText = document.querySelector("#sessionStatusText");
const sessionTimerValue = document.querySelector("#sessionTimerValue");
const recordingStatusText = document.querySelector("#recordingStatusText");
const sessionTotalValue = document.querySelector("#sessionTotalValue");
const sessionGoodValue = document.querySelector("#sessionGoodValue");
const sessionBadValue = document.querySelector("#sessionBadValue");
const sessionQualityValue = document.querySelector("#sessionQualityValue");
const sessionSummaryText = document.querySelector("#sessionSummaryText");
const sessionStatsGrid = document.querySelector("#sessionStatsGrid");
const coachHeadline = document.querySelector("#coachHeadline");
const coachSummary = document.querySelector("#coachSummary");
const coachList = document.querySelector("#coachList");
const readinessHeadline = document.querySelector("#readinessHeadline");
const readinessScoreValue = document.querySelector("#readinessScoreValue");
const visibilityQualityValue = document.querySelector("#visibilityQualityValue");
const framingQualityValue = document.querySelector("#framingQualityValue");
const readinessSummary = document.querySelector("#readinessSummary");
const sessionFocusHeadline = document.querySelector("#sessionFocusHeadline");
const sessionSignalList = document.querySelector("#sessionSignalList");
const bestStrokeValue = document.querySelector("#bestStrokeValue");
const weakStrokeValue = document.querySelector("#weakStrokeValue");
const streakValue = document.querySelector("#streakValue");
const timelineHeadline = document.querySelector("#timelineHeadline");
const sessionTimelineList = document.querySelector("#sessionTimelineList");
const focusBadge = document.querySelector("#focusBadge");
const nextDrillValue = document.querySelector("#nextDrillValue");
const gamePatternValue = document.querySelector("#gamePatternValue");
const savedSessionValue = document.querySelector("#savedSessionValue");
const focusSummary = document.querySelector("#focusSummary");
const savedHeadline = document.querySelector("#savedHeadline");
const savedSummary = document.querySelector("#savedSummary");

const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const switchButton = document.querySelector("#switchButton");
const sessionStartButton = document.querySelector("#sessionStartButton");
const sessionStopButton = document.querySelector("#sessionStopButton");
const recordButton = document.querySelector("#recordButton");
const downloadButton = document.querySelector("#downloadButton");
const exportSessionButton = document.querySelector("#exportSessionButton");
const handednessSelect = document.querySelector("#handednessSelect");
const trackingToggle = document.querySelector("#trackingToggle");
const labelsToggle = document.querySelector("#labelsToggle");
const tabButtons = [...document.querySelectorAll("[data-insight-view]")];

const CONNECTIONS = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];

const STROKE_TYPES = ["Forehand", "Backhand", "Volley", "Overhead / smash"];
const QUALITY_THRESHOLD = 74;

const DEFAULT_LIVE_FEEDBACK = [
  "Houd de hele speler in beeld voor een complete meting.",
  "Gebruik bij voorkeur de achtercamera voor meer detail.",
  "De analyse is bedoeld als trainingshulp, niet als medische beoordeling.",
];

const DEFAULT_COACH_FEEDBACK = [
  "Start een sessie om slagen over de hele rally heen op te slaan.",
  "Na meerdere slagen ziet de coach welke slag het vaakst voorkomt en waar je techniek wegvalt.",
  "Gebruik de sessietelling om goed versus minder goed uitgevoerde slagen te vergelijken.",
];

const ISSUE_LIBRARY = {
  elbow: {
    label: "slagarm compactheid",
    tip: "Werk aan een compactere slagarm zodat je de bal rustiger en controleerbaarder raakt.",
  },
  shoulder: {
    label: "schouderpositie",
    tip: "Zet je schouderlijn eerder goed neer zodat je slagvoorbereiding rustiger wordt.",
  },
  knee: {
    label: "beenwerk",
    tip: "Zak actiever door je benen voor meer stabiliteit en timing in de rally.",
  },
  contact: {
    label: "contactpunt",
    tip: "Zoek een constanter contactpunt tussen heup en schouder om slagen schoner te raken.",
  },
  balance: {
    label: "balans",
    tip: "Bewaar meer balans in je basispositie en doorzwaai zodat je sneller klaar staat voor de volgende bal.",
  },
};

const DOMINANT = {
  right: {
    sideLabel: "Rechts",
    shoulder: 12,
    elbow: 14,
    wrist: 16,
  },
  left: {
    sideLabel: "Links",
    shoulder: 11,
    elbow: 13,
    wrist: 15,
  },
};

const STORAGE_KEYS = {
  insightView: "padel-motion-coach:view",
  lastSession: "padel-motion-coach:last-session",
};

function createStrokeBuckets() {
  return STROKE_TYPES.reduce((acc, stroke) => {
    acc[stroke] = {
      total: 0,
      good: 0,
      bad: 0,
      scoreSum: 0,
    };
    return acc;
  }, {});
}

function createSessionState() {
  return {
    active: false,
    startedAt: 0,
    endedAt: 0,
    totalStrokes: 0,
    good: 0,
    bad: 0,
    totalScore: 0,
    byStroke: createStrokeBuckets(),
    weaknesses: {
      elbow: 0,
      shoulder: 0,
      knee: 0,
      contact: 0,
      balance: 0,
    },
    timeline: [],
    lastRegisteredAt: 0,
    lastRegisteredStroke: "",
  };
}

function createRecordingState() {
  return {
    supported: typeof MediaRecorder !== "undefined",
    active: false,
    recorder: null,
    chunks: [],
    url: "",
    mimeType: "",
  };
}

const state = {
  poseLandmarker: null,
  running: false,
  stream: null,
  facingMode: "environment",
  animationFrameId: null,
  lastVideoTime: -1,
  lastFrameAt: performance.now(),
  smoothedLandmarks: null,
  previousDominantWrist: null,
  currentStroke: "Wachten",
  tracking: { x: 0, y: 0, scale: 1 },
  history: [],
  session: createSessionState(),
  strokeCandidate: null,
  recording: createRecordingState(),
  readiness: null,
  savedSession: null,
  ui: {
    insightView: "live",
  },
};

function loadPersistedUiState() {
  const savedView = readStorage(STORAGE_KEYS.insightView);
  if (savedView && ["live", "session", "coach"].includes(savedView)) {
    state.ui.insightView = savedView;
  }

  const savedSessionRaw = readStorage(STORAGE_KEYS.lastSession);
  if (!savedSessionRaw) {
    return;
  }

  try {
    const parsed = JSON.parse(savedSessionRaw);
    if (parsed && typeof parsed === "object") {
      state.savedSession = parsed;
    }
  } catch {
    state.savedSession = null;
  }
}

function setStatus(message) {
  statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toCanvasPoint(landmark) {
  return { x: landmark.x * canvas.width, y: landmark.y * canvas.height };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function smoothLandmarks(nextLandmarks) {
  if (!state.smoothedLandmarks) {
    state.smoothedLandmarks = nextLandmarks.map((landmark) => ({ ...landmark }));
    return state.smoothedLandmarks;
  }

  state.smoothedLandmarks = nextLandmarks.map((landmark, index) => {
    const previous = state.smoothedLandmarks[index];
    const visibility = landmark.visibility ?? landmark.presence ?? 1;
    const alpha = visibility > 0.85 ? 0.52 : 0.34;

    return {
      ...landmark,
      x: previous.x + (landmark.x - previous.x) * alpha,
      y: previous.y + (landmark.y - previous.y) * alpha,
      z: previous.z + (landmark.z - previous.z) * alpha,
    };
  });

  return state.smoothedLandmarks;
}

function angleAt(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) {
    return 0;
  }

  const value = clamp(dot / mag, -1, 1);
  return Math.round((Math.acos(value) * 180) / Math.PI);
}

function rangeScore(value, min, max, tolerance = 18) {
  if (value >= min && value <= max) {
    return 1;
  }
  if (value < min) {
    return clamp(1 - (min - value) / tolerance, 0, 1);
  }
  return clamp(1 - (value - max) / tolerance, 0, 1);
}

function computeMetrics(landmarks) {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const rightElbow = landmarks[14];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];
  const nose = landmarks[0];

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderWidth = distance(leftShoulder, rightShoulder) || 0.12;
  const stanceWidth = distance(leftAnkle, rightAnkle) / shoulderWidth;

  return {
    joints: {
      rightElbow: angleAt(rightShoulder, rightElbow, rightWrist),
      leftElbow: angleAt(leftShoulder, leftElbow, leftWrist),
      rightShoulder: angleAt(rightElbow, rightShoulder, rightHip),
      leftShoulder: angleAt(leftElbow, leftShoulder, leftHip),
      rightKnee: angleAt(rightHip, rightKnee, rightAnkle),
      leftKnee: angleAt(leftHip, leftKnee, leftAnkle),
      rightHip: angleAt(rightShoulder, rightHip, rightKnee),
      leftHip: angleAt(leftShoulder, leftHip, leftKnee),
    },
    points: {
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      leftAnkle,
      rightAnkle,
      nose,
      shoulderCenter,
      hipCenter,
    },
    shoulderWidth,
    stanceWidth,
  };
}

function computeReadiness(landmarks) {
  const keyIndexes = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  const keyLandmarks = keyIndexes.map((index) => landmarks[index]);
  const visibilityAverage =
    keyLandmarks.reduce(
      (sum, landmark) => sum + (landmark.visibility ?? landmark.presence ?? 1),
      0,
    ) / keyLandmarks.length;

  const xs = keyLandmarks.map((landmark) => landmark.x);
  const ys = keyLandmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const margin = Math.min(minX, 1 - maxX, minY, 1 - maxY);

  const visibilityScore = Math.round(clamp(visibilityAverage, 0, 1) * 100);
  const framingScore = Math.round(
    clamp(width / 0.34, 0, 1) * 45 +
      clamp(height / 0.62, 0, 1) * 35 +
      clamp((margin + 0.08) / 0.16, 0, 1) * 20,
  );
  const score = Math.round(visibilityScore * 0.58 + framingScore * 0.42);
  const status =
    score >= 82 ? "Analyse klaar" : score >= 62 ? "Bijna goed" : "Beeld bijstellen";

  let summary = "De speler staat goed in beeld voor betrouwbare slagregistratie.";
  if (score < 62) {
    summary =
      margin < 0.03
        ? "De speler raakt de rand van het beeld. Zet de telefoon iets verder weg of hoger."
        : "Nog te weinig lichaamspunten zichtbaar. Zorg dat schouders, heupen en knieen volledig in beeld zijn.";
  } else if (score < 82) {
    summary =
      "De analyse is bruikbaar, maar iets meer afstand of een stabielere framing maakt de coach nauwkeuriger.";
  }

  return {
    score,
    status,
    visibilityScore,
    framingScore,
    summary,
  };
}

function getDominantMetrics(metrics, handedness) {
  const points = metrics.points;
  const wrist = handedness === "right" ? points.rightWrist : points.leftWrist;
  const shoulder =
    handedness === "right" ? points.rightShoulder : points.leftShoulder;
  const hip = handedness === "right" ? points.rightHip : points.leftHip;
  const oppositeShoulder =
    handedness === "right" ? points.leftShoulder : points.rightShoulder;

  const elbowAngle =
    handedness === "right" ? metrics.joints.rightElbow : metrics.joints.leftElbow;
  const shoulderAngle =
    handedness === "right"
      ? metrics.joints.rightShoulder
      : metrics.joints.leftShoulder;
  const kneeAngle = (metrics.joints.rightKnee + metrics.joints.leftKnee) / 2;

  const shoulderCenter = points.shoulderCenter;
  const hipCenter = points.hipCenter;
  const wristSideOffset =
    handedness === "right"
      ? (wrist.x - shoulderCenter.x) / metrics.shoulderWidth
      : (shoulderCenter.x - wrist.x) / metrics.shoulderWidth;
  const crossedBody =
    handedness === "right"
      ? wrist.x < shoulderCenter.x - metrics.shoulderWidth * 0.02
      : wrist.x > shoulderCenter.x + metrics.shoulderWidth * 0.02;
  const contactHeight =
    (hip.y - wrist.y) / Math.max(hip.y - shoulder.y, 0.001);
  const trunkLean = Math.abs(
    (Math.atan2(shoulderCenter.x - hipCenter.x, hipCenter.y - shoulderCenter.y) *
      180) /
      Math.PI,
  );
  const shoulderLineTilt = Math.abs(
    (Math.atan2(
      oppositeShoulder.y - shoulder.y,
      oppositeShoulder.x - shoulder.x,
    ) *
      180) /
      Math.PI,
  );

  return {
    wrist,
    shoulder,
    hip,
    elbowAngle,
    shoulderAngle,
    kneeAngle,
    wristSideOffset,
    crossedBody,
    contactHeight,
    trunkLean,
    shoulderLineTilt,
  };
}

function classifyStroke(metrics, handedness, now) {
  const dominant = getDominantMetrics(metrics, handedness);
  const wristPoint = dominant.wrist;
  const previous = state.previousDominantWrist;
  const timeDelta = previous ? Math.max((now - previous.time) / 1000, 0.016) : 0.016;
  const velocity = previous
    ? {
        x: (wristPoint.x - previous.x) / timeDelta,
        y: (wristPoint.y - previous.y) / timeDelta,
      }
    : { x: 0, y: 0 };

  state.previousDominantWrist = { ...wristPoint, time: now };

  const speed = Math.hypot(velocity.x, velocity.y);
  const isOverheadZone =
    wristPoint.y < metrics.points.nose.y + 0.02 &&
    dominant.elbowAngle > 120 &&
    dominant.shoulderAngle > 78;
  const isForehandZone =
    dominant.wristSideOffset > 0.08 &&
    dominant.contactHeight > 0.1 &&
    dominant.contactHeight < 1.4;
  const isBackhandZone =
    dominant.crossedBody &&
    dominant.contactHeight > 0.1 &&
    dominant.contactHeight < 1.3;
  const isVolleyZone =
    dominant.contactHeight > 0.45 &&
    dominant.contactHeight < 1.15 &&
    dominant.elbowAngle >= 80 &&
    dominant.elbowAngle <= 135 &&
    dominant.shoulderAngle <= 98;

  const strokeScores = [
    {
      name: "Overhead / smash",
      score:
        (isOverheadZone ? 0.48 : 0.08) +
        rangeScore(dominant.elbowAngle, 135, 180, 28) * 0.18 +
        rangeScore(dominant.shoulderAngle, 95, 175, 25) * 0.18 +
        clamp(speed / 1.6, 0, 1) * 0.16,
    },
    {
      name: "Forehand",
      score:
        (isForehandZone ? 0.45 : 0.1) +
        rangeScore(dominant.elbowAngle, 95, 155, 25) * 0.18 +
        rangeScore(dominant.shoulderAngle, 35, 120, 28) * 0.14 +
        clamp(Math.abs(velocity.x) / 1.25, 0, 1) * 0.23,
    },
    {
      name: "Backhand",
      score:
        (isBackhandZone ? 0.46 : 0.08) +
        rangeScore(dominant.elbowAngle, 85, 150, 24) * 0.18 +
        rangeScore(dominant.shoulderAngle, 30, 115, 24) * 0.14 +
        clamp(Math.abs(velocity.x) / 1.15, 0, 1) * 0.22,
    },
    {
      name: "Volley",
      score:
        (isVolleyZone ? 0.42 : 0.1) +
        rangeScore(dominant.elbowAngle, 85, 125, 22) * 0.18 +
        rangeScore(dominant.kneeAngle, 130, 165, 26) * 0.12 +
        clamp(speed / 1.1, 0, 1) * 0.18,
    },
  ].sort((a, b) => b.score - a.score);

  const best = strokeScores[0];
  const stableStroke = best.score >= 0.56 ? best.name : "Ready positie";

  state.history.push({ name: stableStroke, score: best.score, at: now });
  state.history = state.history.filter((item) => now - item.at < 900);

  const voteCounts = state.history.reduce((acc, item) => {
    acc[item.name] = (acc[item.name] ?? 0) + item.score;
    return acc;
  }, {});

  const [stableName = stableStroke, stableScore = best.score] =
    Object.entries(voteCounts).sort((a, b) => b[1] - a[1])[0] ?? [
      stableStroke,
      best.score,
    ];

  return {
    name: stableName,
    confidence: clamp(stableScore / Math.max(state.history.length, 1), 0, 1),
    speed,
  };
}

function evaluateTechnique(stroke, metrics, handedness) {
  const dominant = getDominantMetrics(metrics, handedness);
  const templates = {
    Forehand: [
      {
        label: "Slagarm",
        tag: "elbow",
        value: dominant.elbowAngle,
        min: 95,
        max: 150,
        message: "Houd je slagarm iets compacter voor meer controle in de forehand.",
      },
      {
        label: "Schouderpositie",
        tag: "shoulder",
        value: dominant.shoulderAngle,
        min: 40,
        max: 115,
        message: "Breng je arm iets vrijer naast je romp in de voorbereiding.",
      },
      {
        label: "Beenwerk",
        tag: "knee",
        value: dominant.kneeAngle,
        min: 135,
        max: 168,
        message: "Zak iets dieper door je knieen om stabieler te staan.",
      },
      {
        label: "Contactpunt",
        tag: "contact",
        value: dominant.contactHeight,
        min: 0.25,
        max: 1.15,
        tolerance: 0.4,
        message: "Raak de bal liever tussen heup en schouder voor een schonere forehand.",
      },
    ],
    Backhand: [
      {
        label: "Slagarm",
        tag: "elbow",
        value: dominant.elbowAngle,
        min: 90,
        max: 145,
        message: "Houd je backhand-arm iets rustiger en compacter.",
      },
      {
        label: "Schouderpositie",
        tag: "shoulder",
        value: dominant.shoulderAngle,
        min: 35,
        max: 110,
        message: "Open je schouderlijn net iets meer richting de bal.",
      },
      {
        label: "Beenwerk",
        tag: "knee",
        value: dominant.kneeAngle,
        min: 135,
        max: 168,
        message: "Blijf laag op je benen tijdens de backhand.",
      },
      {
        label: "Middellijn",
        tag: "balance",
        value: dominant.crossedBody ? 1 : 0,
        min: 1,
        max: 1,
        tolerance: 1,
        message: "Breng het racket eerder door de middellijn voor je contactmoment.",
      },
    ],
    Volley: [
      {
        label: "Slagarm",
        tag: "elbow",
        value: dominant.elbowAngle,
        min: 85,
        max: 125,
        message: "Houd je volley compact; laat je elleboog minder open vallen.",
      },
      {
        label: "Schouderpositie",
        tag: "shoulder",
        value: dominant.shoulderAngle,
        min: 35,
        max: 92,
        message: "Houd je racket iets meer voor je lichaam bij de volley.",
      },
      {
        label: "Beenwerk",
        tag: "knee",
        value: dominant.kneeAngle,
        min: 130,
        max: 165,
        message: "Werk lager vanuit je benen voor meer stabiliteit aan het net.",
      },
      {
        label: "Contactpunt",
        tag: "contact",
        value: dominant.contactHeight,
        min: 0.45,
        max: 1.05,
        tolerance: 0.35,
        message: "Zoek je volley-contact meer rond borsthoogte.",
      },
    ],
    "Overhead / smash": [
      {
        label: "Slagarm",
        tag: "elbow",
        value: dominant.elbowAngle,
        min: 138,
        max: 180,
        message: "Strek je slagarm verder uit boven je hoofd voor meer lengte.",
      },
      {
        label: "Schouderpositie",
        tag: "shoulder",
        value: dominant.shoulderAngle,
        min: 98,
        max: 175,
        message: "Breng je arm hoger in je trophy-positie voor de overhead.",
      },
      {
        label: "Beenwerk",
        tag: "knee",
        value: dominant.kneeAngle,
        min: 130,
        max: 165,
        message: "Laad de overhead met iets meer beenwerk.",
      },
      {
        label: "Contactpunt",
        tag: "contact",
        value: dominant.contactHeight,
        min: 1.05,
        max: 2,
        tolerance: 0.5,
        message: "Raak de bal hoger boven je hoofd voor een betere smash.",
      },
    ],
    "Ready positie": [
      {
        label: "Basishouding",
        tag: "knee",
        value: dominant.kneeAngle,
        min: 135,
        max: 170,
        message: "Blijf licht door je knieen in je ready positie.",
      },
      {
        label: "Racketpositie",
        tag: "balance",
        value: dominant.elbowAngle,
        min: 80,
        max: 130,
        message: "Houd je racket-arm compact en klaar voor de volgende bal.",
      },
    ],
  };

  const checks = templates[stroke] ?? templates["Ready positie"];
  const scoredChecks = checks.map((check) => {
    const tolerance = check.tolerance ?? 18;
    const score = rangeScore(check.value, check.min, check.max, tolerance);
    return { ...check, score };
  });

  const averageScore =
    scoredChecks.reduce((sum, check) => sum + check.score, 0) / scoredChecks.length;
  const issues = scoredChecks
    .filter((check) => check.score < 0.74)
    .sort((a, b) => a.score - b.score);
  const feedback = issues.slice(0, 3).map((check) => check.message);

  return {
    score: Math.round(averageScore * 100),
    feedback:
      feedback.length > 0
        ? feedback
        : [
            "Mooie balans in deze houding. Blijf de slag in hetzelfde ritme herhalen.",
          ],
    issues,
  };
}

function updateScoreRing(score) {
  const ring = document.querySelector(".score-ring");
  ring.style.background = `conic-gradient(
    from 180deg,
    var(--accent) 0deg,
    var(--accent-2) ${score * 2.4}deg,
    rgba(255, 255, 255, 0.08) ${score * 3.6}deg,
    rgba(255, 255, 255, 0.08) 360deg
  )`;
}

function renderFeedback(items) {
  feedbackList.innerHTML = "";
  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    feedbackList.appendChild(listItem);
  });
}

function resetLiveFocusPanel() {
  liveFocusHeadline.textContent = "Nog geen focuspunt";
  liveFocusSummary.textContent =
    "De coach vertaalt je techniek live naar een simpel, bruikbaar focuspunt.";
  liveFocusList.innerHTML = "";
  [
    "Start de camera om een live focuspunt te krijgen.",
    "De app gebruikt biomechanica intern, maar toont vooral coachbare aanwijzingen.",
    "Zo blijft de feedback bruikbaar tijdens het spelen.",
  ].forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    liveFocusList.appendChild(item);
  });
}

function renderLiveFocusPanel(stroke, confidence, technique) {
  const primaryIssue = technique.issues[0];
  const issueLabel = primaryIssue
    ? ISSUE_LIBRARY[primaryIssue.tag]?.label ?? primaryIssue.label.toLowerCase()
    : "ritme";

  if (stroke === "Ready positie") {
    liveFocusHeadline.textContent = "Klaar voor de volgende bal";
    liveFocusSummary.textContent =
      "Nog geen duidelijke slag, dus de beste winst zit nu in basispositie, rust en klaarstaan.";
    liveFocusList.innerHTML = "";
    [
      "Blijf licht door je benen en houd je racket compact voor je lichaam.",
      "Zorg dat je vroeg klaar staat zodat de volgende slag beter herkenbaar en uitvoerbaar wordt.",
      `Analysevertrouwen: ${Math.round(confidence * 100)}%.`,
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      liveFocusList.appendChild(item);
    });
    return;
  }

  liveFocusHeadline.textContent =
    technique.score >= 85 ? `${stroke} vasthouden` : `${stroke}: focus op ${issueLabel}`;
  liveFocusSummary.textContent =
    technique.score >= 85
      ? `Deze ${stroke.toLowerCase()} oogt stabiel. De coach zou nu vooral ritme en herhaalbaarheid bewaken.`
      : `Voor deze ${stroke.toLowerCase()} zit de meeste winst nu in ${issueLabel}. De metingen blijven intern de basis, maar de coach vertaalt dat naar een direct bruikbare cue.`;

  const focusItems = [...technique.feedback];
  focusItems.push(
    `Coachscore ${technique.score}/100 met ${Math.round(confidence * 100)}% herkenningszekerheid.`,
  );

  liveFocusList.innerHTML = "";
  focusItems.slice(0, 3).forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    liveFocusList.appendChild(item);
  });
}

function jointColor(stroke, key, value) {
  const range = getJointRange(stroke, key);
  if (!range) {
    return "rgba(125, 200, 255, 0.9)";
  }

  const score = rangeScore(value, range[0], range[1], 20);
  if (score >= 0.85) {
    return "rgba(67, 224, 179, 0.95)";
  }
  if (score >= 0.55) {
    return "rgba(255, 205, 109, 0.95)";
  }
  return "rgba(255, 111, 145, 0.95)";
}

function getJointRange(stroke, key) {
  const dominantKey =
    handednessSelect.value === "right"
      ? {
          elbow: "rightElbow",
          shoulder: "rightShoulder",
        }
      : {
          elbow: "leftElbow",
          shoulder: "leftShoulder",
        };

  const ranges = {
    Forehand: {
      [dominantKey.elbow]: [95, 150],
      [dominantKey.shoulder]: [40, 115],
      rightKnee: [135, 170],
      leftKnee: [135, 170],
    },
    Backhand: {
      [dominantKey.elbow]: [90, 145],
      [dominantKey.shoulder]: [35, 110],
      rightKnee: [135, 170],
      leftKnee: [135, 170],
    },
    Volley: {
      [dominantKey.elbow]: [85, 125],
      [dominantKey.shoulder]: [35, 92],
      rightKnee: [130, 165],
      leftKnee: [130, 165],
    },
    "Overhead / smash": {
      [dominantKey.elbow]: [138, 180],
      [dominantKey.shoulder]: [98, 175],
      rightKnee: [130, 165],
      leftKnee: [130, 165],
    },
    "Ready positie": {
      [dominantKey.elbow]: [80, 130],
      [dominantKey.shoulder]: [35, 100],
      rightKnee: [135, 170],
      leftKnee: [135, 170],
    },
  };

  return ranges[stroke]?.[key] ?? null;
}

function getJointCue(stroke, key, value) {
  const range = getJointRange(stroke, key);
  if (!range) {
    return "";
  }

  const score = rangeScore(value, range[0], range[1], 20);
  if (score >= 0.85) {
    if (key.includes("Knee")) {
      return "basis ok";
    }
    if (key.includes("Shoulder")) {
      return "schouder ok";
    }
    return "arm ok";
  }

  if (value < range[0]) {
    if (key.includes("Knee")) {
      return "iets hoger";
    }
    if (key.includes("Shoulder")) {
      return stroke === "Overhead / smash" ? "arm hoger" : "meer openen";
    }
    return "meer strekken";
  }

  if (key.includes("Knee")) {
    return "lager";
  }
  if (key.includes("Shoulder")) {
    return stroke === "Overhead / smash" ? "rustiger" : "minder open";
  }
  return "compacter";
}

function drawRoundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();

  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, safeRadius);
    return;
  }

  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawLabel(point, text, color) {
  context.font = "700 15px 'Space Grotesk'";
  const paddingX = 10;
  const metrics = context.measureText(text);
  const width = metrics.width + paddingX * 2;
  const height = 32;
  const x = clamp(point.x - width / 2, 10, canvas.width - width - 10);
  const y = clamp(point.y - 48, 12, canvas.height - height - 10);

  context.fillStyle = "rgba(4, 12, 19, 0.9)";
  drawRoundedRect(x, y, width, height, 14);
  context.fill();

  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.stroke();

  context.fillStyle = color;
  context.fillText(text, x + paddingX, y + 21);
}

function drawSkeleton(landmarks, joints, stroke) {
  context.clearRect(0, 0, canvas.width, canvas.height);

  const visibilityThreshold = 0.45;
  const visible = (index) =>
    (landmarks[index].visibility ?? landmarks[index].presence ?? 1) > visibilityThreshold;

  CONNECTIONS.forEach(([start, end]) => {
    if (!visible(start) || !visible(end)) {
      return;
    }

    const a = toCanvasPoint(landmarks[start]);
    const b = toCanvasPoint(landmarks[end]);
    const dominantSide = DOMINANT[handednessSelect.value];
    const isDominantSegment =
      [dominantSide.shoulder, dominantSide.elbow, dominantSide.wrist].includes(start) ||
      [dominantSide.shoulder, dominantSide.elbow, dominantSide.wrist].includes(end);

    context.strokeStyle = isDominantSegment
      ? "rgba(67, 224, 179, 0.9)"
      : "rgba(125, 200, 255, 0.6)";
    context.lineWidth = isDominantSegment ? 6 : 4;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(a.x, a.y);
    context.lineTo(b.x, b.y);
    context.stroke();
  });

  const jointPoints = {
    rightElbow: toCanvasPoint(landmarks[14]),
    leftElbow: toCanvasPoint(landmarks[13]),
    rightShoulder: toCanvasPoint(landmarks[12]),
    leftShoulder: toCanvasPoint(landmarks[11]),
    rightKnee: toCanvasPoint(landmarks[26]),
    leftKnee: toCanvasPoint(landmarks[25]),
  };

  Object.entries(jointPoints).forEach(([key, point]) => {
    const color = jointColor(stroke, key, joints[key]);
    context.fillStyle = color;
    context.beginPath();
    context.arc(point.x, point.y, 8, 0, Math.PI * 2);
    context.fill();

    if (labelsToggle.checked) {
      const cue = getJointCue(stroke, key, joints[key]);
      if (cue) {
        drawLabel(point, cue, color);
      }
    }
  });
}

function updateTrackingTransform(landmarks) {
  if (!trackingToggle.checked) {
    state.tracking = { x: 0, y: 0, scale: 1 };
    trackingLayer.style.transform = "translate(0px, 0px) scale(1)";
    focusValue.textContent = "Uit";
    return;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = clamp(maxX - minX, 0.16, 0.68);
  const height = clamp(maxY - minY, 0.22, 0.92);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const desiredScale = clamp(0.54 / width, 1, 1.45);
  const desiredX = (0.5 - centerX) * canvas.clientWidth * desiredScale;
  const desiredY = (0.45 - centerY) * canvas.clientHeight * desiredScale;

  state.tracking.x += (desiredX - state.tracking.x) * 0.18;
  state.tracking.y += (desiredY - state.tracking.y) * 0.18;
  state.tracking.scale += (desiredScale - state.tracking.scale) * 0.15;

  trackingLayer.style.transform = `translate(${state.tracking.x}px, ${state.tracking.y}px) scale(${state.tracking.scale})`;
  focusValue.textContent = `${Math.round(state.tracking.scale * 100)}% focus`;

  context.save();
  context.strokeStyle = "rgba(67, 224, 179, 0.7)";
  context.lineWidth = 2;
  context.setLineDash([14, 10]);
  context.strokeRect(
    minX * canvas.width - 18,
    minY * canvas.height - 18,
    width * canvas.width + 36,
    height * canvas.height + 36,
  );
  context.restore();
}

function buildLiveFeedback(technique) {
  const items = [...technique.feedback];
  if (state.session.active) {
    items.push(
      `Sessie loopt: ${state.session.totalStrokes} slagen geregistreerd. Goed: ${state.session.good}, niet goed: ${state.session.bad}.`,
    );
  }
  return items.slice(0, 3);
}

function updateLiveDashboard(stroke, confidence, technique) {
  const score = technique.score;
  state.currentStroke = stroke;

  strokeText.textContent = stroke;
  detectionHeadline.textContent = stroke;
  detectionDetail.textContent =
    stroke === "Ready positie"
      ? "De speler staat klaar. Zodra de swing inzet, schat de app automatisch het slagtype."
      : "Live inschatting op basis van armpositie, bewegingssnelheid en contacthoogte.";
  confidenceValue.textContent = `${Math.round(confidence * 100)}%`;
  armValue.textContent = DOMINANT[handednessSelect.value].sideLabel;
  scoreValue.textContent = String(score);
  techniqueBadge.textContent =
    score >= 85 ? "Sterke techniek" : score >= 65 ? "Redelijke timing" : "Werkpunt gevonden";
  scoreSummary.textContent =
    score >= 85
      ? "Deze slag oogt technisch stabiel en goed herhaalbaar."
      : "Gebruik de coachingregels hieronder om de volgende herhalingen scherper te maken.";

  updateScoreRing(score);
  renderFeedback(buildLiveFeedback(technique));
  renderLiveFocusPanel(stroke, confidence, technique);
}

function resetLiveDashboard() {
  detectionHeadline.textContent = "Geen actieve slag";
  detectionDetail.textContent =
    "Zodra de dominante arm versnelt, schat de app of het om een forehand, backhand, volley of overhead gaat.";
  confidenceValue.textContent = "0%";
  armValue.textContent = DOMINANT[handednessSelect.value].sideLabel;
  focusValue.textContent = trackingToggle.checked ? "Automatisch" : "Uit";
  scoreValue.textContent = "--";
  techniqueBadge.textContent = "Nog geen meting";
  scoreSummary.textContent =
    "Start de camera om slagkwaliteit, techniek en coaching live te meten.";
  trackingText.textContent = "Nog geen speler in beeld";
  strokeText.textContent = "Wachten";
  fpsChip.textContent = "0 FPS";
  updateScoreRing(0);
  renderFeedback(DEFAULT_LIVE_FEEDBACK);
  resetLiveFocusPanel();
}

function setInsightView(view) {
  state.ui.insightView = view;
  insightGrid.dataset.activeView = view;
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.insightView === view);
  });
  writeStorage(STORAGE_KEYS.insightView, view);
}

function resetReadinessUi() {
  state.readiness = null;
  readinessHeadline.textContent = "Beeld controleren";
  readinessScoreValue.textContent = "--";
  visibilityQualityValue.textContent = "--";
  framingQualityValue.textContent = "--";
  readinessSummary.textContent =
    "Zorg dat de speler volledig in beeld is voordat je de sessie start.";
}

function renderReadinessUi(readiness) {
  state.readiness = readiness;
  readinessHeadline.textContent = readiness.status;
  readinessScoreValue.textContent = `${readiness.score}`;
  visibilityQualityValue.textContent = `${readiness.visibilityScore}%`;
  framingQualityValue.textContent = `${readiness.framingScore}%`;
  readinessSummary.textContent = readiness.summary;
}

function getSessionInsights() {
  const playedStrokes = STROKE_TYPES.map((stroke) => {
    const bucket = state.session.byStroke[stroke];
    return {
      stroke,
      total: bucket.total,
      good: bucket.good,
      bad: bucket.bad,
      ratio: bucket.total ? Math.round((bucket.good / bucket.total) * 100) : 0,
    };
  }).filter((stroke) => stroke.total > 0);

  const bestStroke = [...playedStrokes]
    .filter((stroke) => stroke.total >= 1)
    .sort((a, b) => b.ratio - a.ratio || b.total - a.total)[0] ?? null;
  const weakStroke = [...playedStrokes]
    .filter((stroke) => stroke.total >= 1)
    .sort((a, b) => a.ratio - b.ratio || b.total - a.total)[0] ?? null;

  let streak = 0;
  for (let index = state.session.timeline.length - 1; index >= 0; index -= 1) {
    if (!state.session.timeline[index].good) {
      break;
    }
    streak += 1;
  }

  return {
    playedStrokes,
    bestStroke,
    weakStroke,
    streak,
  };
}

function renderSessionSignals() {
  const { bestStroke, weakStroke, streak } = getSessionInsights();

  bestStrokeValue.textContent = bestStroke
    ? `${bestStroke.stroke} (${bestStroke.ratio}%)`
    : "--";
  weakStrokeValue.textContent = weakStroke
    ? `${weakStroke.stroke} (${weakStroke.ratio}%)`
    : "--";
  streakValue.textContent = String(streak);

  if (state.session.totalStrokes === 0) {
    sessionFocusHeadline.textContent = "Nog geen focus";
    sessionSignalList.innerHTML = "";
    [
      "De app laat hier je spelbeeld en momentum zien zodra de sessie loopt.",
      "Na meerdere slagen zie je welke slag stabiel is en waar je vorm breekt.",
      "Gebruik dit als snelle samenvatting tussen rally's door.",
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      sessionSignalList.appendChild(item);
    });
    return;
  }

  sessionFocusHeadline.textContent =
    streak >= 3
      ? "Je hebt momentum"
      : weakStroke
        ? `${weakStroke.stroke} vraagt aandacht`
        : "Sessiebeeld bouwt op";

  const signalTexts = [];
  if (bestStroke) {
    signalTexts.push(
      `${bestStroke.stroke} is nu je sterkste slag met ${bestStroke.ratio}% goede uitvoering.`,
    );
  }
  if (weakStroke) {
    signalTexts.push(
      `${weakStroke.stroke} levert relatief de meeste missers op. Verlaag daar je tempo en focus op voorbereiding.`,
    );
  }
  signalTexts.push(
    streak >= 2
      ? `Je huidige reeks staat op ${streak} goede slag${streak === 1 ? "" : "en"} achter elkaar.`
      : "Je hebt nog geen langere goede reeks. Zoek eerst rust en herhaalbaarheid.",
  );

  sessionSignalList.innerHTML = "";
  signalTexts.slice(0, 3).forEach((text) => {
    const item = document.createElement("li");
    item.textContent = text;
    sessionSignalList.appendChild(item);
  });
}

function renderTimeline() {
  timelineHeadline.textContent =
    state.session.timeline.length > 0
      ? `Laatste ${Math.min(state.session.timeline.length, 6)} slagen`
      : "Nog geen slagen opgeslagen";

  sessionTimelineList.innerHTML = "";
  if (state.session.timeline.length === 0) {
    [
      "Start een sessie om hier je recente slagen terug te zien.",
      "De lijst laat per slag zien of de uitvoering goed of minder goed was.",
      "Zo zie je snel of je momentum stijgt of juist wegvalt.",
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      sessionTimelineList.appendChild(item);
    });
    return;
  }

  const recent = [...state.session.timeline].slice(-6).reverse();
  recent.forEach((entry, index) => {
    const item = document.createElement("li");
    item.textContent = `${index + 1}. ${entry.stroke} · ${entry.score}/100 · ${entry.good ? "goed" : "niet goed"}`;
    sessionTimelineList.appendChild(item);
  });
}

function createSessionSnapshot() {
  const durationMs = getSessionDurationMs();
  const { bestStroke, weakStroke } = getSessionInsights();
  const averageScore =
    state.session.totalStrokes > 0
      ? Math.round(state.session.totalScore / state.session.totalStrokes)
      : 0;

  return {
    createdAt: new Date().toISOString(),
    durationMs,
    totalStrokes: state.session.totalStrokes,
    good: state.session.good,
    bad: state.session.bad,
    averageScore,
    bestStroke: bestStroke?.stroke ?? "",
    weakStroke: weakStroke?.stroke ?? "",
    byStroke: state.session.byStroke,
    weaknesses: state.session.weaknesses,
    timeline: state.session.timeline,
  };
}

function persistSessionSnapshot() {
  const snapshot = createSessionSnapshot();
  state.savedSession = snapshot;
  writeStorage(STORAGE_KEYS.lastSession, JSON.stringify(snapshot));
}

function renderSavedSession() {
  if (!state.savedSession || !state.savedSession.totalStrokes) {
    savedSessionValue.textContent = "--";
    savedHeadline.textContent = "Nog niets opgeslagen";
    savedSummary.textContent =
      "Na een afgeronde sessie bewaart de app lokaal je laatste samenvatting op dit toestel.";
    return;
  }

  const quality = Math.round(
    (state.savedSession.good / Math.max(state.savedSession.totalStrokes, 1)) * 100,
  );
  const dateLabel = new Date(state.savedSession.createdAt).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });

  savedSessionValue.textContent = `${state.savedSession.totalStrokes} slagen`;
  savedHeadline.textContent = `Laatste sessie · ${dateLabel}`;
  savedSummary.textContent = `${state.savedSession.good} goed en ${state.savedSession.bad} niet goed, gemiddelde ${state.savedSession.averageScore}/100. Beste slag: ${state.savedSession.bestStroke || "n.v.t."}. Goedratio: ${quality}%.`;
}

function renderCoachFocus() {
  const { bestStroke, weakStroke } = getSessionInsights();
  const topIssue =
    Object.entries(state.session.weaknesses).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

  if (state.session.totalStrokes === 0) {
    focusBadge.textContent = "Nog geen focusblok";
    nextDrillValue.textContent = "--";
    gamePatternValue.textContent = "--";
    focusSummary.textContent =
      "De coach vertaalt je sessie straks naar een direct trainingsaccent voor je volgende blok.";
    if (state.savedSession?.totalStrokes) {
      savedSessionValue.textContent = `${state.savedSession.totalStrokes} slagen`;
    }
    return;
  }

  const drillLabel =
    topIssue[1] > 0 && ISSUE_LIBRARY[topIssue[0]]
      ? ISSUE_LIBRARY[topIssue[0]].label
      : weakStroke?.stroke ?? "basisritme";
  const pattern =
    bestStroke && weakStroke && bestStroke.stroke !== weakStroke.stroke
      ? `${bestStroke.stroke} sterk, ${weakStroke.stroke} kwetsbaar`
      : bestStroke
        ? `${bestStroke.stroke} domineert je spelbeeld`
        : "Nog te weinig variatie";

  focusBadge.textContent =
    weakStroke && weakStroke.ratio < 60 ? "Werkblok nodig" : "Volgende trainingsfocus";
  nextDrillValue.textContent = drillLabel;
  gamePatternValue.textContent = pattern;
  focusSummary.textContent =
    topIssue[1] > 0 && ISSUE_LIBRARY[topIssue[0]]
      ? ISSUE_LIBRARY[topIssue[0]].tip
      : "Blijf meerdere slagen per soort verzamelen zodat de coach een scherper drill-advies kan geven.";
}

function exportSessionReport() {
  if (state.session.totalStrokes === 0 && !state.savedSession?.totalStrokes) {
    return;
  }

  const snapshot =
    state.session.totalStrokes > 0 ? createSessionSnapshot() : state.savedSession;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `padel-session-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getSessionDurationMs() {
  if (!state.session.startedAt) {
    return 0;
  }

  const endTime = state.session.active ? Date.now() : state.session.endedAt;
  return Math.max(0, endTime - state.session.startedAt);
}

function renderSessionStats() {
  sessionStatsGrid.innerHTML = "";

  STROKE_TYPES.forEach((stroke) => {
    const bucket = state.session.byStroke[stroke];
    const successRatio = bucket.total
      ? Math.round((bucket.good / bucket.total) * 100)
      : 0;

    const row = document.createElement("div");
    row.className = "stroke-row";
    row.innerHTML = `
      <div class="stroke-row-main">
        <strong>${stroke}</strong>
        <span>${bucket.good} goed · ${bucket.bad} niet goed</span>
      </div>
      <div class="stroke-row-meta">
        <strong>${bucket.total}</strong>
        <span>${successRatio}% goed</span>
      </div>
    `;
    sessionStatsGrid.appendChild(row);
  });
}

function buildCoachReport() {
  const { totalStrokes, good, bad, totalScore, byStroke, weaknesses } = state.session;

  if (totalStrokes === 0) {
    return {
      headline: "Nog geen sessie-analyse",
      summary:
        "Start een sessie om slagen te tellen, techniek te scoren en een coachrapport op te bouwen.",
      tips: DEFAULT_COACH_FEEDBACK,
    };
  }

  if (totalStrokes < 3) {
    return {
      headline: state.session.active
        ? "Coach verzamelt nog rally-data"
        : "Coach heeft nog weinig sessiedata",
      summary:
        "Er zijn al slagen geregistreerd, maar nog niet genoeg voor een stabiel patroon. Speel nog een paar duidelijke rallyslagen.",
      tips: [
        "Houd dezelfde speler volledig in beeld zodat de coach slagen niet mist.",
        "Maak je swing duidelijk af; korte twijfelbeelden worden minder snel als slag opgeslagen.",
        "Na ongeveer drie of meer slagen wordt de analyse per slagsoort betrouwbaarder.",
      ],
    };
  }

  const averageScore = Math.round(totalScore / totalStrokes);
  const goodRatio = Math.round((good / totalStrokes) * 100);
  const playedStrokes = STROKE_TYPES.map((stroke) => ({
    stroke,
    ...byStroke[stroke],
    ratio: byStroke[stroke].total
      ? Math.round((byStroke[stroke].good / byStroke[stroke].total) * 100)
      : 0,
  })).filter((stroke) => stroke.total > 0);

  const mostPlayed =
    [...playedStrokes].sort((a, b) => b.total - a.total)[0] ??
    { stroke: "geen slag", total: 0, ratio: 0 };
  const weakestStroke =
    [...playedStrokes]
      .filter((stroke) => stroke.total >= 2)
      .sort((a, b) => a.ratio - b.ratio)[0] ?? null;
  const dominantIssue =
    Object.entries(weaknesses).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

  const tips = [];

  if (goodRatio >= 75) {
    tips.push(
      "Je basis is stabiel. Probeer dezelfde timing vast te houden wanneer het tempo in de rally omhoog gaat.",
    );
  } else if (goodRatio >= 55) {
    tips.push(
      "Je sessie is redelijk stabiel, maar je verliest nog kwaliteit onder druk. Werk op rust in voorbereiding en contactmoment.",
    );
  } else {
    tips.push(
      "Je verliest nog veel kwaliteit in de rally. Focus eerst op rust, vroeg klaar staan en gecontroleerd contact in plaats van op pure snelheid.",
    );
  }

  if (mostPlayed.total > 0) {
    tips.push(
      `${mostPlayed.stroke} kwam het vaakst terug in je spel. Gebruik die slag als hoofdthema in je volgende trainingsblok.`,
    );
  }

  if (weakestStroke) {
    tips.push(
      `${weakestStroke.stroke} is nu je minst stabiele slag (${weakestStroke.ratio}% goed). Herhaal daar extra rustige technische herhalingen op.`,
    );
  }

  if (dominantIssue[1] > 0 && ISSUE_LIBRARY[dominantIssue[0]]) {
    tips.push(ISSUE_LIBRARY[dominantIssue[0]].tip);
  }

  if (playedStrokes.length <= 2 && totalStrokes >= 6) {
    tips.push(
      "Je spelbeeld is nog vrij eenzijdig. Bouw meer variatie in met volleys of overheads zodra de rally dat toelaat.",
    );
  }

  return {
    headline:
      averageScore >= 82
        ? "Coach ziet een stabiele basis"
        : averageScore >= 68
          ? "Coach ziet een bruikbare trainingsbasis"
          : "Coach ziet duidelijke werkpunten",
    summary: `In deze sessie registreerde de app ${totalStrokes} slagen: ${good} goed en ${bad} niet goed. ${mostPlayed.stroke} kwam het vaakst voor en je gemiddelde techniek lag op ${averageScore}/100.`,
    tips: tips.slice(0, 3),
  };
}

function renderCoachReport() {
  const report = buildCoachReport();
  coachHeadline.textContent = report.headline;
  coachSummary.textContent = report.summary;
  coachList.innerHTML = "";

  report.tips.forEach((tip) => {
    const item = document.createElement("li");
    item.textContent = tip;
    coachList.appendChild(item);
  });
}

function renderSessionSummary() {
  const { active, startedAt, endedAt, totalStrokes, good, bad, totalScore } = state.session;
  const quality =
    totalStrokes > 0 ? `${Math.round((good / totalStrokes) * 100)}%` : "--";

  sessionStatusText.textContent = active
    ? "Sessie loopt"
    : endedAt
      ? "Sessie afgerond"
      : "Nog niet gestart";
  sessionTimerValue.textContent = startedAt ? formatDuration(getSessionDurationMs()) : "00:00";
  sessionTotalValue.textContent = String(totalStrokes);
  sessionGoodValue.textContent = String(good);
  sessionBadValue.textContent = String(bad);
  sessionQualityValue.textContent = quality;

  if (!startedAt) {
    sessionSummaryText.textContent =
      "Start een sessie om je slagen te tellen, te beoordelen en door de coach te laten samenvatten.";
    return;
  }

  if (totalStrokes === 0) {
    sessionSummaryText.textContent = active
      ? "De sessie is gestart. Zodra een slag duidelijk genoeg herkend wordt, telt de app hem mee."
      : "De sessie is gestopt zonder duidelijke geregistreerde slagen.";
    return;
  }

  const averageScore = Math.round(totalScore / totalStrokes);
  const topStroke =
    STROKE_TYPES.map((stroke) => ({
      stroke,
      total: state.session.byStroke[stroke].total,
    })).sort((a, b) => b.total - a.total)[0]?.stroke ?? "geen slag";

  sessionSummaryText.textContent = `${topStroke} was je meest gespeelde slag. Tot nu toe staan ${good} slagen als goed en ${bad} als niet goed, met een gemiddelde techniek van ${averageScore}/100.`;
}

function syncSessionButtons() {
  sessionStartButton.disabled = !state.running || state.session.active;
  sessionStopButton.disabled = !state.session.active;
}

function updateRecordingUi() {
  if (!state.recording.supported) {
    recordButton.disabled = true;
    recordButton.textContent = "Opname niet beschikbaar";
    downloadButton.disabled = true;
    recordingStatusText.textContent = "Niet ondersteund";
    return;
  }

  if (!state.running) {
    recordButton.disabled = true;
    recordButton.textContent = "Start opname";
    recordingStatusText.textContent = state.recording.url ? "Klaar" : "Uit";
    downloadButton.disabled = !state.recording.url;
    return;
  }

  recordButton.disabled = false;
  recordButton.textContent = state.recording.active ? "Stop opname" : "Start opname";
  if (state.recording.active) {
    recordingStatusText.textContent = "Opname loopt";
  } else if (state.recording.url) {
    recordingStatusText.textContent = "Klaar";
  } else {
    recordingStatusText.textContent = "Uit";
  }
  downloadButton.disabled = !state.recording.url;
}

function refreshSessionUi() {
  syncSessionButtons();
  renderSessionSummary();
  renderSessionStats();
  renderSessionSignals();
  renderTimeline();
  renderCoachReport();
  renderCoachFocus();
  renderSavedSession();
  updateRecordingUi();
  exportSessionButton.disabled =
    state.session.totalStrokes === 0 && !state.savedSession?.totalStrokes;
}

function registerSessionStroke(stroke, technique) {
  const bucket = state.session.byStroke[stroke.name];
  const goodStroke = technique.score >= QUALITY_THRESHOLD;
  const issues = technique.issues.slice(0, 2);

  state.session.totalStrokes += 1;
  state.session.totalScore += technique.score;
  state.session.good += goodStroke ? 1 : 0;
  state.session.bad += goodStroke ? 0 : 1;

  bucket.total += 1;
  bucket.good += goodStroke ? 1 : 0;
  bucket.bad += goodStroke ? 0 : 1;
  bucket.scoreSum += technique.score;

  issues.forEach((issue) => {
    if (state.session.weaknesses[issue.tag] !== undefined) {
      state.session.weaknesses[issue.tag] += 1;
    }
  });

  state.session.timeline.push({
    stroke: stroke.name,
    score: technique.score,
    good: goodStroke,
    time: Date.now(),
  });
  state.session.timeline = state.session.timeline.slice(-40);

  refreshSessionUi();
}

function maybeRegisterStroke(stroke, technique, now) {
  if (!state.session.active) {
    state.strokeCandidate = null;
    return;
  }

  const qualifies =
    stroke.name !== "Ready positie" &&
    stroke.confidence >= 0.58 &&
    stroke.speed >= 0.28 &&
    (state.readiness?.score ?? 0) >= 58;

  if (!qualifies) {
    if (state.strokeCandidate && now - state.strokeCandidate.lastSeenAt > 220) {
      state.strokeCandidate = null;
    }
    return;
  }

  if (!state.strokeCandidate || state.strokeCandidate.name !== stroke.name) {
    state.strokeCandidate = {
      name: stroke.name,
      frames: 1,
      lastSeenAt: now,
      stroke,
      technique,
    };
    return;
  }

  state.strokeCandidate.frames += 1;
  state.strokeCandidate.lastSeenAt = now;
  if (stroke.confidence > state.strokeCandidate.stroke.confidence) {
    state.strokeCandidate.stroke = stroke;
  }
  if (technique.score > state.strokeCandidate.technique.score) {
    state.strokeCandidate.technique = technique;
  }

  const cooldown =
    stroke.name === state.session.lastRegisteredStroke ? 1100 : 700;
  if (
    state.strokeCandidate.frames < 2 ||
    now - state.session.lastRegisteredAt < cooldown
  ) {
    return;
  }

  registerSessionStroke(state.strokeCandidate.stroke, state.strokeCandidate.technique);
  state.session.lastRegisteredAt = now;
  state.session.lastRegisteredStroke = stroke.name;
  state.strokeCandidate = null;
}

function getPreferredRecorderMimeType() {
  if (!state.recording.supported || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];

  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function startRecording() {
  if (!state.recording.supported || !state.stream || state.recording.active) {
    return;
  }

  try {
    if (state.recording.url) {
      URL.revokeObjectURL(state.recording.url);
      state.recording.url = "";
    }

    state.recording.chunks = [];
    const mimeType = getPreferredRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(state.stream, { mimeType })
      : new MediaRecorder(state.stream);

    state.recording.mimeType = recorder.mimeType || mimeType || "video/webm";
    state.recording.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        state.recording.chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      state.recording.active = false;
      if (state.recording.chunks.length > 0) {
        const blob = new Blob(state.recording.chunks, {
          type: state.recording.mimeType || "video/webm",
        });
        state.recording.url = URL.createObjectURL(blob);
      }
      updateRecordingUi();
    };

    recorder.start(1000);
    state.recording.active = true;
    setStatus("Camera analyse en opname actief");
    updateRecordingUi();
  } catch (error) {
    console.error(error);
    renderFeedback([
      "De opname kon niet starten op dit toestel of in deze browser.",
      "De live analyse blijft wel gewoon doorgaan.",
      "Probeer eventueel Chrome of Safari in de nieuwste versie.",
    ]);
    updateRecordingUi();
  }
}

function stopRecording() {
  if (!state.recording.active || !state.recording.recorder) {
    return;
  }

  recordingStatusText.textContent = "Opslaan...";
  if (state.recording.recorder.state !== "inactive") {
    state.recording.recorder.stop();
  }
  state.recording.active = false;
  recordButton.textContent = "Start opname";
}

function downloadRecording() {
  if (!state.recording.url) {
    return;
  }

  const extension = state.recording.mimeType.includes("mp4") ? "mp4" : "webm";
  const link = document.createElement("a");
  link.href = state.recording.url;
  link.download = `padel-sessie-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function startSession() {
  if (!state.running) {
    renderFeedback([
      "Start eerst de camera-analyse voordat je een sessie begint.",
      "Daarna kan de app per slag registreren wat goed en minder goed ging.",
      "De coach bouwt zijn analyse op vanuit die sessiegegevens.",
    ]);
    return;
  }

  state.session = createSessionState();
  state.session.active = true;
  state.session.startedAt = Date.now();
  state.strokeCandidate = null;
  setStatus("Trainingssessie gestart");
  refreshSessionUi();
}

function endSession(reason = "manual") {
  if (!state.session.active) {
    return;
  }

  state.session.active = false;
  state.session.endedAt = Date.now();
  state.strokeCandidate = null;

  if (state.recording.active) {
    stopRecording();
  }

  if (state.session.totalStrokes > 0) {
    persistSessionSnapshot();
  }

  setStatus(
    reason === "cameraStopped"
      ? "Camera gestopt, sessie opgeslagen"
      : "Trainingssessie afgerond",
  );
  refreshSessionUi();
}

function resizeCanvasToVideo() {
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

async function createPoseLandmarker() {
  if (state.poseLandmarker) {
    return state.poseLandmarker;
  }

  setStatus("Pose-model laden...");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );

  state.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    },
    numPoses: 1,
    runningMode: "VIDEO",
  });

  return state.poseLandmarker;
}

async function startCamera() {
  try {
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }

    await createPoseLandmarker();
    setStatus("Camera toestemming aanvragen...");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    state.stream?.getTracks().forEach((track) => track.stop());
    state.stream = stream;
    video.srcObject = stream;
    await video.play();

    resizeCanvasToVideo();
    emptyState.hidden = true;
    state.running = true;
    state.lastVideoTime = -1;
    state.lastFrameAt = performance.now();
    state.smoothedLandmarks = null;
    state.previousDominantWrist = null;
    state.history = [];
    state.strokeCandidate = null;

    stopButton.disabled = false;
    switchButton.disabled = false;
    setStatus("Live analyse actief");
    trackingText.textContent = "Spelertracking wacht op lichaamspunten";
    syncSessionButtons();
    updateRecordingUi();
    state.animationFrameId = requestAnimationFrame(analyseLoop);
  } catch (error) {
    console.error(error);
    setStatus("Kon camera of model niet starten");
    trackingText.textContent = "Controleer cameratoegang en internetverbinding";
    renderFeedback([
      "De camera of het pose-model kon niet worden gestart.",
      "Open de app via https of localhost en geef cameratoegang.",
      "De eerste keer moet ook het externe pose-model geladen kunnen worden.",
    ]);
  }
}

function stopCamera() {
  if (state.session.active) {
    endSession("cameraStopped");
  }
  if (state.recording.active) {
    stopRecording();
  }

  state.running = false;
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  video.srcObject = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  trackingLayer.style.transform = "translate(0px, 0px) scale(1)";
  emptyState.hidden = false;
  stopButton.disabled = true;
  switchButton.disabled = true;
  setStatus("Camera gestopt");
  state.tracking = { x: 0, y: 0, scale: 1 };
  state.history = [];
  state.previousDominantWrist = null;
  state.strokeCandidate = null;
  resetReadinessUi();
  resetLiveDashboard();
  refreshSessionUi();
}

async function switchCamera() {
  if (state.recording.active) {
    stopRecording();
  }

  state.facingMode = state.facingMode === "environment" ? "user" : "environment";
  if (state.running) {
    await startCamera();
  }
}

function updateFps(now) {
  const delta = now - state.lastFrameAt;
  state.lastFrameAt = now;
  const fps = delta > 0 ? Math.round(1000 / delta) : 0;
  fpsChip.textContent = `${fps} FPS`;
}

function analyseLoop(now) {
  if (!state.running || !state.poseLandmarker) {
    return;
  }

  updateFps(now);
  if (state.session.active) {
    renderSessionSummary();
  }

  if (video.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    resizeCanvasToVideo();

    const result = state.poseLandmarker.detectForVideo(video, now);
    const landmarks = result.landmarks?.[0];
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarks) {
      const smoothed = smoothLandmarks(landmarks);
      const metrics = computeMetrics(smoothed);
      const readiness = computeReadiness(smoothed);
      const stroke = classifyStroke(metrics, handednessSelect.value, now);
      const technique = evaluateTechnique(stroke.name, metrics, handednessSelect.value);

      drawSkeleton(smoothed, metrics.joints, stroke.name);
      updateTrackingTransform(smoothed);
      renderReadinessUi(readiness);
      updateLiveDashboard(stroke.name, stroke.confidence, technique);
      maybeRegisterStroke(stroke, technique, now);

      trackingText.textContent =
        stroke.name === "Ready positie"
          ? "Speler gevolgd, wacht op duidelijke slagbeweging"
          : "Speler gevolgd en slag herkend";
    } else {
      state.tracking = { x: 0, y: 0, scale: 1 };
      trackingLayer.style.transform = "translate(0px, 0px) scale(1)";
      trackingText.textContent = "Geen speler gedetecteerd";
      detectionHeadline.textContent = "Zoek speler";
      detectionDetail.textContent =
        "Zorg dat schouders, heupen en knieen in beeld blijven voor een stabiele analyse.";
      focusValue.textContent = trackingToggle.checked ? "Zoekt speler" : "Uit";
      resetReadinessUi();
      renderFeedback([
        "Geen speler gedetecteerd. Houd schouders, heupen en knieen volledig in beeld.",
        state.session.active
          ? "De sessie loopt door, maar zonder duidelijke pose worden er geen slagen geteld."
          : "Start een sessie zodra de speler stabiel in beeld staat.",
        "Gebruik bij voorkeur de achtercamera voor een scherper silhouet.",
      ]);
    }
  }

  state.animationFrameId = requestAnimationFrame(analyseLoop);
}

function handleRecordButton() {
  if (state.recording.active) {
    stopRecording();
    return;
  }

  startRecording();
}

function registerEvents() {
  startButton.addEventListener("click", startCamera);
  stopButton.addEventListener("click", stopCamera);
  switchButton.addEventListener("click", switchCamera);
  sessionStartButton.addEventListener("click", startSession);
  sessionStopButton.addEventListener("click", () => endSession("manual"));
  recordButton.addEventListener("click", handleRecordButton);
  downloadButton.addEventListener("click", downloadRecording);
  exportSessionButton.addEventListener("click", exportSessionReport);
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setInsightView(button.dataset.insightView);
    });
  });

  handednessSelect.addEventListener("change", () => {
    armValue.textContent = DOMINANT[handednessSelect.value].sideLabel;
  });

  trackingToggle.addEventListener("change", () => {
    focusValue.textContent = trackingToggle.checked ? "Automatisch" : "Uit";
  });

  window.addEventListener("resize", resizeCanvasToVideo);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

function boot() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Deze browser ondersteunt geen mobiele camera-toegang");
    renderFeedback([
      "Gebruik een moderne browser zoals Safari of Chrome op je telefoon.",
      "Open de app via https of localhost, anders blokkeert de browser de camera.",
      "Daarna kun je de speler live laten volgen en coachfeedback tijdens de rally tonen.",
    ]);
    return;
  }

  loadPersistedUiState();
  registerEvents();
  registerServiceWorker();
  setInsightView(state.ui.insightView);
  resetReadinessUi();
  resetLiveDashboard();
  refreshSessionUi();
}

boot();
