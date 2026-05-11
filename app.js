import {
  FilesetResolver,
  PoseLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const video = document.querySelector("#cameraVideo");
const canvas = document.querySelector("#overlayCanvas");
const context = canvas.getContext("2d");
const trackingLayer = document.querySelector("#trackingLayer");

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
const anglesGrid = document.querySelector("#anglesGrid");

const startButton = document.querySelector("#startButton");
const stopButton = document.querySelector("#stopButton");
const switchButton = document.querySelector("#switchButton");
const handednessSelect = document.querySelector("#handednessSelect");
const trackingToggle = document.querySelector("#trackingToggle");
const labelsToggle = document.querySelector("#labelsToggle");

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

const JOINT_LABELS = [
  ["rightElbow", "Rechter elleboog"],
  ["leftElbow", "Linker elleboog"],
  ["rightShoulder", "Rechter schouder"],
  ["leftShoulder", "Linker schouder"],
  ["rightKnee", "Rechter knie"],
  ["leftKnee", "Linker knie"],
];

const DOMINANT = {
  right: {
    sideLabel: "Rechts",
    shoulder: 12,
    elbow: 14,
    wrist: 16,
    hip: 24,
    knee: 26,
    ankle: 28,
    oppositeShoulder: 11,
    oppositeHip: 23,
    oppositeKnee: 25,
  },
  left: {
    sideLabel: "Links",
    shoulder: 11,
    elbow: 13,
    wrist: 15,
    hip: 23,
    knee: 25,
    ankle: 27,
    oppositeShoulder: 12,
    oppositeHip: 24,
    oppositeKnee: 26,
  },
};

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
};

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
  const torsoHeight = distance(shoulderCenter, hipCenter) || 0.2;
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
    torsoHeight,
    stanceWidth,
  };
}

