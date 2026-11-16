/**
 * ============================================================================
 * NASA EVA BIOTELEMETRY HUD - STATS & BIOMARKERS CONTROLLER
 * Dynamic telemetry integration reading from daily reports & alarms list
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // 1. PROCEDURAL STARFIELD CANVAS
  // =========================================================================
  const canvas = document.getElementById('starfield');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let stars = [];
    const STAR_COUNT = 150;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    }

    function initStars() {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.6 + 0.3,
          alpha: Math.random() * 0.85 + 0.15,
          twinkleSpeed: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1)
        });
      }
    }

    function renderStarfield() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach(star => {
        star.alpha += star.twinkleSpeed;
        if (star.alpha > 0.95 || star.alpha < 0.15) {
          star.twinkleSpeed = -star.twinkleSpeed;
        }

        ctx.fillStyle = `rgba(225, 245, 255, ${Math.abs(star.alpha)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        if (star.size > 1.3) {
          ctx.fillStyle = `rgba(0, 229, 255, ${Math.abs(star.alpha) * 0.35})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      requestAnimationFrame(renderStarfield);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    renderStarfield();
  }


  // =========================================================================
  // 2. WEB AUDIO SYNTHESIZER
  // =========================================================================
  let audioCtx = null;

  function playBeep(freq = 980, duration = 0.05, type = 'sine') {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  }


  // =========================================================================
  // 3. TOAST NOTIFICATIONS
  // =========================================================================
  const toast = document.getElementById('vitals-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastVal = document.getElementById('toast-val');
  let toastTimer = null;

  function showToast(title, val) {
    if (!toast) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastVal) toastVal.textContent = val;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }


  // =========================================================================
  // 4. API CLIENT & RESILIENT NETWORK HELPERS
  // =========================================================================
  let apiBaseUrl = (typeof window !== 'undefined' && window.VITE_API_BASE) || '';

  async function request(path, options) {
    try {
      const res = await fetch(apiBaseUrl + path, options);
      if (res.ok) return res.json();
      if (res.status === 404 && !apiBaseUrl) {
        throw new Error('404 on local origin, attempting Flask fallback');
      }
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch {}
      throw new Error(msg);
    } catch (err) {
      if (!apiBaseUrl) {
        const fallbacks = ['http://127.0.0.1:5001', 'http://127.0.0.1:5000'];
        for (const target of fallbacks) {
          try {
            const fallbackRes = await fetch(target + path, options);
            if (fallbackRes.ok) {
              apiBaseUrl = target;
              return fallbackRes.json();
            }
          } catch {}
        }
      }
      throw err;
    }
  }

  function qs(obj) {
    const p = new URLSearchParams();
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.set(k, v);
    });
    const s = p.toString();
    return s ? '?' + s : '';
  }

  const apiClient = (typeof window !== 'undefined' && window.api) || {
    thresholds: () => request('/api/thresholds'),
    streamWindow: (biomarkers, last = 300) =>
      request('/api/stream/window' + qs({ biomarkers: biomarkers.join(','), last })),
    dailyReport: (day) => request(day === 'latest' ? '/api/daily/latest' : `/api/daily/${day}`),
    alerts: (params = {}) => request('/api/alerts' + qs(params)),
  };


  // =========================================================================
  // 5. DOM ELEMENTS & VIEW TOGGLE CONTROLLER
  // =========================================================================
  const btnTable = document.getElementById('btnTableView');
  const btnGraphic = document.getElementById('btnGraphicView');
  const tableWrapper = document.getElementById('tableViewWrapper');
  const graphicWrapper = document.getElementById('graphicViewWrapper');
  const deviationBars = document.getElementById('deviationBars');
  const tableBody = document.querySelector('#biomarkersTable tbody');

  // Fallback dataset if backend is offline
  const FALLBACK_BIOMARKERS_LIST = [
    { name: 'Absorbed_dose_msv', val: '699 mSv', range: '1 to 400', pct: 85, status: 'worsening', severity: 'CRITICAL', trend: 'worsening', alertMsg: 'Absorbed_dose_msv = 699 mSv is outside normal range [1, 400]' },
    { name: 'Lymphocyte_Count', val: '1388 cells/uL', range: '1500 to 3000', pct: 46, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Lymphocyte_Count = 1388 is below threshold [1500, 3000]' },
    { name: 'Ctx_p1np_Ratio', val: '1.68 x base', range: '0.5 to 1.5', pct: 75, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Ctx_p1np_Ratio = 1.68 is outside normal range [0.5, 1.5]' },
    { name: 'T_score', val: '-1.44 SD', range: '-1 to 3', pct: 30, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'T_score = -1.44 SD is outside normal range [-1, 3]' },
    { name: 'Urinary_Calcium_mg', val: '307 mg/d', range: '0 to 300', pct: 82, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Urinary_Calcium_mg = 307 mg is outside normal range [0, 300]' },
    { name: 'Body_Weight', val: '70.81 kg', range: '73.5 to 76.5', pct: 60, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Body_Weight = 70.81 kg is outside normal range [73.5, 76.5]' },
    { name: 'Calories_kcal', val: '2118 kcal', range: '2600 to 3200', pct: 65, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Calories_kcal = 2118 kcal is outside normal range [2600, 3200]' },
    { name: 'Magnesium_Serum', val: '1.64 mg/dL', range: '1.7 to 2.2', pct: 68, status: 'improving', severity: 'NORM', trend: 'improving', alertMsg: null },
    { name: 'Vitamin_D_Serum', val: '21.62 ng/mL', range: '30 to 50', pct: 45, status: 'stable', severity: 'NORM', trend: 'stable', alertMsg: null },
    { name: 'Calf_circumference', val: '34.27 cm', range: '35 to 38', pct: 55, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Calf_circumference = 34.27 cm is outside normal range [35, 38]' },
    { name: 'Refraction_Shift', val: '0.69 D', range: '-0.25 to 0.25', pct: 78, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Refraction_Shift = 0.69 D is outside normal range [-0.25, 0.25]' },
    { name: 'TRF_Diffrence', val: '33.71 um', range: '0 to 20.9', pct: 88, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'TRF_Diffrence = 33.71 um is outside normal range [0, 20.9]' },
    { name: 'Visual_Acuity_Decrement', val: '1.50 line', range: '0 to 0.5', pct: 90, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'Visual_Acuity_Decrement = 1.50 line is outside normal range [0, 0.5]' },
    { name: 'IJV_Flow', val: '1.00 State', range: '0 to 0', pct: 80, status: 'worsening', severity: 'URGENT', trend: 'worsening', alertMsg: 'IJV_Flow = 1.00 State is outside normal range [0, 0]' }
  ];


  // =========================================================================
  // 6. RENDER TABLE & GRAPHIC VIEWS (READING FROM ALARMS LIST)
  // =========================================================================
  function renderTableRows(list) {
    if (!tableBody) return;
    tableBody.innerHTML = list.map(b => {
      let trendSymbol = '&#x2192;';
      if (b.status === 'worsening') trendSymbol = '&#x2197;';
      else if (b.status === 'improving') trendSymbol = '&#x2198;';

      // Alarm tag indicator if an active alert is reading for this biomarker
      let alarmTag = '';
      if (b.severity === 'CRITICAL') {
        alarmTag = `<span style="display:inline-block; margin-left:6px; padding:2px 5px; font-size:0.75rem; background:rgba(255,42,42,0.25); color:#ff4444; border:1px solid #ff4444; border-radius:2px; letter-spacing:0.5px;">ALARM</span>`;
      } else if (b.severity === 'URGENT') {
        alarmTag = `<span style="display:inline-block; margin-left:6px; padding:2px 5px; font-size:0.75rem; background:rgba(255,170,0,0.2); color:#ffaa00; border:1px solid #ffaa00; border-radius:2px; letter-spacing:0.5px;">URGENT</span>`;
      }

      return `
        <tr class="table-data-row" data-id="${b.name}" data-alert="${b.alertMsg || ''}" data-severity="${b.severity}">
          <td class="col-biomarker"><span class="node-tick left"></span>${b.name}${alarmTag}</td>
          <td class="col-daily">${b.val}</td>
          <td class="col-normal">${b.range}</td>
          <td class="col-trends trend-${b.status}">${trendSymbol} ${b.status.toUpperCase()}<span class="node-tick right"></span></td>
        </tr>
      `;
    }).join('');

    // Attach row click listeners for rich toast telemetry details
    tableBody.querySelectorAll('.table-data-row').forEach(row => {
      row.addEventListener('click', () => {
        const severity = row.getAttribute('data-severity');
        if (severity === 'CRITICAL') {
          playBeep(950, 0.08, 'sawtooth');
        } else if (severity === 'URGENT') {
          playBeep(700, 0.07, 'triangle');
        } else {
          playBeep(1200, 0.04, 'sine');
        }

        const cells = row.querySelectorAll('td');
        const name = cells[0]?.innerText.trim() || 'Biomarker';
        const val = cells[1]?.innerText.trim() || '';
        const range = cells[2]?.innerText.trim() || '';
        const trend = cells[3]?.innerText.trim() || '';
        const alertMsg = row.getAttribute('data-alert');

        if (alertMsg) {
          showToast(name, `Value: ${val} • ⚠️ ALARM: ${alertMsg}`);
        } else {
          showToast(name, `Value: ${val} • Range: ${range} • ${trend}`);
        }
      });
    });
  }

  function renderGraphicBars(list) {
    if (!deviationBars) return;
    deviationBars.innerHTML = list.map(b => {
      let fillClass = b.status;
      let inlineStyle = `width: ${b.pct}%;`;
      if (b.severity === 'CRITICAL') {
        inlineStyle += ' background: #ff2a2a; box-shadow: 0 0 10px #ff2a2a;';
      } else if (b.severity === 'URGENT') {
        inlineStyle += ' background: #ffaa00; box-shadow: 0 0 8px #ffaa00;';
      }

      return `
        <div class="chart-bar-row">
          <div class="chart-bar-label">
            <strong>${b.name}</strong>
            <span>${b.val} <small>(Normal: ${b.range})</small></span>
          </div>
          <div class="chart-track">
            <div class="chart-fill ${fillClass}" style="${inlineStyle}"></div>
          </div>
        </div>
      `;
    }).join('');
  }


  // =========================================================================
  // 7. DYNAMIC DATA LOADER (CORRELATING BIOMARKERS WITH ALARMS LIST)
  // =========================================================================
  async function loadBiomarkersData() {
    try {
      // 1. Concurrently fetch latest daily report & active alarms list
      const [reportRes, alertsRes] = await Promise.allSettled([
        apiClient.dailyReport('latest'),
        apiClient.alerts({ limit: 60 })
      ]);

      const report = reportRes.status === 'fulfilled' ? reportRes.value : null;
      if (!report || !report.biomarkers || !report.biomarkers.length) {
        renderTableRows(FALLBACK_BIOMARKERS_LIST);
        renderGraphicBars(FALLBACK_BIOMARKERS_LIST);
        return;
      }

      // 2. Build alarms index keyed by subject biomarker
      const alertMap = new Map();
      const allAlerts = [];
      if (report.alerts && Array.isArray(report.alerts)) {
        allAlerts.push(...report.alerts);
      }
      if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value)) {
        allAlerts.push(...alertsRes.value);
      }

      allAlerts.forEach(a => {
        if (a && a.subject) {
          const key = String(a.subject).toLowerCase().trim();
          // Store highest priority alert (CRITICAL > URGENT > WATCH)
          if (!alertMap.has(key) || (a.level === 'CRITICAL' && alertMap.get(key).level !== 'CRITICAL')) {
            alertMap.set(key, a);
          }
        }
      });

      // 3. Map biomarker rows with live metrics and matching alarms
      const list = report.biomarkers.map(b => {
        const valNum = Number(b.value);
        let formattedVal = isNaN(valNum) ? '-' : (Math.abs(valNum) >= 100 ? valNum.toFixed(0) : valNum.toFixed(2));
        const valStr = `${formattedVal} ${b.unit || ''}`.trim();
        const rangeStr = (b.norm_lo !== undefined && b.norm_hi !== undefined)
          ? `${b.norm_lo} to ${b.norm_hi}`
          : 'Nominal';

        // Percentage for deviation progress track
        let pct = 50;
        if (b.norm_lo !== undefined && b.norm_hi !== undefined && b.norm_hi > b.norm_lo) {
          const frac = (valNum - b.norm_lo) / (b.norm_hi - b.norm_lo);
          pct = Math.min(100, Math.max(10, Math.round(frac * 100)));
        } else if (b.dev !== undefined && b.dev !== null) {
          pct = Math.min(100, Math.max(10, Math.round(50 + Number(b.dev) * 15)));
        }

        // Check if an alarm is active for this biomarker
        const bioKey = String(b.biomarker).toLowerCase().trim();
        const activeAlarm = alertMap.get(bioKey);

        let severity = b.status || 'NORM';
        if (activeAlarm) {
          severity = activeAlarm.level || severity;
        }

        const statusClass = b.trend === 'worsening'
          ? 'worsening'
          : (b.trend === 'improving' ? 'improving' : 'stable');

        return {
          name: b.biomarker,
          val: valStr,
          range: rangeStr,
          pct: pct,
          status: statusClass,
          severity: severity,
          trend: b.trend || 'stable',
          alertMsg: activeAlarm ? activeAlarm.message : null
        };
      });

      renderTableRows(list);
      renderGraphicBars(list);

    } catch (err) {
      console.warn('Live API biomarkers unavailable, using standard mission baseline:', err);
      renderTableRows(FALLBACK_BIOMARKERS_LIST);
      renderGraphicBars(FALLBACK_BIOMARKERS_LIST);
    }
  }

  // Initial load
  loadBiomarkersData();

  // Periodically refresh data every 3 seconds to sync with backend simulation
  setInterval(loadBiomarkersData, 3000);


  // =========================================================================
  // 8. TABLE VS GRAPHIC VIEW SWITCHERS
  // =========================================================================
  if (btnTable && btnGraphic) {
    btnTable.addEventListener('click', () => {
      playBeep(1100, 0.04);
      btnTable.classList.add('active');
      btnGraphic.classList.remove('active');
      tableWrapper.style.display = 'flex';
      graphicWrapper.style.display = 'none';
      showToast('Table View', 'Displaying telemetry biomarker metrics & active alarms');
    });

    btnGraphic.addEventListener('click', () => {
      playBeep(1300, 0.05);
      btnGraphic.classList.add('active');
      btnTable.classList.remove('active');
      tableWrapper.style.display = 'none';
      graphicWrapper.style.display = 'flex';
      showToast('Graphic View', 'Telemetry Deviation Analytics');
    });
  }


  // =========================================================================
  // 9. 4 HOLOGRAPHIC CIRCLES (PAGE NAVIGATION BUTTONS)
  // =========================================================================
  const dials = document.querySelectorAll('.holo-dial');
  dials.forEach(dial => {
    dial.addEventListener('click', (e) => {
      playBeep(1400, 0.04);
      const href = dial.getAttribute('href');

      if (href && href !== '#' && href !== 'javascript:void(0)') {
        return; // Allow navigation to destination page
      }

      e.preventDefault();
      dials.forEach(d => d.classList.remove('active'));
      dial.classList.add('active'); // Darker active circle
      showToast(dial.getAttribute('title') || 'Navigation Circle', 'Active Page Circle (Darker)');
    });
  });

});
