// ============================================================
//  Home Assistant standalone dashboard
//  Edit CONFIG to connect this dashboard to your Home Assistant.
//  Until configured, it renders demo data so the preview works.
// ============================================================

const CONFIG = {
  // Home Assistant instance, e.g. "http://192.168.1.10:8123"
  haUrl: "",
  // A long-lived access token from Profile > Long-Lived Access Tokens
  token: "",
  // Entities to subscribe to. Map a friendly key -> HA entity id.
  entities: {
    insideTemp: "sensor.inside_temperature",
    humidity: "sensor.humidity",
    energyToday: "sensor.energy_today",
    switches: ["switch.lamp", "switch.fan", "switch.outlet"],
    thermostat: "climate.thermostat",
  },
};

// ---- Demo fallback data (used until HA connects) ----
const DEMO = {
  insideTemp: 21.4,
  humidity: 48,
  energyToday: 6.2,
  switches: {
    "switch.lamp": { name: "Lamp", state: "on" },
    "switch.fan": { name: "Fan", state: "off" },
    "switch.outlet": { name: "Outlet", state: "on" },
  },
  thermostat: 21.0,
};

const state = {
  connected: false,
  entities: {},
  switchStates: {},
  thermostat: DEMO.thermostat,
  ws: null,
  reconnectTimer: null,
  msgId: 1,
};

// ---- Clock ----
function tickClock() {
  const el = document.getElementById("clock");
  const now = new Date();
  el.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
setInterval(tickClock, 1000);
tickClock();

// ---- Rendering ----
function renderStats() {
  const temp = state.entities.insideTemp || DEMO.insideTemp;
  const hum = state.entities.humidity || DEMO.humidity;
  const energy = state.entities.energyToday || DEMO.energyToday;
  document.getElementById("temp").textContent = `${temp}°`;
  document.getElementById("humidity").textContent = `${hum}%`;
  document.getElementById("energy").textContent = `${energy} kWh`;
}

function renderSwitches() {
  const wrap = document.getElementById("switches");
  wrap.innerHTML = "";
  for (const id of CONFIG.entities.switches) {
    const demo = DEMO.switches[id] || { name: id, state: "off" };
    const on = state.switchStates[id] ?? (demo.state === "on");
    const name = demo.name || id;
    const row = document.createElement("div");
    row.className = "switch-row";
    row.innerHTML = `<span class="switch-name">${name}</span>`;
    const btn = document.createElement("button");
    btn.className = `toggle ${on ? "on" : ""}`;
    btn.setAttribute("aria-label", name);
    btn.addEventListener("click", () => toggleSwitch(id, !on));
    row.appendChild(btn);
    wrap.appendChild(row);
  }
}

function renderThermostat() {
  document.getElementById("thermoTemp").textContent = `${state.thermostat.toFixed(1)}°`;
}

function renderAll() {
  renderStats();
  renderSwitches();
  renderThermostat();
}

// ---- Local switch toggle (calls HA service when connected) ----
function toggleSwitch(id, on) {
  state.switchStates[id] = on;
  renderSwitches();
  if (state.connected) {
    const domain = id.split(".")[0];
    sendCommand(`homeassistant.turn_${on ? "on" : "off"}`, { entity_id: id }, domain);
  }
}

document.getElementById("thermoUp").addEventListener("click", () => setThermo(0.5));
document.getElementById("thermoDown").addEventListener("click", () => setThermo(-0.5));

function setThermo(delta) {
  state.thermostat = Math.min(30, Math.max(10, state.thermostat + delta));
  renderThermostat();
  if (state.connected) {
    sendCommand("climate.set_temperature", {
      entity_id: CONFIG.entities.thermostat,
      temperature: state.thermostat,
    });
  }
}

// ============================================================
//  Home Assistant WebSocket client
//  (auth + state_changed subscription + command calls)
// ============================================================
function setConn(label, cls) {
  const el = document.getElementById("conn");
  el.textContent = label;
  el.className = "conn " + (cls || "");
}

function sendCommand(service, data, domainOverride) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  state.ws.send(JSON.stringify({
    id: state.msgId++,
    type: "call_service",
    domain: domainOverride || service.split(".")[0],
    service: service.split(".")[1] || service,
    service_data: data,
  }));
}

function connect() {
  if (!CONFIG.haUrl || !CONFIG.token) {
    setConn("demo mode — add HA config in app.js", "offline");
    state.connected = false;
    return;
  }
  const url = CONFIG.haUrl.replace(/\/$/, "");
  const wsUrl = url.replace(/^http/, "ws") + "/api/websocket";
  setConn("connecting…");
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    state.ws.send(JSON.stringify({ type: "auth", access_token: CONFIG.token }));
  };

  state.ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "auth_ok") {
      setConn("online", "online");
      state.connected = true;
      state.ws.send(JSON.stringify({ id: state.msgId++, type: "subscribe_events", event_type: "state_changed" }));
      refreshEntities();
    } else if (msg.type === "auth_invalid") {
      setConn("auth failed", "offline");
      state.connected = false;
    } else if (msg.type === "event" && msg.event?.event_type === "state_changed") {
      const { entity_id, new_state } = msg.event.data;
      applyEntity(entity_id, new_state);
    }
  };

  state.ws.onclose = () => {
    setConn("offline — reconnecting…", "offline");
    state.connected = false;
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(connect, 4000);
  };

  state.ws.onerror = () => state.ws.close();
}

function refreshEntities() {
  state.ws.send(JSON.stringify({ id: state.msgId++, type: "get_states" }));
}

function applyEntity(entityId, newState) {
  if (!newState) return;
  const st = newState.state;
  if (entityId === CONFIG.entities.insideTemp) {
    state.entities.insideTemp = parseFloat(st);
  } else if (entityId === CONFIG.entities.humidity) {
    state.entities.humidity = parseFloat(st);
  } else if (entityId === CONFIG.entities.energyToday) {
    state.entities.energyToday = parseFloat(st);
  } else if (CONFIG.entities.switches.includes(entityId)) {
    state.switchStates[entityId] = st === "on";
  } else if (entityId === CONFIG.entities.thermostat) {
    const t = parseFloat(newState.attributes?.current_temperature ?? st);
    if (!Number.isNaN(t)) state.thermostat = t;
  }
  renderAll();
}

renderAll();
connect();