function getDominantMetrics(metrics, handedness) {
  const dominant = DOMINANT[handedness];
  const points = metrics.points;
  const wrist = handedness === "right" ? points.rightWrist : points.leftWrist;
  const elbow = handedness === "right" ? points.rightElbow : points.leftElbow;
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
  const kneeAngle =
    handedness === "right"
      ? (metrics.joints.rightKnee + metrics.joints.leftKnee) / 2
      : (metrics.joints.leftKnee + metrics.joints.rightKnee) / 2;

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
  const trunkLean =
    Math.abs(
      (Math.atan2(shoulderCenter.x - hipCenter.x, hipCenter.y - shoulderCenter.y) *
        180) /
        Math.PI
    ) || 0;

  const dominantReach =
    distance(wrist, shoulder) / Math.max(distance(hip, shoulder), 0.001);
  const shoulderLineTilt =
    Math.abs(
      (Math.atan2(
        oppositeShoulder.y - shoulder.y,
        oppositeShoulder.x - shoulder.x,
      ) *
        180) /
        Math.PI
    );

  return {
    dominant,
    wrist,
    elbow,
    shoulder,
    hip,
    elbowAngle,
    shoulderAngle,
    kneeAngle,
    wristSideOffset,
    crossedBody,
    contactHeight,
    trunkLean,
    dominantReach,
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

  const [stableName = stableStroke, stableScore = best.score] = Object.entries(voteCounts)
    .sort((a, b) => b[1] - a[1])[0] ?? [stableStroke, best.score];

  return {
    name: stableName,
    confidence: clamp(stableScore / Math.max(state.history.length, 1), 0, 1),
    speed,
    dominant,
  };
}

function evaluateTechnique(stroke, metrics, handedness) {
  const dominant = getDominantMetrics(metrics, handedness);
  const templates = {
    Forehand: [
      {
        label: "Ellebooghoek",
        value: dominant.elbowAngle,
        min: 95,
        max: 150,
        message: "Houd je slagarm iets compacter voor meer controle in de forehand.",
      },
      {
        label: "Schouderhoek",
        value: dominant.shoulderAngle,
        min: 40,
        max: 115,
        message: "Breng je arm iets vrijer naast je romp in de voorbereiding.",
      },
      {
        label: "Kniebuiging",
        value: dominant.kneeAngle,
        min: 135,
        max: 168,
        message: "Zak iets dieper door je knieën om stabieler te staan.",
      },
      {
        label: "Contacthoogte",
        value: dominant.contactHeight,
        min: 0.25,
        max: 1.15,
        tolerance: 0.4,
        message: "Raak de bal liever tussen heup en schouder voor een schonere forehand.",
      },
    ],
    Backhand: [
      {
        label: "Ellebooghoek",
        value: dominant.elbowAngle,
        min: 90,
        max: 145,
        message: "Houd je backhand-arm iets rustiger en compacter.",
      },
      {
        label: "Schouderhoek",
        value: dominant.shoulderAngle,
        min: 35,
        max: 110,
        message: "Open je schouderlijn net iets meer richting de bal.",
      },
      {
        label: "Kniebuiging",
        value: dominant.kneeAngle,
        min: 135,
        max: 168,
        message: "Blijf laag op je benen tijdens de backhand.",
      },
      {
        label: "Middellijn",
        value: dominant.crossedBody ? 1 : 0,
        min: 1,
        max: 1,
        tolerance: 1,
        message: "Breng het racket eerder door de middellijn voor je contactmoment.",
      },
    ],
    Volley: [
      {
        label: "Ellebooghoek",
        value: dominant.elbowAngle,
        min: 85,
        max: 125,
        message: "Houd je volley compact; laat je elleboog minder open vallen.",
      },
      {
        label: "Schouderhoek",
        value: dominant.shoulderAngle,
        min: 35,
        max: 92,
        message: "Houd je racket iets meer voor je lichaam bij de volley.",
      },
      {
        label: "Kniebuiging",
        value: dominant.kneeAngle,
        min: 130,
        max: 165,
        message: "Werk lager vanuit je benen voor meer stabiliteit aan het net.",
      },
      {
        label: "Contacthoogte",
        value: dominant.contactHeight,
        min: 0.45,
        max: 1.05,
        tolerance: 0.35,
        message: "Zoek je volley-contact meer rond borsthoogte.",
      },
    ],
    "Overhead / smash": [
      {
        label: "Ellebooghoek",
        value: dominant.elbowAngle,
        min: 138,
        max: 180,
        message: "Strek je slagarm verder uit boven je hoofd voor meer lengte.",
      },
      {
        label: "Schouderhoek",
        value: dominant.shoulderAngle,
        min: 98,
        max: 175,
        message: "Breng je arm hoger in je trophy-positie voor de overhead.",
      },
      {
        label: "Kniebuiging",
        value: dominant.kneeAngle,
        min: 130,
        max: 165,
        message: "Laad de overhead met iets meer beenwerk.",
      },
      {
        label: "Contacthoogte",
        value: dominant.contactHeight,
        min: 1.05,
        max: 2,
        tolerance: 0.5,
        message: "Raak de bal hoger boven je hoofd voor een betere smash.",
      },
    ],
    "Ready positie": [
      {
        label: "Houding",
        value: dominant.kneeAngle,
        min: 135,
        max: 170,
        message: "Blijf licht door je knieën in je ready positie.",
      },
      {
        label: "Armpositie",
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
  const feedback = scoredChecks
    .filter((check) => check.score < 0.7)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((check) => check.message);

  return {
    score: Math.round(averageScore * 100),
    feedback:
      feedback.length > 0
        ? feedback
        : [
            "Mooie balans in deze houding. Blijf de slag in hetzelfde ritme herhalen.",
          ],
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

function renderAngles(joints) {
  anglesGrid.innerHTML = "";
  JOINT_LABELS.forEach(([key, label]) => {
    const row = document.createElement("div");
    row.className = "angle-row";
    row.innerHTML = `<span>${label}</span><strong>${joints[key]}°</strong>`;
    anglesGrid.appendChild(row);
  });
}

function jointColor(stroke, key, value) {
  const dominantKey =
    handednessSelect.value === "right"
      ? {
          elbow: "rightElbow",
          shoulder: "rightShoulder",
          knee: "rightKnee",
        }
      : {
          elbow: "leftElbow",
          shoulder: "leftShoulder",
          knee: "leftKnee",
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
  };

  const range = ranges[stroke]?.[key];
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
    const isDominantSegment =
      [DOMINANT[handednessSelect.value].shoulder, DOMINANT[handednessSelect.value].elbow, DOMINANT[handednessSelect.value].wrist].includes(start) ||
      [DOMINANT[handednessSelect.value].shoulder, DOMINANT[handednessSelect.value].elbow, DOMINANT[handednessSelect.value].wrist].includes(end);

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
      drawLabel(point, `${joints[key]}°`, color);
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

function updateDashboard(stroke, confidence, joints, technique) {
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
      ? "De gemeten hoeken liggen dicht bij de doelzone voor deze slag."
      : "Gebruik de coachingregels hieronder om de volgende herhalingen scherper te maken.";

  updateScoreRing(score);
  renderFeedback(technique.feedback);
  renderAngles(joints);
}

function resetDashboard() {
  detectionHeadline.textContent = "Geen actieve slag";
  detectionDetail.textContent =
    "Zodra de dominante arm versnelt, schat de app of het om een forehand, backhand, volley of overhead gaat.";
  confidenceValue.textContent = "0%";
  armValue.textContent = DOMINANT[handednessSelect.value].sideLabel;
  focusValue.textContent = trackingToggle.checked ? "Automatisch" : "Uit";
  scoreValue.textContent = "--";
  techniqueBadge.textContent = "Nog geen meting";
  scoreSummary.textContent =
    "Start de camera om hoeken, slagtype en techniek te meten.";
  trackingText.textContent = "Nog geen speler in beeld";
  strokeText.textContent = "Wachten";
  fpsChip.textContent = "0 FPS";
  updateScoreRing(0);
  renderFeedback([
    "Houd de hele speler in beeld voor een complete meting.",
    "Gebruik bij voorkeur de achtercamera voor meer detail.",
    "De analyse is bedoeld als trainingshulp, niet als medische beoordeling.",
  ]);
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

    stopButton.disabled = false;
    switchButton.disabled = false;
    setStatus("Live analyse actief");
    trackingText.textContent = "Spelertracking wacht op lichaamspunten";
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
  resetDashboard();
}

async function switchCamera() {
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

  if (video.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    resizeCanvasToVideo();

    const result = state.poseLandmarker.detectForVideo(video, now);
    const landmarks = result.landmarks?.[0];
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarks) {
      const smoothed = smoothLandmarks(landmarks);
      const metrics = computeMetrics(smoothed);
      const stroke = classifyStroke(metrics, handednessSelect.value, now);
      const technique = evaluateTechnique(stroke.name, metrics, handednessSelect.value);

      drawSkeleton(smoothed, metrics.joints, stroke.name);
      updateTrackingTransform(smoothed);
      updateDashboard(stroke.name, stroke.confidence, metrics.joints, technique);

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
        "Zorg dat schouders, heupen en knieën in beeld blijven voor een stabiele analyse.";
      focusValue.textContent = trackingToggle.checked ? "Zoekt speler" : "Uit";
    }
  }

  state.animationFrameId = requestAnimationFrame(analyseLoop);
}

function registerEvents() {
  startButton.addEventListener("click", startCamera);
  stopButton.addEventListener("click", stopCamera);
  switchButton.addEventListener("click", switchCamera);

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
      "Daarna kun je de speler live laten volgen en de gewrichtshoeken tonen.",
    ]);
    return;
  }

  registerEvents();
  registerServiceWorker();
  resetDashboard();
}

boot();
