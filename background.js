const TARGET_HOSTS = {
  "chat.openai.com": "ChatGPT",
  "chatgpt.com": "ChatGPT",
  "claude.ai": "Anthropic Claude",
  "grok.com": "Grok",
  "x.com": "Grok (X)",
  "poe.com": "Poe",
  "gemini.google.com": "Google Gemini",
  "copilot.microsoft.com": "Microsoft Copilot",
  "www.perplexity.ai": "Perplexity",
  "perplexity.ai": "Perplexity"
};

const STORAGE_KEYS = {
  cumulativeMs: "cumulativeMs",
  perHostMs: "perHostMs",
  currentSession: "currentSession",
  lastTickAt: "lastTickAt",
  reminderStepMs: "reminderStepMs",
  lastReminderAtMs: "lastReminderAtMs"
};

const DEFAULTS = {
  cumulativeMs: 0,
  perHostMs: {},
  currentSession: {
    active: false,
    host: null,
    siteName: null,
    startedAt: null,
    elapsedMs: 0
  },
  lastTickAt: null,
  reminderStepMs: 30 * 60 * 1000,
  lastReminderAtMs: 0
};

const IMPACT_FACTORS = {
  co2GramsPerMinute: 0.35,
  waterMlPerMinute: 8.5,
  energyWhPerMinute: 0.18
};

async function getState() {
  const data = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  return {
    cumulativeMs: data[STORAGE_KEYS.cumulativeMs] ?? DEFAULTS.cumulativeMs,
    perHostMs: data[STORAGE_KEYS.perHostMs] ?? DEFAULTS.perHostMs,
    currentSession: data[STORAGE_KEYS.currentSession] ?? DEFAULTS.currentSession,
    lastTickAt: data[STORAGE_KEYS.lastTickAt] ?? DEFAULTS.lastTickAt,
    reminderStepMs: data[STORAGE_KEYS.reminderStepMs] ?? DEFAULTS.reminderStepMs,
    lastReminderAtMs: data[STORAGE_KEYS.lastReminderAtMs] ?? DEFAULTS.lastReminderAtMs
  };
}

async function saveState(partial) {
  await chrome.storage.local.set(partial);
}

function parseTrackedSite(urlString) {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    const siteName = TARGET_HOSTS[url.hostname];

    if (!siteName) return null;

    if (url.hostname === "x.com" && !url.pathname.startsWith("/i/grok")) {
      return null;
    }

    return { host: url.hostname, siteName };
  } catch {
    return null;
  }
}

async function getActiveTrackedSite() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab || !tab.url) {
    return null;
  }

  const win = await chrome.windows.get(tab.windowId);
  if (!win.focused) return null;

  return parseTrackedSite(tab.url);
}

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function calculateImpact(ms) {
  const minutes = ms / 60000;
  return {
    co2Grams: minutes * IMPACT_FACTORS.co2GramsPerMinute,
    waterMl: minutes * IMPACT_FACTORS.waterMlPerMinute,
    energyWh: minutes * IMPACT_FACTORS.energyWhPerMinute
  };
}

async function updateBadge(session) {
  if (!session.active) {
    await chrome.action.setBadgeText({ text: "" });
    return;
  }

  const mins = Math.floor(session.elapsedMs / 60000);
  await chrome.action.setBadgeBackgroundColor({ color: "#1a73e8" });
  await chrome.action.setBadgeText({ text: `${mins}m` });
}

async function maybeNotify(state) {
  const milestoneMs =
    Math.floor(state.cumulativeMs / state.reminderStepMs) * state.reminderStepMs;

  if (milestoneMs === 0 || milestoneMs <= state.lastReminderAtMs) {
    return;
  }

  const impact = calculateImpact(state.cumulativeMs);

  await chrome.notifications.create({
    type: "basic",
    iconUrl: "icon128.png",
    title: "AI Footprint Reminder",
    message: `You've used AI sites for ${formatDuration(
      state.cumulativeMs
    )}. Estimated impact: ${impact.co2Grams.toFixed(1)} g CO₂, ${impact.waterMl.toFixed(
      1
    )} ml water, ${impact.energyWh.toFixed(2)} Wh.`
  });

  await saveState({ [STORAGE_KEYS.lastReminderAtMs]: milestoneMs });
}

async function tick() {
  const now = Date.now();
  const state = await getState();

  const trackedSite = await getActiveTrackedSite();
  let session = { ...state.currentSession };

  const shouldBeActive = Boolean(trackedSite);
  const siteChanged =
    shouldBeActive && (!session.active || session.host !== trackedSite.host);

  if (!shouldBeActive) {
    session = {
      ...session,
      active: false,
      host: null,
      siteName: null,
      startedAt: null,
      elapsedMs: 0
    };

    await saveState({
      [STORAGE_KEYS.currentSession]: session,
      [STORAGE_KEYS.lastTickAt]: now
    });
    await updateBadge(session);
    return;
  }

  if (!session.active || siteChanged) {
    session = {
      active: true,
      host: trackedSite.host,
      siteName: trackedSite.siteName,
      startedAt: now,
      elapsedMs: 0
    };

    await saveState({
      [STORAGE_KEYS.currentSession]: session,
      [STORAGE_KEYS.lastTickAt]: now
    });
    await updateBadge(session);
    return;
  }

  const delta = state.lastTickAt ? Math.max(0, now - state.lastTickAt) : 0;
  session.elapsedMs += delta;

  const cumulativeMs = state.cumulativeMs + delta;
  const perHostMs = { ...state.perHostMs };
  perHostMs[session.host] = (perHostMs[session.host] ?? 0) + delta;

  const newState = {
    [STORAGE_KEYS.currentSession]: session,
    [STORAGE_KEYS.cumulativeMs]: cumulativeMs,
    [STORAGE_KEYS.perHostMs]: perHostMs,
    [STORAGE_KEYS.lastTickAt]: now
  };

  await saveState(newState);
  await updateBadge(session);
  await maybeNotify({ ...state, cumulativeMs });
}

async function initialize() {
  await saveState({
    [STORAGE_KEYS.cumulativeMs]: DEFAULTS.cumulativeMs,
    [STORAGE_KEYS.perHostMs]: DEFAULTS.perHostMs,
    [STORAGE_KEYS.currentSession]: DEFAULTS.currentSession,
    [STORAGE_KEYS.reminderStepMs]: DEFAULTS.reminderStepMs,
    [STORAGE_KEYS.lastReminderAtMs]: DEFAULTS.lastReminderAtMs,
    [STORAGE_KEYS.lastTickAt]: Date.now()
  });

  await chrome.alarms.create("timerTick", { periodInMinutes: 0.5 });
}

chrome.runtime.onInstalled.addListener(() => {
  initialize().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("timerTick", { periodInMinutes: 0.5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "timerTick") return;
  tick().catch(console.error);
});

chrome.tabs.onActivated.addListener(() => {
  tick().catch(console.error);
});

chrome.tabs.onUpdated.addListener(() => {
  tick().catch(console.error);
});

chrome.windows.onFocusChanged.addListener(() => {
  tick().catch(console.error);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "getState") {
    getState().then((state) => sendResponse({ ok: true, state }));
    return true;
  }

  if (message?.type === "resetTotals") {
    initialize()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});
