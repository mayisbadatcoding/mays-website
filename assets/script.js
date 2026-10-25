(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const menu = $("menuBtn"),
    nav = $("navMenu");
  if (menu && nav) {
    menu.addEventListener("click", () => {
      const show = nav.classList.toggle("show");
      menu.setAttribute("aria-expanded", String(show));
    });
  }
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === document.body.dataset.page) a.classList.add("active");
  });
  if ($("year")) $("year").textContent = new Date().getFullYear();
  const tabs = [...document.querySelectorAll("[data-tab]")];
  function setTab(id) {
    tabs.forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      const pane = $(b.dataset.tab);
      if (pane) pane.hidden = !on;
    });
  }
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const next =
          tabs[
            (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
          ];
        next.focus();
        setTab(next.dataset.tab);
      }
    });
  });
  if (!tabs.length) return;
})();
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (!document.querySelector('[data-page="home"]')) return;
  const id = "1092162323021566103",
    tz = "America/New_York";
  const fallback = "https://cdn.discordapp.com/embed/avatars/0.png";
  function avatar(user) {
    if (!user || !user.id) return fallback;
    if (user.avatar) {
      const ext = user.avatar.startsWith("a_") ? "gif" : "png";
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(user.id) >> 22n) % 6n)}.png`;
  }
  function updatePresence(d) {
    if (!d) return;
    const u = d.discord_user || {},
      a = $("myAvatar");
    if (a) {
      a.src = avatar(u);
      a.onerror = () => {
        a.onerror = null;
        a.src = fallback;
      };
    }
    const status = ["online", "idle", "dnd", "offline"].includes(
      d.discord_status,
    )
      ? d.discord_status
      : "unknown";
    $("avatarDot").className = "presence-dot " + status;
    const names = {
      online: "Online",
      idle: "Idle",
      dnd: "Do Not Disturb",
      offline: "Offline",
      unknown: "Status unavailable",
    };
    $("presenceText").textContent = "Discord · " + names[status];
    $("discordName").textContent =
      u.global_name && u.global_name !== "May" ? "· " + u.global_name : "";
    const acts = (d.activities || []).filter((x) => x && x.type !== 4);
    const custom = (d.activities || []).find(
      (x) => x && x.type === 4 && x.state,
    );
    $("activityText").textContent = acts.length
      ? "Currently: " +
        acts[0].name +
        (acts[0].details ? " · " + acts[0].details : "")
      : custom
        ? "Status: " + custom.state
        : "";
  }
  async function rest() {
    try {
      const r = await fetch("https://api.lanyard.rest/v1/users/" + id, {
        cache: "no-store",
      });
      if (!r.ok) throw Error("API error");
      const j = await r.json();
      if (j.success && j.data) updatePresence(j.data);
      else throw Error("Not monitored");
    } catch (e) {
      if (!$("presenceText").textContent.includes("Discord ·"))
        $("presenceText").textContent = "Discord · Presence unavailable";
    }
  }
  rest();
  let socket = null,
    heartbeat = null,
    retry = null,
    retries = 0;
  function connect() {
    try {
      socket = new WebSocket("wss://api.lanyard.rest/socket");
      socket.onmessage = (e) => {
        let m;
        try {
          m = JSON.parse(e.data);
        } catch {
          return;
        }
        if (m.op === 1) {
          socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }));
          clearInterval(heartbeat);
          heartbeat = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ op: 3 }));
          }, m.d.heartbeat_interval || 30000);
        }
        if (m.op === 0 && (m.t === "INIT_STATE" || m.t === "PRESENCE_UPDATE")) {
          retries = 0;
          updatePresence(m.d);
        }
      };
      socket.onclose = () => {
        clearInterval(heartbeat);
        clearTimeout(retry);
        retry = setTimeout(
          connect,
          Math.min(60000, 2000 * Math.pow(2, Math.min(retries++, 5))),
        );
      };
      socket.onerror = () => socket.close();
    } catch (e) {
      clearTimeout(retry);
      retry = setTimeout(connect, 15000);
    }
  }
  connect();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) rest();
  });
  const friends = document.querySelectorAll("[data-discord-avatar]");
  friends.forEach((img) => {
    const uid = img.dataset.discordAvatar;
    img.src = "https://unavatar.io/discord/" + encodeURIComponent(uid);
    img.onerror = () => {
      img.onerror = null;
      img.src =
        "https://cdn.discordapp.com/embed/avatars/" +
        Number(BigInt(uid) % 6n) +
        ".png";
    };
  });

  const clock = (date, zone, opts = {}) =>
    new Intl.DateTimeFormat("en-US", { timeZone: zone, ...opts }).format(date);
  function offset(date, zone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return (
      (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) -
        date.getTime()) /
      60000
    );
  }
  function updateClock() {
    const now = new Date(),
      p = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          hour: "numeric",
          minute: "numeric",
          hourCycle: "h23",
        })
          .formatToParts(now)
          .map((x) => [x.type, x.value]),
      );
    const minute = +p.hour * 60 + +p.minute,
      weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(p.weekday),
      band =
        ["Mon", "Wed"].includes(p.weekday) &&
        minute >= 15 * 60 + 30 &&
        minute < 16 * 60 + 30,
      school = weekday && minute >= 7 * 60 + 30 && minute < 16 * 60,
      sleep = minute < (weekday ? 6 * 60 + 30 : 11 * 60 + 30);
    let status, detail;
    if (sleep) {
      status = "Probably sleeping";
      detail = weekday ? "Weekday sleep schedule" : "Weekend sleep schedule";
    } else if (band) {
      status = "At band practice";
      detail = "Monday & Wednesday · 3:30–4:30 PM";
    } else if (school) {
      status = "At school";
      detail = "Weekdays · 7:30 AM–4:00 PM";
    } else {
      status = "Probably busy";
      detail = "Or gaming. Or developing. Who knows.";
    }
    $("scheduleStatus").textContent = status;
    $("scheduleDetail").textContent = detail;
    const fmt = { hour: "numeric", minute: "2-digit", hour12: true };
    $("mayTime").textContent = clock(now, tz, fmt);
    $("mayTimeCompare").textContent = clock(now, tz, fmt);
    $("mayDate").textContent = clock(now, tz, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZoneName: "short",
    });
    const chosen = $("visitorZone").value,
      visitor =
        chosen === "auto"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
          : chosen;
    $("visitorTime").textContent = clock(now, visitor, fmt);
    const diff =
      Math.round(((offset(now, tz) - offset(now, visitor)) / 60) * 10) / 10;
    $("differenceText").textContent =
      Math.abs(diff) < 0.01
        ? "Same time zone right now"
        : `May is ${Math.abs(diff)} hour${Math.abs(diff) === 1 ? "" : "s"} ${diff > 0 ? "ahead of" : "behind"} you`;
  }
  $("visitorZone").addEventListener("change", updateClock);
  updateClock();
  setInterval(updateClock, 30000);
})();
