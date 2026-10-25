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
    updateActivityCard(d);
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
  const friends = [...document.querySelectorAll("[data-discord-avatar]")];
  async function refreshFriendAvatars() {
    await Promise.all(
      friends.map(async (img) => {
        const uid = img.dataset.discordAvatar;
        if (!/^\d{17,20}$/.test(uid)) return;
        img.dataset.loading = "true";
        try {
          const response = await fetch(
            "https://discord-lookup.lookupbotdc.workers.dev/search/" + uid,
            { signal: AbortSignal.timeout(10000), cache: "no-store" },
          );
          if (!response.ok) throw Error("Lookup unavailable");
          const profile = await response.json();
          const user = profile?.user || profile;
          const hash = user?.avatar;
          let url = "";
          if (typeof hash === "string" && /^(a_)?[a-f0-9]{32}$/.test(hash)) {
            // Discord's a_ prefix means an animated avatar; PNG would freeze it.
            url = `https://cdn.discordapp.com/avatars/${uid}/${hash}.png?size=256`;
            img.dataset.animatedAvatar = hash.startsWith("a_")
              ? `https://cdn.discordapp.com/avatars/${uid}/${hash}.gif?size=256`
              : "";
          } else if (
            typeof profile?.avatar_url === "string" &&
            profile.avatar_url.startsWith("https://cdn.discordapp.com/")
          ) {
            url = profile.avatar_url;
          }
          if (!url) throw Error("No avatar available");
          const test = new Image();
          test.referrerPolicy = "no-referrer";
          test.src = url;
          await test.decode();
          img.src = url;
          img.closest(".friend-card")?.classList.add("has-avatar");
          const banner = img
            .closest(".friend-card")
            ?.querySelector(".friend-banner");
          const bannerHash = user?.banner;
          if (
            banner &&
            typeof bannerHash === "string" &&
            /^(a_)?[a-f0-9]{32}$/.test(bannerHash)
          ) {
            const bannerUrl = `https://cdn.discordapp.com/banners/${uid}/${bannerHash}.png?size=1024`;
            banner.style.backgroundImage = `linear-gradient(0deg,rgba(10,12,20,.2),transparent),url("${bannerUrl}")`;
            banner.dataset.bannerUrl = bannerUrl;
          }
        } catch (error) {
          /* Keep last known image or default icon when lookup fails. */
        } finally {
          delete img.dataset.loading;
        }
      }),
    );
  }
  refreshFriendAvatars();
  setInterval(
    () => {
      if (!document.hidden) refreshFriendAvatars();
    },
    15 * 60 * 1000,
  );

  // The status endpoint is public and never requires an owner session.
  async function refreshSystemStatus() {
    const card = document.querySelector(".live-status"),
      title = $("systemState"),
      detail = $("systemDetail");
    if (!card || !title) return;
    try {
      const response = await fetch("https://status.ope674c.dev/api/status", {
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) throw Error("Status API unavailable");
      const data = await response.json();
      const state = data?.overall?.status;
      if (!["operational", "partial", "outage"].includes(state))
        throw Error("Unknown state");
      card.dataset.state = state;
      title.textContent =
        data.overall.title ||
        {
          operational: "All systems operational",
          partial: "Service disruption",
          outage: "Service outage",
        }[state];
      const count = Array.isArray(data.services) ? data.services.length : null;
      detail.textContent =
        (count !== null ? count + " monitored services · " : "") +
        "View live status ↗";
    } catch (e) {
      card.dataset.state = "unknown";
      title.textContent = "Status unavailable";
      detail.textContent = "View monitoring dashboard ↗";
    } finally {
      title.classList.remove("is-loading");
    }
  }
  refreshSystemStatus();
  setInterval(() => {
    if (!document.hidden) refreshSystemStatus();
  }, 60000);
  function updateActivityCard(d) {
    const title = $("liveActivityTitle"),
      detail = $("liveActivityDetail"),
      art = $("liveActivityArt");
    if (!title) return;
    title.classList.remove("is-loading");
    const spotify = d?.spotify;
    const activities = (d?.activities || []).filter((x) => x && x.type !== 4);
    const activity =
      activities.find((x) => x.type === 0) ||
      activities.find((x) => x.type === 2) ||
      activities[0];
    let image = "";
    if (spotify) {
      title.textContent = spotify.song || "Listening to Spotify";
      detail.textContent =
        [spotify.artist, spotify.album].filter(Boolean).join(" · ") ||
        "Spotify";
      image = spotify.album_art_url || "";
    } else if (activity) {
      title.textContent = activity.name || "Active on Discord";
      detail.textContent =
        [activity.details, activity.state].filter(Boolean).join(" · ") ||
        "Currently active";
      const asset = activity.assets?.large_image;
      if (asset) {
        if (asset.startsWith("mp:"))
          image = "https://media.discordapp.net/" + asset.slice(3);
        else if (/^https:\/\//.test(asset)) image = asset;
        else if (activity.application_id && /^[\w-]+$/.test(asset))
          image =
            "https://cdn.discordapp.com/app-assets/" +
            activity.application_id +
            "/" +
            asset +
            ".png";
      }
    } else {
      title.textContent = "Nothing playing right now";
      detail.textContent = "Activity appears when available";
    }
    if (art) {
      art.hidden = !image;
      if (image) {
        art.src = image;
        art.onerror = () => {
          art.hidden = true;
        };
      }
    }
  }
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
(() => {
  "use strict";
  const cards = [...document.querySelectorAll(".friend-card[data-friend-id]")];
  const modal = document.getElementById("friendDialog"),
    imageModal = document.getElementById("friendImageDialog");
  if (!cards.length) return;
  const staticSrc = new WeakMap();
  function play(img) {
    if (!img?.dataset.animatedAvatar) return;
    staticSrc.set(img, img.src);
    img.src = img.dataset.animatedAvatar;
  }
  function stop(img) {
    if (staticSrc.has(img)) {
      img.src = staticSrc.get(img);
      staticSrc.delete(img);
    }
  }
  cards.forEach((card) => {
    const img = card.querySelector(".friend-avatar");
    card.addEventListener("pointerenter", () => play(img));
    card.addEventListener("pointerleave", () => stop(img));
    card.addEventListener("focusin", () => play(img));
    card.addEventListener("focusout", (e) => {
      if (!card.contains(e.relatedTarget)) stop(img);
    });
  });
  const open = (el) => {
    if (el && !el.open && typeof el.showModal === "function") el.showModal();
  };
  const close = (el) => {
    if (el?.open) el.close();
  };
  document.querySelectorAll("[data-open-friend]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const card = btn.closest(".friend-card");
      if (!card || !modal) return;
      const img = card.querySelector(".friend-avatar"),
        banner = card.querySelector(".friend-banner");
      document.getElementById("friendDialogTitle").textContent =
        card.querySelector("h3")?.textContent || "";
      document.getElementById("friendDialogDescription").textContent =
        card.querySelector(".friend-description")?.textContent || "";
      const av = document.getElementById("friendDialogAvatar");
      av.src = img?.src || "";
      av.dataset.animatedAvatar = img?.dataset.animatedAvatar || "";
      const b = document.getElementById("friendDialogBanner");
      b.style.backgroundImage = banner?.style.backgroundImage || "";
      b.style.setProperty(
        "--friend-hue",
        card.style.getPropertyValue("--friend-hue"),
      );
      const links = document.getElementById("friendDialogLinks");
      links.replaceChildren();
      card
        .querySelectorAll(".friend-link")
        .forEach((a) => links.append(a.cloneNode(true)));
      open(modal);
    }),
  );
  document
    .querySelectorAll("[data-close-friend]")
    .forEach((b) => b.addEventListener("click", () => close(modal)));
  document.querySelectorAll("[data-open-screenshot]").forEach((b) =>
    b.addEventListener("click", () => {
      const img = document.getElementById("friendImageFull");
      img.src = b.dataset.openScreenshot;
      open(imageModal);
    }),
  );
  document
    .querySelectorAll("[data-close-image]")
    .forEach((b) => b.addEventListener("click", () => close(imageModal)));
  [modal, imageModal].forEach((d) =>
    d?.addEventListener("click", (e) => {
      if (e.target === d) close(d);
    }),
  );
  modal?.addEventListener("pointerenter", () =>
    play(document.getElementById("friendDialogAvatar")),
  );
  modal?.addEventListener("pointerleave", () =>
    stop(document.getElementById("friendDialogAvatar")),
  );
  modal?.addEventListener("close", () =>
    stop(document.getElementById("friendDialogAvatar")),
  );
})();
