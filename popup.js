const IMPACT_FACTORS = {
  co2GramsPerMinute: 0.35,
  waterMlPerMinute: 8.5,
  energyWhPerMinute: 0.18
};

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
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

function renderSiteTotals(perHostMs) {
  const list = document.getElementById("siteList");
  list.innerHTML = "";

  const rows = Object.entries(perHostMs).sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No tracked usage yet.";
    list.appendChild(li);
    return;
  }

  for (const [host, ms] of rows) {
    const li = document.createElement("li");
    li.textContent = `${host}: ${formatDuration(ms)}`;
    list.appendChild(li);
  }
}

function render(state) {
  const session = state.currentSession;
  document.getElementById("sessionSite").textContent = session.active
    ? session.siteName
    : "Not active";
  document.getElementById("sessionDuration").textContent = session.active
    ? formatDuration(session.elapsedMs)
    : "0s";

  document.getElementById("totalDuration").textContent = formatDuration(state.cumulativeMs);

  const impact = calculateImpact(state.cumulativeMs);
  document.getElementById("co2Value").textContent = `${impact.co2Grams.toFixed(2)} g`;
  document.getElementById("waterValue").textContent = `${impact.waterMl.toFixed(1)} ml`;
  document.getElementById("energyValue").textContent = `${impact.energyWh.toFixed(2)} Wh`;

  renderSiteTotals(state.perHostMs);
}

function refresh() {
  chrome.runtime.sendMessage({ type: "getState" }, (response) => {
    if (!response?.ok) return;
    render(response.state);
  });
}

document.getElementById("resetButton").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "resetTotals" }, (response) => {
    if (!response?.ok) return;
    refresh();
  });
});

refresh();
setInterval(refresh, 1000);
