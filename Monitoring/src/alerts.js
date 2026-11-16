/**
 * ============================================================================
 * NASA EVA BIOTELEMETRY HUD - ALERTS & DIAGNOSIS CONTROLLER
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

  function playAlertSound(type = 'critical') {
    try {
      if (!audioCtx) {
        const AudioClass = window.AudioContext || window.webkitAudioContext;
        if (AudioClass) audioCtx = new AudioClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const now = audioCtx.currentTime;

      if (type === 'critical') {
        // High-priority dual alarm chime
        [950, 500, 950].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sawtooth';
          const t = now + (idx * 0.08);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          osc.start(t);
          osc.stop(t + 0.07);
        });

      } else if (type === 'urgent') {
        // Two-tone urgent caution chime
        [650, 800].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'triangle';
          const t = now + (idx * 0.09);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.045, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.start(t);
          osc.stop(t + 0.08);
        });

      } else {
        // Nominal confirmation blip
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
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
  // 5. CONDITION & ALERT DEFINITIONS (FROM features.py & conditions.js)
  // =========================================================================
  const CONDITION_MAP = {
    'radiation': {
      code: 'ACUTE_RADIATION_SYNDROME',
      aliases: ['ACUTE_RADIATION_SYNDROME', 'ACUTE_RADIATION_SYNDOME'],
      label: 'Radiation Exposure',
      displayName: 'Radiation Exposure'
    },
    'bone-renal': {
      code: 'BONE_RENAL_DECONDITIONING',
      aliases: ['BONE_RENAL_DECONDITIONING'],
      label: 'Bone loss & Kidney-Stone Risk',
      displayName: 'Bone loss & Kidney-Stone Risk'
    },
    'metabolism': {
      code: 'METABOLIC_HYDRATION',
      aliases: ['METABOLIC_HYDRATION'],
      label: 'Metabolism & Hydration',
      displayName: 'Metabolism & Hydration'
    },
    'nutrient': {
      code: 'NUTRITION_DEFICIENCY',
      aliases: ['NUTRITION_DEFICIENCY'],
      label: 'Nutrient deficiency',
      displayName: 'Nutrient deficiency'
    },
    'sans': {
      code: 'SANS_OCULAR_RISK',
      aliases: ['SANS_OCULAR_RISK'],
      label: 'Eye & Vision Chnages (sans)',
      displayName: 'Eye & Vision Chnages (sans)'
    },
    'heart-stress': {
      code: 'AUTONOMIC_STRESS_CARDIO',
      aliases: ['AUTONOMIC_STRESS_CARDIO'],
      label: 'Heart, Stress & fatigue',
      displayName: 'Heart, Stress & fatigue'
    },
    'infection': {
      code: 'SYSTEMIC_INFLAMMATION',
      aliases: ['SYSTEMIC_INFLAMMATION'],
      label: 'Inflamation / Infection',
      displayName: 'Inflamation / Infection'
    },
    'neck-vein': {
      code: 'VTE_THROMBOSIS_RISK',
      aliases: ['VTE_THROMBOSIS_RISK'],
      label: 'Neck Vain Clot Risk',
      displayName: 'Neck Vain Clot Risk'
    }
  };

  function getConditionKey(conditionCode) {
    if (!conditionCode) return null;
    const clean = String(conditionCode).toUpperCase();
    for (const [key, meta] of Object.entries(CONDITION_MAP)) {
      if (meta.code === clean || meta.aliases.includes(clean)) return key;
    }
    return null;
  }

  function getConditionLabel(conditionCode) {
    const key = getConditionKey(conditionCode);
    if (key && CONDITION_MAP[key]) return CONDITION_MAP[key].label;
    return conditionCode;
  }

  // Baseline fallback data if backend server is not active
  const FALLBACK_CONDITIONS = [
    { condition: 'ACUTE_RADIATION_SYNDROME', score: 3, n_crit: 1, n_urgent: 0, n_spike: 0, level: 'CRITICAL' },
    { condition: 'BONE_RENAL_DECONDITIONING', score: 2, n_crit: 0, n_urgent: 2, n_spike: 0, level: 'URGENT' },
    { condition: 'METABOLIC_HYDRATION', score: 2, n_crit: 0, n_urgent: 2, n_spike: 0, level: 'URGENT' },
    { condition: 'NUTRITION_DEFICIENCY', score: 2, n_crit: 0, n_urgent: 2, n_spike: 0, level: 'URGENT' },
    { condition: 'SANS_OCULAR_RISK', score: 4, n_crit: 0, n_urgent: 4, n_spike: 0, level: 'URGENT' },
    { condition: 'AUTONOMIC_STRESS_CARDIO', score: 0, n_crit: 0, n_urgent: 0, n_spike: 0, level: 'NORMAL' },
    { condition: 'SYSTEMIC_INFLAMMATION', score: 0, n_crit: 0, n_urgent: 0, n_spike: 0, level: 'NORMAL' },
    { condition: 'VTE_THROMBOSIS_RISK', score: 0, n_crit: 0, n_urgent: 0, n_spike: 0, level: 'NORMAL' }
  ];

  const FALLBACK_ALERTS = [
    { id: 1, condition: 'ACUTE_RADIATION_SYNDROME', level: 'CRITICAL', kind: 'THRESHOLD', message: 'Absorbed_dose_msv = 700.00 mSv is outside the normal range' },
    { id: 2, condition: 'METABOLIC_HYDRATION', level: 'URGENT', kind: 'THRESHOLD', message: 'Body_Weight = 71.16 kg is outside the normal range [73.5, 76.5]' },
    { id: 3, condition: 'NUTRITION_DEFICIENCY', level: 'URGENT', kind: 'THRESHOLD', message: 'Calf_circumference = 34.79 cm is outside the normal range [35, 38]' },
    { id: 4, condition: 'METABOLIC_HYDRATION', level: 'URGENT', kind: 'THRESHOLD', message: 'Calories_kcal = 2344.30 kcal is outside the normal range [2600, 3200]' },
    { id: 5, condition: 'BONE_RENAL_DECONDITIONING', level: 'URGENT', kind: 'THRESHOLD', message: 'Ctx_p1np_Ratio = 1.55 x base is outside the normal range [0.5, 1.5]' },
    { id: 6, condition: 'VTE_THROMBOSIS_RISK', level: 'URGENT', kind: 'THRESHOLD', message: 'Ijv_flow = 1.00 is outside the normal range [0, 0]' }
  ];


  // =========================================================================
  // 6. DOM ELEMENTS & STATE MANAGEMENT
  // =========================================================================
  const alertsGrid = document.getElementById('alertsGrid');
  const alertCards = document.querySelectorAll('.alert-card');
  const diagBlockCritical = document.getElementById('diagBlockCritical');
  const diagBlockUrgent = document.getElementById('diagBlockUrgent');
  const symptomsCritical = document.getElementById('symptomsCritical');
  const symptomsUrgent = document.getElementById('symptomsUrgent');

  let activeFilterKey = null; // null = show all; or 'radiation', 'sans', etc.
  let latestReport = null;
  let latestAlerts = [];


  // =========================================================================
  // 7. RENDER FUNCTIONS (GRID, DIAGNOSIS, SYMPTOMS)
  // =========================================================================

  /**
   * Updates the 8 alert cards on the left panel
   */
  function renderAlertCards(conditions) {
    if (!alertCards || !alertCards.length) return;

    // Build map of condition records keyed by canonical condition code
    const condByCode = {};
    conditions.forEach(c => {
      if (c && c.condition) {
        condByCode[c.condition.toUpperCase()] = c;
      }
    });

    alertCards.forEach(card => {
      const alertKey = card.dataset.alert;
      const meta = CONDITION_MAP[alertKey];
      if (!meta) return;

      // Find matching condition record (check primary code and aliases)
      let condRec = condByCode[meta.code];
      if (!condRec) {
        for (const alias of meta.aliases) {
          if (condByCode[alias]) {
            condRec = condByCode[alias];
            break;
          }
        }
      }

      const score = condRec ? Math.max(0, Math.round(Number(condRec.score) || 0)) : 0;
      let level = condRec ? (condRec.level || 'NORMAL') : 'NORMAL';
      if (condRec && Number(condRec.n_crit) > 0) {
        level = 'CRITICAL';
      } else if (condRec && (Number(condRec.n_urgent) > 0 || score > 0)) {
        level = 'URGENT';
      }

      // Update card classes
      card.classList.remove('card-critical', 'card-urgent', 'card-normal');
      const badgeEl = card.querySelector('.alert-status-badge');
      const scoreEl = card.querySelector('.alert-card-score');

      if (level === 'CRITICAL') {
        card.classList.add('card-critical');
        if (badgeEl) {
          badgeEl.className = 'alert-status-badge badge-critical';
          badgeEl.textContent = 'CRITICAL';
        }
      } else if (level === 'URGENT') {
        card.classList.add('card-urgent');
        if (badgeEl) {
          badgeEl.className = 'alert-status-badge badge-urgent';
          badgeEl.textContent = 'URGENT';
        }
      } else {
        card.classList.add('card-normal');
        if (badgeEl) {
          badgeEl.className = 'alert-status-badge badge-normal';
          badgeEl.textContent = 'ALL NORMAL';
        }
      }

      if (scoreEl) {
        scoreEl.textContent = `SCORE: ${score}`;
      }
    });
  }

  /**
   * Helper to format symptom message text with bold metric prefix
   */
  function formatSymptomHTML(msg) {
    if (!msg) return '';
    // E.g. "body_weight = 71.16 kg is outside the normal range [73.5, 76.5]"
    const match = msg.match(/^([^=]+=\s*[^i]+?)\s+(is\s+.+)$/i);
    if (match) {
      const metric = match[1].trim();
      const rest = match[2].trim();
      return `<strong>${metric}</strong> ${rest}`;
    }
    return `<strong>${msg}</strong>`;
  }

  /**
   * Renders the DIAGNOSIS column (Critical & Urgent blocks)
   */
  function renderDiagnosis(conditions) {
    if (!diagBlockCritical && !diagBlockUrgent) return;

    let targetConditions = conditions;
    if (activeFilterKey) {
      const meta = CONDITION_MAP[activeFilterKey];
      if (meta) {
        targetConditions = conditions.filter(c => meta.aliases.includes(c.condition.toUpperCase()));
      }
    }

    const criticalList = targetConditions.filter(c =>
      c.level === 'CRITICAL' || (Number(c.n_crit) > 0)
    );

    const urgentList = targetConditions.filter(c =>
      c.level === 'URGENT' || (Number(c.n_urgent) > 0) || (Number(c.score) > 0 && c.level !== 'CRITICAL')
    );

    // 1. Render Critical Diagnoses
    if (diagBlockCritical) {
      if (criticalList.length > 0) {
        diagBlockCritical.style.display = 'block';
        const innerHTML = `
          <div class="bus-node-marker marker-red top"></div>
          <div class="diag-badge-row">
            <span class="status-badge badge-critical">CRITICAL</span>
            <span class="hazard-icon red">&#x26A0;</span>
          </div>
          <div class="diag-detail-text">
            ${criticalList.map(c => `
              <div style="margin-bottom: 6px;">
                <strong class="diag-code">${c.condition}:</strong>
                <span class="diag-desc">score ${c.score} (${c.n_crit || 0} critical, ${c.n_urgent || 0} urgent, ${c.n_spike || 0} spike).</span>
              </div>
            `).join('')}
          </div>
          <div class="bus-node-marker marker-red bottom"></div>
        `;
        diagBlockCritical.innerHTML = innerHTML;
      } else {
        // If filter is active or nominal
        if (activeFilterKey) {
          diagBlockCritical.style.display = 'none';
        } else {
          diagBlockCritical.style.display = 'block';
          diagBlockCritical.innerHTML = `
            <div class="bus-node-marker marker-red top" style="background:#00e5ff; box-shadow:0 0 6px #00e5ff;"></div>
            <div class="diag-badge-row">
              <span class="status-badge" style="background:rgba(0,229,255,0.2); color:#00e5ff; border:1px solid #00e5ff;">NOMINAL</span>
            </div>
            <div class="diag-detail-text">
              <strong class="diag-code" style="color:#00e5ff;">SYSTEM STATUS:</strong>
              <span class="diag-desc">No critical diagnostic conditions detected.</span>
            </div>
            <div class="bus-node-marker marker-red bottom" style="background:#00e5ff; box-shadow:0 0 6px #00e5ff;"></div>
          `;
        }
      }
    }

    // 2. Render Urgent Diagnoses
    if (diagBlockUrgent) {
      const urgentListContainer = diagBlockUrgent.querySelector('.urgent-diag-list');
      if (urgentListContainer) {
        if (urgentList.length > 0) {
          diagBlockUrgent.style.display = 'block';
          urgentListContainer.innerHTML = urgentList.map(c => `
            <div class="urgent-item">
              <strong class="item-name">${getConditionLabel(c.condition)}:</strong>
              <span class="item-data">${c.condition}: score ${c.score} (${c.n_crit || 0} critical, ${c.n_urgent || 0} urgent, ${c.n_spike || 0} spike)</span>
            </div>
          `).join('');
        } else {
          urgentListContainer.innerHTML = `
            <div class="urgent-item">
              <span class="item-data" style="color: #7efcff;">No urgent diagnostic anomalies for selected scope.</span>
            </div>
          `;
        }
      }
    }
  }

  /**
   * Renders the SYMPTOMS column from the alarms list
   */
  function renderSymptoms(alertsList) {
    if (!symptomsCritical && !symptomsUrgent) return;

    let targetAlerts = alertsList;
    if (activeFilterKey) {
      const meta = CONDITION_MAP[activeFilterKey];
      if (meta) {
        targetAlerts = alertsList.filter(a =>
          a.condition && meta.aliases.includes(a.condition.toUpperCase())
        );
      }
    }

    // Filter by severity level (exclude top-level CONDITION rollups to show individual instrument breaches)
    const critAlerts = targetAlerts.filter(a =>
      a.level === 'CRITICAL' && a.kind !== 'CONDITION'
    );

    const urgentAlerts = targetAlerts.filter(a =>
      (a.level === 'URGENT' || a.level === 'WATCH') && a.kind !== 'CONDITION'
    );

    // 1. Critical Symptoms Section
    if (symptomsCritical) {
      if (critAlerts.length > 0) {
        symptomsCritical.style.display = 'block';
        symptomsCritical.innerHTML = critAlerts.map(a => `
          <div class="symptom-item-row item-critical">
            <span class="bus-node-marker marker-red"></span>
            <span class="connector-bus-line line-red"></span>
            <p class="symptom-text red-highlight">
              ${formatSymptomHTML(a.message)}
            </p>
          </div>
        `).join('');
      } else {
        if (activeFilterKey) {
          symptomsCritical.style.display = 'none';
        } else {
          symptomsCritical.style.display = 'block';
          symptomsCritical.innerHTML = `
            <div class="symptom-item-row item-nominal">
              <span class="bus-node-marker" style="background:#00e5ff; box-shadow: 0 0 8px #00e5ff;"></span>
              <p class="symptom-text" style="color: #7efcff;">All acute biomarkers within nominal safety margins.</p>
            </div>
          `;
        }
      }
    }

    // 2. Urgent Symptoms Stack
    if (symptomsUrgent) {
      const urgentStack = symptomsUrgent.querySelector('.urgent-symptoms-stack');
      if (urgentStack) {
        if (urgentAlerts.length > 0) {
          urgentStack.innerHTML = urgentAlerts.map(a => `
            <div class="symptom-item-row item-urgent">
              <span class="bus-node-marker marker-yellow"></span>
              <p class="symptom-text">
                ${formatSymptomHTML(a.message)}
              </p>
            </div>
          `).join('');
        } else {
          urgentStack.innerHTML = `
            <div class="symptom-item-row item-nominal">
              <span class="bus-node-marker" style="background:#00e5ff; box-shadow: 0 0 8px #00e5ff;"></span>
              <p class="symptom-text" style="color: #7efcff;">All physiological instrument thresholds nominal.</p>
            </div>
          `;
        }
      }
    }
  }


  // =========================================================================
  // 8. DATA LOADER & AUTO-REFRESH CONTROLLER
  // =========================================================================
  async function loadAlertsAndConditions() {
    try {
      // 1. Fetch latest daily report & recent alert events
      const [report, alertsData] = await Promise.allSettled([
        apiClient.dailyReport('latest'),
        apiClient.alerts({ limit: 60 })
      ]);

      let conditions = [];
      let alerts = [];

      if (report.status === 'fulfilled' && report.value && report.value.conditions) {
        latestReport = report.value;
        conditions = report.value.conditions;
        if (report.value.alerts && report.value.alerts.length) {
          alerts = report.value.alerts;
        }
      }

      if (alertsData.status === 'fulfilled' && Array.isArray(alertsData.value) && alertsData.value.length) {
        // Merge or prioritize newest alerts
        const existingIds = new Set(alerts.map(a => a.id));
        alertsData.value.forEach(a => {
          if (!existingIds.has(a.id)) {
            alerts.push(a);
            existingIds.add(a.id);
          }
        });
      }

      // If backend returned no condition list, fallback gracefully
      if (!conditions || !conditions.length) {
        conditions = FALLBACK_CONDITIONS;
      }
      if (!alerts || !alerts.length) {
        alerts = FALLBACK_ALERTS;
      }

      latestAlerts = alerts;

      // Update HUD elements
      renderAlertCards(conditions);
      renderDiagnosis(conditions);
      renderSymptoms(alerts);

    } catch (err) {
      console.warn('Live alerts API unavailable, using telemetry baseline:', err);
      renderAlertCards(FALLBACK_CONDITIONS);
      renderDiagnosis(FALLBACK_CONDITIONS);
      renderSymptoms(FALLBACK_ALERTS);
    }
  }


  // =========================================================================
  // 9. INTERACTIVE CARD SELECTION & FILTERING
  // =========================================================================
  alertCards.forEach(card => {
    card.addEventListener('click', () => {
      const isCritical = card.classList.contains('card-critical');
      const isUrgent = card.classList.contains('card-urgent');
      const soundType = isCritical ? 'critical' : (isUrgent ? 'urgent' : 'normal');

      playAlertSound(soundType);

      const alertKey = card.dataset.alert;
      const title = card.querySelector('.alert-card-title')?.textContent || 'Alert';
      const badge = card.querySelector('.alert-status-badge')?.textContent || '';
      const score = card.querySelector('.alert-card-score')?.textContent || '';

      // If clicked card is already active, toggle filter off (show all)
      if (card.classList.contains('active') && activeFilterKey === alertKey) {
        card.classList.remove('active');
        activeFilterKey = null;
        showToast('All Conditions', 'Displaying full mission alerts log');
      } else {
        alertCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        activeFilterKey = alertKey;
        showToast(title, `${badge} • ${score} (Filtered)`);
      }

      // Re-render diagnosis & symptoms matching filter state
      const currentConditions = (latestReport && latestReport.conditions) ? latestReport.conditions : FALLBACK_CONDITIONS;
      const currentAlerts = (latestAlerts && latestAlerts.length) ? latestAlerts : FALLBACK_ALERTS;

      renderDiagnosis(currentConditions);
      renderSymptoms(currentAlerts);
    });
  });


  // =========================================================================
  // 10. 4 HOLOGRAPHIC CIRCLES (PAGE NAVIGATION BUTTONS)
  // =========================================================================
  const dials = document.querySelectorAll('.holo-dial');
  dials.forEach(dial => {
    dial.addEventListener('click', (e) => {
      playAlertSound('normal');
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


  // =========================================================================
  // 11. INITIAL LOAD & PERIODIC REFRESH (EVERY 3 SECONDS)
  // =========================================================================
  loadAlertsAndConditions();
  setInterval(loadAlertsAndConditions, 3000);

});
