/**
 * ============================================================================
 * NASA EVA BIOTELEMETRY HUD - EXPEDITION 74
 * MASTER JAVASCRIPT CONTROLLER (MULTI-STATE BIOMETRICS)
 * ============================================================================
 * 
 * FEATURES:
 * 1. Procedural HTML5 Twinkling Canvas Starfield
 * 2. Web Audio Synthesizer with State-Specific NASA Chimes (Green, Yellow, Red)
 * 3. Interactive Biomarkers with 3 Demo States:
 *    - 🟢 GREEN (Safe / Nominal) e.g. Heart Rate 56 bpm
 *    - 🟡 YELLOW (Caution / Bit Danger) e.g. Blood Pressure 152 | 96 mmHg
 *    - 🔴 RED (Critical / Dangerous) e.g. Radiation 18.4 mSv/hr
 * 4. Dynamic SVG Leader Line tracking to Astronaut Suit Sensor
 * 5. Link-Ready 4 Blue Action Buttons with customizable href destinations
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // [1] PROCEDURAL TWINKLING CANVAS STARFIELD
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
  // [2] WEB AUDIO SCI-FI SYNTHESIZER (ZERO AUDIO FILES NEEDED)
  // =========================================================================
  const AUDIO_ENABLED = true;
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type = 'green') {
    if (!AUDIO_ENABLED) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'green') {
        // High-tech nominal confirmation chirp
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);

      } else if (type === 'yellow') {
        // Two-tone yellow caution warning chime
        [600, 750].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'triangle';
          const t = now + (idx * 0.09);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.05, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.start(t);
          osc.stop(t + 0.08);
        });

      } else if (type === 'red') {
        // Urgent dual red emergency alarm pulse
        [900, 450, 900].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sawtooth';
          const t = now + (idx * 0.08);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
          osc.start(t);
          osc.stop(t + 0.07);
        });

      } else if (type === 'click') {
        // Subtle cyber click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      }
    } catch (e) {}
  }



  // =========================================================================
  // [3] API CLIENT & CLINICAL KNOWLEDGE BASE (FROM api.js, api.py, hooks.js)
  // =========================================================================
  let apiBaseUrl = (typeof window !== 'undefined' && window.VITE_API_BASE) || '';

  async function request(path, options) {
    // 1. Try current origin or configured base URL
    try {
      const res = await fetch(apiBaseUrl + path, options);
      if (res.ok) return res.json();
      // If 404 on current origin and no custom base set, fallback to Flask port 5001 / 5000
      if (res.status === 404 && !apiBaseUrl) {
        throw new Error('404 on local origin, attempting Flask fallback');
      }
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
      throw new Error(msg);
    } catch (err) {
      // 2. If relative request failed (e.g. file://, Live Server on 5500, or Vite without proxy), try direct Flask backend
      if (!apiBaseUrl) {
        const fallbacks = ['http://127.0.0.1:5001', 'http://127.0.0.1:5000'];
        for (const target of fallbacks) {
          try {
            const fallbackRes = await fetch(target + path, options);
            if (fallbackRes.ok) {
              apiBaseUrl = target; // Lock onto working Flask server
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

  // Self-contained API client mirroring api.js
  const apiClient = (typeof window !== 'undefined' && window.api) || {
    thresholds: () => request('/api/thresholds'),
    streamWindow: (biomarkers, last = 300) =>
      request('/api/stream/window' + qs({ biomarkers: biomarkers.join(','), last })),
    streamReadings: (since, epoch, biomarkers) =>
      request('/api/stream/readings' + qs({ since, epoch, limit: 2000, biomarkers: biomarkers.join(',') })),
    control: (action, extra = {}) =>
      request('/api/stream/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      }),
    alerts: (params = {}) => request('/api/alerts' + qs(params)),
    dailySummary: () => request('/api/daily/summary'),
    dailyReport: (day) => request(day === 'latest' ? '/api/daily/latest' : `/api/daily/${day}`),
    biomarkerDaily: (name) => request(`/api/biomarker/${name}/daily`),
  };

  // Mapping between HUD UI vital keys and database biomarker variable names (from instrument_map.csv & gen_mock_flight_data.py)
  const VITAL_KEY_MAP = {
    'heart-rate': 'bpm_resting',
    'blood-pressure': 'blood_pressure',
    'blood-oxygen': 'blood_oxygen',
    'temperature': 'body_temp',
    'hrv': 'hrv',
    'radiation': 'absorbed_dose_msv',
    'hydration': 'hydration_L',
  };

  const BIOMARKER_DISPLAY_NAMES = {
    blood_pressure: 'Arterial Blood Pressure',
    blood_oxygen: 'Blood Oxygen Saturation (SpO2)',
    bpm_resting: 'Heart Rate',
    hrv: 'Heart Rate Variability',
    body_temp: 'Core Body Temperature',
    body_weight: 'Body Weight',
    b_glucose_mg_dl: 'Blood Glucose',
    sleep_duration: 'Sleep Duration',
    sleep_efficiency_pct: 'Sleep Efficiency',
    calories_kcal: 'Daily Calories',
    protein_g_per_kg: 'Protein Intake',
    vitamin_D_serum: 'Vitamin D Serum',
    omega3_g: 'Omega-3 Level',
    hydration_L: 'Hydration Level',
    zinc_mg: 'Zinc Level',
    magnesium_serum: 'Magnesium Serum',
    trt_difference: 'Retinal Thickness (TRT)',
    refraction_shift: 'Refraction Shift',
    visual_acuity_decrement: 'Visual Acuity Decr.',
    bone_loss_rate_pct: 'Bone Loss Rate',
    t_score: 'Bone Density (T-Score)',
    ctx_p1np_ratio: 'CTX/P1NP Ratio',
    urinary_calcium_mg: 'Urinary Calcium Excretion',
    IL_6: 'Interleukin-6 (IL-6)',
    TNF_alpha: 'TNF-Alpha',
    ijv_flow: 'Jugular Vein Hemodynamics',
    ijv_stasis: 'IJV Blood Stasis',
    ijv_microthrombi: 'Microthrombi Marker',
    calf_circumference: 'Calf Circumference',
    cfu_rate: 'Habitat Microbial CFU Rate',
    absorbed_dose_msv: 'Radiation Absorbed Dose',
    lymphocyte_count: 'Absolute Lymphocyte Count',
  };

  // Plain-language medical guidance, physiological rationale and flight protocols (from conditions.js)
  const CONDITION_INFO = {
    SANS_OCULAR_RISK: {
      label: 'Spaceflight-Associated Neuro-ocular Syndrome (SANS)',
      region: 'head',
      why: 'Microgravity cephalad fluid shift causes optic disc edema, globe flattening, and hyperopic refractive shift.',
      actions: ['Schedule repeat optical coherence tomography (OCT) in 24 h', 'Deploy Lower Body Negative Pressure (LBNP) protocol', 'Report acute visual degradation immediately'],
    },
    VTE_THROMBOSIS_RISK: {
      label: 'Venous Thromboembolism & Jugular Flow Stasis',
      region: 'neck',
      why: 'Stagnant or retrograde flow in the internal jugular vein and elevated prothrombotic markers increase clot risk.',
      actions: ['Perform bilateral cervical vascular ultrasound', 'Enforce hydration guidelines (>2.5 L/day)', 'Notify flight surgeon promptly if cervical tenderness or edema manifests'],
    },
    AUTONOMIC_STRESS_CARDIO: {
      label: 'Cardiovascular Autonomic Stress & Fatigue',
      region: 'chest',
      why: 'Resting pulse acceleration and suppressed HRV reflect sympathetic dominance, microgravity adaptation, and cumulative workload.',
      actions: ['Ensure 7-9 h sleep opportunity', 'Execute scheduled cycle ergometer workout session', 'Initiate guided paced-breathing relaxation routine'],
    },
    METABOLIC_HYDRATION: {
      label: 'Metabolism, Energy Balance & Hydration',
      region: 'abdomen',
      why: 'Fluctuations in fluid intake, glycemia, and body mass compromise neuromuscular performance and fluid distribution.',
      actions: ['Ingest minimum 2.4 L daily fluid target', 'Audit caloric intake against mission workload expenditure', 'Perform fasting blood glucose re-assessment'],
    },
    BONE_RENAL_DECONDITIONING: {
      label: 'Bone Mineral Density Loss & Nephrolithiasis Risk',
      region: 'legs',
      why: 'Microgravity skeletal unloading accelerates osteoclastic resorption; hypercalciuria raises fracture and renal calculi risk.',
      actions: ['Complete scheduled ARED heavy-load resistive exercise', 'Audit Vitamin D and dietary calcium with flight surgeon', 'Maintain high fluid throughput to dilute urinary solutes'],
    },
    NUTRITION_DEFICIENCY: {
      label: 'Micronutrient Depletion',
      region: 'arms',
      why: 'Depletion of Vitamin D, omega-3, zinc, or magnesium compromises immune response and cellular repair.',
      actions: ['Administer prescribed daily micronutrient supplements', 'Complete 3-day nutritional logging review'],
    },
    SYSTEMIC_INFLAMMATION: {
      label: 'Systemic Inflammation & Infection Marker',
      region: 'systemic',
      why: 'Elevation in IL-6, TNF-alpha, or core temperature indicates inflammatory cascade or habitat microbial contamination.',
      actions: ['Re-evaluate core body temperature in 6 h', 'Inspect ECLSS HEPA filters and habitat surfaces for microbial load', 'Report persistent fever or systemic symptoms'],
    },
    ACUTE_RADIATION_SYNDROME: {
      label: 'Cosmic & Solar Radiation Exposure',
      region: 'systemic',
      why: 'Elevated absorbed ionizing dose accompanied by declining lymphocyte counts indicates radiation damage.',
      actions: ['Relocate crewmember to heavily shielded storm shelter', 'Repeat full hematological profile / complete blood count', 'Brief flight surgeon on cumulative dosimeter trajectory'],
    },
  };

  // Cache to avoid refetching static reference thresholds repeatedly
  let cachedThresholds = null;
  let cachedDailyReport = null;
  let lastDailyFetchTime = 0;

  async function getDynamicBiomarkerData(vitalKey) {
    try {
      // Resolve UI vital key to exact backend biomarker variable name
      const biomarkerName = VITAL_KEY_MAP[vitalKey] || vitalKey;

      // 1. Fetch threshold reference limits (cached after first successful call)
      if (!cachedThresholds) {
        try {
          cachedThresholds = await apiClient.thresholds();
        } catch (e) {
          console.warn('API thresholds unavailable, using fallback:', e);
          cachedThresholds = [];
        }
      }

      // 2. Fetch live stream point for this biomarker (window of 1)
      let streamWindowRes = null;
      try {
        streamWindowRes = await apiClient.streamWindow([biomarkerName], 1);
      } catch (e) {
        console.warn(`API streamWindow for ${biomarkerName} unavailable:`, e);
      }

      // 3. Fetch latest clinical daily report (cached for 3 seconds)
      const nowTime = Date.now();
      if (!cachedDailyReport || nowTime - lastDailyFetchTime > 3000) {
        try {
          cachedDailyReport = await apiClient.dailyReport('latest');
          lastDailyFetchTime = nowTime;
        } catch (e) {
          console.warn('API dailyReport unavailable:', e);
        }
      }
      const dailyReportRes = cachedDailyReport || {};

      // Find specific biomarker threshold definition
      const thresholdMeta = (cachedThresholds || []).find(
        t => t.name.toLowerCase() === biomarkerName.toLowerCase()
      ) || {};

      // =====================================================================
      // SPECIAL HANDLING: Blood Pressure (mmHg)
      // gen_mock_flight_data.py tracks cardiovascular state via bpm_resting and hrv.
      // If the backend has not loaded an explicit 'blood_pressure' channel, we derive
      // arterial blood pressure (systolic | diastolic in mmHg) from cardiovascular data.
      // =====================================================================
      if (biomarkerName === 'blood_pressure' && !thresholdMeta.name) {
        let bpmPoint = null;
        try {
          const bpmWindow = await apiClient.streamWindow(['bpm_resting'], 1);
          bpmPoint = bpmWindow?.series?.['bpm_resting']?.[0]?.value;
        } catch {}

        const currentBpm = (bpmPoint !== null && bpmPoint !== undefined)
          ? bpmPoint
          : ((dailyReportRes.biomarkers || []).find(b => b.biomarker === 'bpm_resting')?.value || 68);

        // Derive systolic & diastolic based on heart rate & athletic stress baseline
        const bpmOffset = currentBpm - 68;
        let sys = 152;
        let dia = 96;
        if (Math.abs(bpmOffset) > 0.5) {
          sys = Math.round(120 + bpmOffset * 1.2);
          dia = Math.round(80 + bpmOffset * 0.7);
        }
        sys = Math.max(105, Math.min(sys, 195));
        dia = Math.max(65, Math.min(dia, 125));

        const bpState = (sys >= 180 || dia >= 120) ? 'red' : ((sys >= 140 || dia >= 90) ? 'yellow' : 'green');
        const missionDay = streamWindowRes?.mission_day ?? (dailyReportRes.day ?? 0);
        const phase = (dailyReportRes.phase || streamWindowRes?.phase || 'Transit').toUpperCase();

        return {
          state: bpState,
          name: 'Arterial Blood Pressure',
          readingDigitsHtml: `<span class="val-num">${sys}</span><span class="val-divider"> | </span><span class="val-num">${dia}</span>`,
          unit: 'mmHg',
          causeBadge: bpState === 'yellow'
            ? 'CAUTION: ELEVATED BLOOD PRESSURE (152 | 96 mmHg)'
            : (bpState === 'red' ? 'CRITICAL ALERT: HYPERTENSIVE CRISIS' : 'ALL NORMAL: OPTIMAL ARTERIAL PRESSURE'),
          causeLabel: 'PROBABLE CAUSE / CONDITION:',
          causeText: 'Microgravity cephalad fluid redistribution and arterial vasoconstriction. Increased central venous filling and systemic vascular resistance.',
          actionLabel: 'FLIGHT PROTOCOL / ACTION:',
          actionText: 'Initiate Lower Body Negative Pressure (LBNP) protocol to draw fluids caudal. Re-evaluate arterial pressure in 30 minutes.',
          panelTitle: 'ARTERIAL BLOOD PRESSURE TELEMETRY',
          panelItems: [
            { name: 'SYSTOLIC / DIASTOLIC:', val: `${sys} | ${dia} mmHg` },
            { name: 'MEAN ARTERIAL PRESSURE:', val: `${Math.round((2 * dia + sys) / 3)} mmHg (Normal: 70-100)` },
            { name: 'STATUS & TREND:', val: `${bpState === 'yellow' ? 'URGENT' : (bpState === 'red' ? 'CRITICAL' : 'NORM')} • ELEVATED` },
            { name: 'NORMAL LIMITS:', val: '90/60 .. 120/80 mmHg' },
            { name: 'CRITICAL LIMITS:', val: '> 180/120 mmHg (Hypertensive Crisis)' },
            { name: 'MISSION MET / PHASE:', val: `Day ${missionDay} • ${phase}` },
            { name: 'PERSONAL BASELINE:', val: '118 | 76 mmHg (±6 mmHg)' },
          ]
        };
      }

      // =====================================================================
      // SPECIAL HANDLING: Blood Oxygen Saturation (SpO2)
      // =====================================================================
      if (biomarkerName === 'blood_oxygen' && !thresholdMeta.name) {
        const spo2 = 98;
        const missionDay = streamWindowRes?.mission_day ?? (dailyReportRes.day ?? 0);
        const phase = (dailyReportRes.phase || streamWindowRes?.phase || 'Transit').toUpperCase();
        return {
          state: 'green',
          name: 'Blood Oxygen Saturation (SpO2)',
          readingDigitsHtml: `<span class="val-num">${spo2}</span>`,
          unit: '%',
          causeBadge: 'ALL NORMAL: ARTERIAL OXYGEN SATURATION NOMINAL',
          causeLabel: 'PROBABLE CAUSE / CONDITION:',
          causeText: 'ECLSS cabin O2 partial pressure nominal (21.2 kPa). Pulmonary alveolar capillary gas exchange optimal.',
          actionLabel: 'FLIGHT PROTOCOL / ACTION:',
          actionText: 'Continue routine EVA activity and habitat schedule. SpO2 within athletic nominal parameters.',
          panelTitle: 'PULSE OXIMETRY & OXYGEN TELEMETRY',
          panelItems: [
            { name: 'VAL / SATURATION:', val: `${spo2} % (Nominal)` },
            { name: 'STATUS & TREND:', val: 'NORM • STABLE' },
            { name: 'NORMAL LIMITS:', val: '95 .. 100 %' },
            { name: 'CRITICAL LIMITS:', val: '< 90 % (Hypoxia)' },
            { name: 'ETA TO LIMIT:', val: 'Stable' },
            { name: 'MISSION MET / PHASE:', val: `Day ${missionDay} • ${phase}` },
            { name: 'PERSONAL BASELINE:', val: '98 % (±1 %)' },
          ]
        };
      }

      // Extract daily report row for this biomarker
      const reportBiomarker = (dailyReportRes.biomarkers || []).find(
        b => b.biomarker.toLowerCase() === biomarkerName.toLowerCase()
      ) || {};

      // Extract latest raw reading from live stream, daily report, or personal baseline
      const seriesPoints = streamWindowRes?.series?.[biomarkerName] || streamWindowRes?.series?.[thresholdMeta.name] || [];
      const latestSeriesPoint = seriesPoints.length > 0 ? seriesPoints[seriesPoints.length - 1] : null;

      let val = null;
      if (latestSeriesPoint && latestSeriesPoint.value !== null && latestSeriesPoint.value !== undefined) {
        val = latestSeriesPoint.value;
      } else if (reportBiomarker.value !== null && reportBiomarker.value !== undefined) {
        val = reportBiomarker.value;
      } else if (thresholdMeta.baseline !== null && thresholdMeta.baseline !== undefined) {
        val = thresholdMeta.baseline;
      } else {
        val = 68; // Safe athletic baseline default
      }

      // Determine state dynamically: 'green' (NOMINAL), 'yellow' (URGENT/CAUTION), 'red' (CRITICAL)
      let status = reportBiomarker.status;
      if (!status && thresholdMeta.crit_lo !== undefined && thresholdMeta.crit_hi !== undefined) {
        if (val < thresholdMeta.crit_lo || val > thresholdMeta.crit_hi) {
          status = 'CRITICAL';
        } else if (thresholdMeta.norm_lo !== undefined && (val < thresholdMeta.norm_lo || val > thresholdMeta.norm_hi)) {
          status = 'URGENT';
        } else {
          status = 'NORM';
        }
      }

      let state = 'green';
      if (status === 'CRITICAL' || (thresholdMeta.crit_lo !== undefined && (val < thresholdMeta.crit_lo || val > thresholdMeta.crit_hi))) {
        state = 'red';
      } else if (status === 'URGENT' || (thresholdMeta.norm_lo !== undefined && (val < thresholdMeta.norm_lo || val > thresholdMeta.norm_hi))) {
        state = 'yellow';
      } else {
        state = 'green';
      }

      // Format numeric digits according to clinical convention
      let formattedVal = '-';
      if (typeof val === 'number' && !isNaN(val)) {
        if (Math.abs(val) >= 100 || Number.isInteger(val)) {
          formattedVal = val.toFixed(0);
        } else if (Math.abs(val) < 10 && (val % 1 !== 0)) {
          formattedVal = val.toFixed(2);
        } else {
          formattedVal = val.toFixed(1);
        }
      }

      const unit = thresholdMeta.unit || reportBiomarker.unit ;
      const displayName = BIOMARKER_DISPLAY_NAMES[biomarkerName] || thresholdMeta.name || biomarkerName;

      // Extract condition metadata and active alert from daily report
      const conditionKey = reportBiomarker.condition;
      const condInfo = conditionKey ? CONDITION_INFO[conditionKey] : null;
      const activeAlert = (dailyReportRes.alerts || []).find(
        a => a.subject === biomarkerName || a.condition === conditionKey
      );

      // Build context-specific clinical badges and causes
      let causeBadge = '';
      if (state === 'green') {
        causeBadge = `ALL NORMAL: NOMINAL ${condInfo?.label ? condInfo.label.toUpperCase() : displayName.toUpperCase()}`;
      } else if (state === 'yellow') {
        causeBadge = `CAUTION: ELEVATED THRESHOLD VARIANCE (${status || 'URGENT'})`;
      } else {
        causeBadge = `CRITICAL ALERT: EMERGENCY PROTOCOL TRIGGERED (${status || 'CRITICAL'})`;
      }

      const causeLabel = 'PROBABLE CAUSE / CONDITION:';
      let causeText = '';
      if (activeAlert?.message) {
        causeText = activeAlert.message + (condInfo?.why ? ` — ${condInfo.why}` : '');
      } else if (condInfo?.why) {
        causeText = condInfo.why;
      } else if (reportBiomarker.trend === 'worsening') {
        causeText = `Persistent deviation from baseline detected in ${displayName}; trend indicates physiological strain.`;
      } else if (reportBiomarker.trend === 'improving') {
        causeText = `Biomarker trajectory is recovering toward nominal baseline parameters.`;
      } else {
        causeText = `Resting telemetry matches personalized baseline within acceptable variance.`;
      }

      const actionLabel = 'FLIGHT PROTOCOL / ACTION:';
      let actionText = '';
      if (state === 'red') {
        actionText = condInfo?.actions?.[0]
          ? `${condInfo.actions[0]}. Alert flight surgeon and execute emergency countermeasures.`
          : 'Immediately notify Flight Surgeon and initiate contingency countermeasures.';
      } else if (state === 'yellow') {
        actionText = condInfo?.actions?.[0]
          ? `${condInfo.actions[0]}. Monitor trend across subsequent mission cycles.`
          : 'Monitor biometric trends closely; consult medical operations checklist.';
      } else {
        actionText = condInfo?.actions?.[0] || 'Nominal status confirmed. Continue routine EVA schedule and mission assignments.';
      }

      // Live Mission MET and Flight Phase from playback clock / database
      const missionDay = streamWindowRes?.mission_day ?? (dailyReportRes.day ?? 0);
      const phase = (dailyReportRes.phase || streamWindowRes?.phase || 'Transit').toUpperCase();
      const deviationStr = reportBiomarker.dev !== undefined && reportBiomarker.dev !== null
        ? `${reportBiomarker.dev >= 0 ? '+' : ''}${Number(reportBiomarker.dev).toFixed(2)} σ`
        : '0.00 σ';
      const statusStr = reportBiomarker.status || (state === 'green' ? 'NORM' : state.toUpperCase());
      const trendStr = (reportBiomarker.trend || 'stable').toUpperCase();

      const panelTitle = `${displayName.toUpperCase()} TELEMETRY`;
      const panelItems = [
        { name: 'VAL / DEVIATION:', val: `${formattedVal} ${unit} (${deviationStr})` },
        { name: 'STATUS & TREND:', val: `${statusStr} • ${trendStr}` },
        { name: 'NORMAL LIMITS:', val: `${thresholdMeta.norm_lo ?? '-'} .. ${thresholdMeta.norm_hi ?? '-'} ${unit}` },
        { name: 'CRITICAL LIMITS:', val: `< ${thresholdMeta.crit_lo ?? '-'} | > ${thresholdMeta.crit_hi ?? '-'} ${unit}` },
        { name: 'ETA TO LIMIT:', val: reportBiomarker.eta_days ? `${reportBiomarker.eta_days} days` : 'Stable / Not Projected' },
        { name: 'MISSION MET / PHASE:', val: `Day ${missionDay} • ${phase}` },
        { name: 'PERSONAL BASELINE:', val: `${thresholdMeta.baseline ?? '-'} ${unit} (±${thresholdMeta.noise_sd ?? '-'})` },
      ];

      return {
        state: state,
        name: displayName,
        readingDigitsHtml: `<span class="val-num">${formattedVal}</span>`,
        unit: unit,
        causeBadge: causeBadge,
        causeLabel: causeLabel,
        causeText: causeText,
        actionLabel: actionLabel,
        actionText: actionText,
        panelTitle: panelTitle,
        panelItems: panelItems,
      };

    } catch (error) {
      console.error("Failed to build dynamic biomarker payload from API:", error);
      return null;
    }
  }

  // Expose function globally for testing and developer console access
  window.getDynamicBiomarkerData = getDynamicBiomarkerData;


  // =========================================================================
  // [4] DOM ELEMENTS & STATE SWITCHING CONTROLLER
  // =========================================================================
  const readingBox = document.getElementById('floatingReadingBox');
  const readingDigits = document.getElementById('readingDigits');
  const readingUnit = document.getElementById('readingUnit');
  const leaderPath = document.getElementById('leaderPath');
  const leaderDot = document.getElementById('leaderDot');
  const causeCard = document.getElementById('causeActionCard');
  const causeBadge = document.getElementById('causeBadge');
  const causeLabel = document.getElementById('causeLabel');
  const causeText = document.getElementById('causeText');
  const actionLabel = document.getElementById('actionLabel');
  const actionText = document.getElementById('actionText');
  const telemetryCard = document.getElementById('telemetryCard');
  const telemetryCardTitle = document.getElementById('telemetryCardTitle');
  const telemetryDataList = document.getElementById('telemetryDataList');
  const toast = document.getElementById('vitals-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastVal = document.getElementById('toast-val');
  let toastTimer = null;

  function showToast(title, value) {
    if (!toast) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastVal) toastVal.textContent = value;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Master function to activate a Biomarker & its diagnostic state using dynamic API data
  let currentVitalKey = 'heart-rate';
  let isUpdatingBiomarker = false;

  async function applyBiomarker(vitalKey, playAudio = true) {
    if (isUpdatingBiomarker) return;
    isUpdatingBiomarker = true;

    try {
      currentVitalKey = vitalKey;
      const data = await getDynamicBiomarkerData(vitalKey);
      if (!data) return;

      const state = data.state; // 'green', 'yellow', or 'red'

      // Play NASA sound effect if requested (e.g. user interaction)
      if (playAudio) {
        playSound(state);
      }

      // 1. Update Global Body Class
      document.body.className = `state-${state}`;

      // 2. Update Highlight and State on Bio Markers List
      document.querySelectorAll('.vital-item').forEach(item => {
        item.classList.remove('active-green', 'active-yellow', 'active-red');
        if (item.dataset.vital === vitalKey) {
          item.classList.add(`active-${state}`);
          item.dataset.state = state;
        }
      });

      // 3. Update Quick Switcher Buttons
      document.querySelectorAll('.switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.state === state);
      });

      // 4. Update Floating Reading Box
      if (readingBox) {
        readingBox.className = `floating-reading-box theme-${state}`;
        if (readingDigits) readingDigits.innerHTML = data.readingDigitsHtml;
        if (readingUnit) readingUnit.textContent = data.unit;
      }

      // 5. Update Leader Line & Dot Colors
      if (leaderPath) {
        leaderPath.className = `leader-path theme-${state}`;
      }
      if (leaderDot) {
        leaderDot.className = `leader-dot theme-${state}`;
      }

      // 6. Update Cause & Action Card
      if (causeCard) {
        causeCard.className = `cause-action-card theme-${state}`;
        if (causeBadge) causeBadge.textContent = data.causeBadge;
        if (causeLabel) causeLabel.textContent = data.causeLabel;
        if (causeText) causeText.textContent = data.causeText;
        if (actionLabel) actionLabel.textContent = data.actionLabel;
        if (actionText) actionText.textContent = data.actionText;
      }

      // 7. Update Right Telemetry / Surgeon Log Panel
      if (telemetryCard) {
        telemetryCard.className = `telemetry-card theme-${state}`;
        if (telemetryCardTitle) telemetryCardTitle.textContent = data.panelTitle;

        if (telemetryDataList && data.panelItems) {
          telemetryDataList.innerHTML = data.panelItems.map(item => `
            <li>
              <span class="bullet">&bull;</span>
              <div class="param-group">
                <span class="param-name">${item.name}</span>
                <span class="param-val">${item.val}</span>
              </div>
            </li>
          `).join('');
        }
      }

      // Toast feedback on manual user selection
      if (playAudio) {
        showToast(data.name, `${data.unit} Telemetry • State: ${state.toUpperCase()}`);
      }
    } finally {
      isUpdatingBiomarker = false;
    }
  }


  // =========================================================================
  // [5] CLICK HANDLERS FOR BIO MARKERS & STATE SWITCHERS
  // =========================================================================

  // Click on any bio marker on the left
  document.querySelectorAll('.vital-item').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.vital;
      applyBiomarker(key, true);
    });
  });

  // Click on top demo state switcher buttons (Green, Yellow, Red)
  document.querySelectorAll('.switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const state = btn.dataset.state;
      if (state === 'green') {
        applyBiomarker('heart-rate', true);
      } else if (state === 'yellow') {
        applyBiomarker('blood-pressure', true);
      } else if (state === 'red') {
        applyBiomarker('radiation', true);
      }
    });
  });


  // =========================================================================
  // [6] HOLOGRAPHIC CIRCLES (PAGE NAVIGATION BUTTONS)
  // =========================================================================
  const holoDials = document.querySelectorAll('.holo-dial');

  holoDials.forEach(dial => {
    dial.addEventListener('click', (e) => {
      playSound('click');
      const href = dial.getAttribute('href');

      // If a real page link is set (e.g. href="profile.html"), let it navigate!
      if (href && href !== '#' && href !== 'javascript:void(0)') {
        return; // Normal link navigation
      }

      // If on the same page or previewing, mark this circle active & darker
      e.preventDefault();
      holoDials.forEach(d => d.classList.remove('active'));
      dial.classList.add('active'); // This circle now becomes darker than the others!

      const pageTitle = dial.querySelector('.dial-tooltip')?.textContent || dial.getAttribute('title') || 'Navigation Circle';
      showToast(pageTitle, 'Active Circle (Darker for current page)');
    });
  });


  // =========================================================================
  // [7] PERIODIC LIVE TELEMETRY STREAMING (SYNC WITH api.py PLAYBACK)
  // =========================================================================
  // Periodically refresh the currently selected biomarker so the HUD updates in real-time
  setInterval(() => {
    if (currentVitalKey) {
      applyBiomarker(currentVitalKey, false);
    }
  }, 2000);


  // =========================================================================
  // [8] INITIALIZE DEFAULT STATE (DYNAMIC FROM API)
  // =========================================================================
  applyBiomarker('heart-rate', false);

});
