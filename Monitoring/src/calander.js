/**
 * ============================================================================
 * NASA EVA BIOTELEMETRY HUD - MISSION CALENDAR & HISTORY LOG CONTROLLER
 * ============================================================================
 * 
 * Features:
 *  1. Procedural Starfield & Twinkle Simulation (Canvas API)
 *  2. Synthesized Web Audio UI sound effects (Sci-Fi chimes & telemetry clicks)
 *  3. Interactive Calendar Day Grid with dynamic log detail updates:
 *     - Day 15 (Active baseline from photo): Eye drops, vitals, decongestant
 *     - Dynamic mission logs for all days (Rover, Cargo, EVA, Robotics, Workout)
 *     - Dynamic Week indicator badge update (Week 1 through Week 5)
 *  4. Telemetry Toast Notification system
 *  5. 4 Holographic Navigation Circles linking seamlessly across all 4 HUD pages
 * 
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // [SECTION 1]: PROCEDURAL STARFIELD CANVAS
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
  // [SECTION 2]: WEB AUDIO SYNTHESIZER (HOLOGRAPHIC SOUND EFFECTS)
  // =========================================================================
  let audioCtx = null;

  function playUiSound(type = 'select') {
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

      if (type === 'select') {
        // High-tech crisp frequency blip
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.07);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);

      } else if (type === 'active-chime') {
        // Multi-tone calendar active select chime
        [1046, 1318].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'triangle';
          const t = now + (idx * 0.06);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.035, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          osc.start(t);
          osc.stop(t + 0.06);
        });

      } else if (type === 'nav') {
        // Navigation dial pulse
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }


  // =========================================================================
  // [SECTION 3]: TELEMETRY TOAST NOTIFICATIONS
  // =========================================================================
  const toast = document.getElementById('vitals-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastVal = document.getElementById('toast-val');
  let toastTimeout = null;

  function showToast(title, val) {
    if (!toast || !toastTitle || !toastVal) return;
    toastTitle.textContent = title;
    toastVal.textContent = val;
    toast.classList.add('visible');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2800);
  }


  // =========================================================================
  // [SECTION 4]: MISSION CALENDAR LOG DATABASE (ALL DAYS OF NOVEMBER 2026)
  // =========================================================================
  const calendarLogs = {
    // Week 1
    '31': {
      month: 'OCT',
      year: '2026',
      week: 'Week 1',
      title: 'OCT 31ST 2026',
      activity: 'Pre-Month Orbital Check',
      entries: [
        { time: '07:00', text: 'Pre-flight equipment audit and EMU biosensor harness calibration completed.' },
        { time: '11:30', text: 'Hydration index recorded at nominal 98.4%. Cabin air loop filter verified.' },
        { time: '18:00', text: 'End-of-month mission telemetry log synchronized with MCC-Houston.' }
      ]
    },
    '1': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 1ST 2026',
      activity: 'Planetary Rover Test',
      entries: [
        { time: '07:15', text: 'Telemetry sync with Surface Exploration Rover unit #4 established.' },
        { time: '09:30', text: 'Drive chassis diagnostic and lidar array calibration complete: Nominal.' },
        { time: '14:00', text: 'Rock sample retrieval automated tele-operation test run: PASS (Zero slip).' }
      ]
    },
    '2': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 2ND 2026',
      activity: 'Cargo Supply Unpack',
      entries: [
        { time: '08:00', text: 'HTV-X Cargo vehicle ingress and pressure equalization successful.' },
        { time: '11:45', text: 'Transferred 120kg scientific consumables to Destiny laboratory storage.' },
        { time: '16:30', text: 'Manifest updated: Fresh food packs and medical refills inventoried.' }
      ]
    },
    '3': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 3RD 2026',
      activity: 'Mission Checklist & Audit',
      entries: [
        { time: '06:30', text: 'Daily orbital manifest review with Flight Director (CapCom).' },
        { time: '10:00', text: 'ECLSS trace contaminant cartridge life inspection: nominal 88% remaining.' },
        { time: '15:00', text: 'Crew medical conference and sleep architecture log review with flight surgeon.' }
      ]
    },
    '4': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 4TH 2026',
      activity: 'Robotic Arm Maneuver',
      entries: [
        { time: '09:00', text: 'SSRMS Canadarm2 joint drive mobility check: Pitch, yaw, and roll calibrated.' },
        { time: '13:15', text: 'External payload berth relocation maneuver successful from Node 2 to Express Rack.' },
        { time: '17:00', text: 'High-definition camera cluster visual inspection and wrist latch lock confirmed.' }
      ]
    },
    '5': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 5TH 2026',
      activity: 'EVA Workout Protocol',
      entries: [
        { time: '07:00', text: 'T2 Treadmill interval protocol completed: 45 min interval sprint at 1g harness load.' },
        { time: '11:30', text: 'ARED resistive strength cycle: Squats & heel raises (180 lbs resistance).' },
        { time: '16:00', text: 'Post-exercise lactate & hydration monitoring recorded: Recovery rate nominal.' }
      ]
    },
    '6': {
      month: 'NOV',
      year: '2026',
      week: 'Week 1',
      title: 'NOV 6TH 2026',
      activity: 'Ultrasound Medical Check',
      entries: [
        { time: '08:15', text: 'Trans-thoracic echocardiogram & vascular flow Doppler scan performed.' },
        { time: '12:00', text: 'Optic nerve sheath diameter (ONSD) ultrasound check: 5.8mm recorded.' },
        { time: '15:45', text: 'Internal Jugular Vein (IJV) Doppler cross-sectional assessment transmitted to MCC.' }
      ]
    },

    // Week 2
    '7': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 7TH 2026',
      activity: 'Hardware Maintenance',
      entries: [
        { time: '07:45', text: 'Node 3 Carbon Dioxide Removal Assembly (CDRA) filter replacement completed.' },
        { time: '11:30', text: 'Oxygen Generation System (OGS) cell stack voltage verified: 28.2 V nominal.' },
        { time: '16:00', text: 'Torque verification on airlock hatch seal latches: All within spec.' }
      ]
    },
    '8': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 8TH 2026',
      activity: 'Cabin Sanitation',
      entries: [
        { time: '08:30', text: 'Deep clean of crew sleep quarters and antimicrobial wipe-down.' },
        { time: '13:00', text: 'HEPA vacuuming of exhaust grilles and air circulation return ducts.' },
        { time: '17:15', text: 'Microbial swab test plates incubated for ground telemetry analysis.' }
      ]
    },
    '9': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 9TH 2026',
      activity: 'EVA Conditioning Workout',
      entries: [
        { time: '07:00', text: 'CEVIS Cycle ergometer cardiovascular endurance training: 60 mins continuous.' },
        { time: '12:00', text: 'ARED deadlift and bench press protocol: Target power output reached.' },
        { time: '15:30', text: 'Sweat loss electrolyte replacement drink logged: 750 mL intake.' }
      ]
    },
    '10': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 10TH 2026',
      activity: 'Microscopy Research',
      entries: [
        { time: '08:45', text: 'Advanced Plant Habitat Arabidopsis seedling harvest in glovebox.' },
        { time: '11:30', text: 'Fluorescence confocal microscopy imaging of cellular wall gravitational stress.' },
        { time: '16:00', text: 'Cryogenic sample preservation at -80°C in MELFI-3 freezer unit.' }
      ]
    },
    '11': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 11TH 2026',
      activity: 'Telemetry Log Review',
      entries: [
        { time: '07:30', text: 'Mid-expedition structural integrity and micro-meteoroid sensor audit.' },
        { time: '11:00', text: 'Radiation dosimeter RAD-ISS-074B weekly readouts transmitted: Nominal curve.' },
        { time: '15:00', text: 'Columbus European module payload rack safety checks verified.' }
      ]
    },
    '12': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 12TH 2026',
      activity: 'Orbital Routine Day',
      entries: [
        { time: '08:00', text: 'Routine morning medical telemetry stream verified with MCC flight doctor.' },
        { time: '12:30', text: 'Fluid physics experiment rack observations: Bubble dynamics recorded.' },
        { time: '17:00', text: 'Recreation & private family conference link active on Ka-band.' }
      ]
    },
    '13': {
      month: 'NOV',
      year: '2026',
      week: 'Week 2',
      title: 'NOV 13TH 2026',
      activity: 'Systems Check Day',
      entries: [
        { time: '08:30', text: 'Station attitude control momentum dump using reaction wheels completed.' },
        { time: '13:00', text: 'Thermal control loop ammonia pressure sensor diagnostic: Optimal.' },
        { time: '16:30', text: 'Emergency depressurization and fire suppression checklist drill.' }
      ]
    },

    // Week 3 (EXACT SCREENSHOT BASELINE)
    '14': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 14TH 2026',
      activity: 'Cabin Sanitation',
      entries: [
        { time: '09:00', text: 'Waste & Hygiene Compartment (WHC) consumable changeout and flush.' },
        { time: '13:30', text: 'Potable water dispensing manifold sanitation flush with silver biocide.' },
        { time: '16:45', text: 'Microbial surface check of galley food preparation station.' }
      ]
    },
    '15': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 15TH 2026',
      activity: 'EVA Workout & Baseline Check',
      entries: [
        { time: '06:00', text: 'Logged: 1 dose of lubricating eye drops used immediately upon waking to relieve dryness from cabin air circulation.' },
        { time: '07:30', text: 'Morning vital signs checked. Resting heart rate and blood pressure match the astronaut\'s in-flight supine baseline.' },
        { time: '08:00', text: 'Logged: 1 dose of Pseudoephedrine (nasal decongestant) taken to clear blocked sinuses before performing detailed microscopy work.' }
      ]
    },
    '16': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 16TH 2026',
      activity: 'Hardware Maintenance',
      entries: [
        { time: '08:00', text: 'Ku-band high-gain antenna gimbal lubricating and drift check.' },
        { time: '11:45', text: 'Battery Charge/Discharge Unit (BCDU) telemetry calibration: 99.1% efficiency.' },
        { time: '15:30', text: 'Japanese Experiment Module (Kibo) airlock outer slide table lubricated.' }
      ]
    },
    '17': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 17TH 2026',
      activity: 'Robotic Arm Truss Ops',
      entries: [
        { time: '09:15', text: 'Dextre Special Purpose Dexterous Manipulator tool checkout complete.' },
        { time: '13:00', text: 'Replacement of external electronics box (ORU) on S0 truss simulated.' },
        { time: '16:30', text: 'High-resolution stereoscopic imagery transmitted to MCC-Houston.' }
      ]
    },
    '18': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 18TH 2026',
      activity: 'Guidance Software Patch',
      entries: [
        { time: '08:15', text: 'Primary Flight Control Software build 42.1 telemetry deployment.' },
        { time: '11:45', text: 'Guidance, Navigation & Control (GNC) thruster loop verification.' },
        { time: '15:30', text: 'Firewall packet audit on payload Ethernet router: Zero anomalies.' }
      ]
    },
    '19': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 19TH 2026',
      activity: 'Aerobic Conditioning',
      entries: [
        { time: '07:15', text: 'ARED high-intensity resistance training (HIRT) routine completed.' },
        { time: '11:00', text: 'Supine lower body negative pressure (LBNP) cardiovascular test.' },
        { time: '16:00', text: 'Core body temperature recovery curve plotted in biotelemetry log.' }
      ]
    },
    '20': {
      month: 'NOV',
      year: '2026',
      week: 'Week 3',
      title: 'NOV 20TH 2026',
      activity: 'Pre-EVA Briefing Log',
      entries: [
        { time: '08:00', text: 'Detailed EVA suit sizing and EMU bio-sensor harness fitting check.' },
        { time: '11:30', text: 'Pre-spacewalk timeline and hazard contingency protocol briefing with EVA director.' },
        { time: '16:00', text: 'Primary life support system (PLSS) LiOH canister install and pressure check.' }
      ]
    },

    // Week 4
    '20b': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 20TH 2026 (Part II)',
      activity: 'Equipment Staging',
      entries: [
        { time: '18:00', text: 'Airlock tool bag tether inventory and safety lanyard tension test: 100% PASS.' },
        { time: '20:30', text: 'Crew hydration regimen prep: 1.2L isotonic solution consumed.' }
      ]
    },
    '21': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 21ST 2026',
      activity: 'Airlock Sanitation & Prep',
      entries: [
        { time: '08:30', text: 'Quest airlock hyperbaric decompression chamber preparation.' },
        { time: '12:00', text: 'Tool tether check, pistol grip tool torque limiters zeroed.' },
        { time: '16:15', text: 'EVA umbilical leak check: 0.00 psi/min drop over 20 min.' }
      ]
    },
    '22': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 22ND 2026',
      activity: 'Spacewalk EVA Ingress',
      entries: [
        { time: '06:00', text: 'Pre-breathe protocol started: 100% O2 mask on for nitrogen desaturation.' },
        { time: '07:45', text: 'Quest airlock outer hatch open: EVA egress initiated. Astronaut in vacuum.' },
        { time: '14:15', text: 'EVA ingress complete: Duration 6h 30m. Solar array bolt secured; all tasks done.' }
      ]
    },
    '23': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 23RD 2026',
      activity: 'Hardware Maintenance',
      entries: [
        { time: '08:45', text: 'Post-EVA suit scrub, water cooling loop biocide recharge and flush.' },
        { time: '12:30', text: 'EMU glove and helmet visor micrometeoroid impact scan: Zero pinholes.' },
        { time: '16:00', text: 'Recharge of EMU secondary oxygen pack (SOP) bottles to 240 bar.' }
      ]
    },
    '24': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 24TH 2026',
      activity: 'Post-EVA Recovery Day',
      entries: [
        { time: '08:00', text: 'Post-spacewalk physical assessment: No joint bends or decompression symptoms.' },
        { time: '13:00', text: 'Muscle soreness index: Low. Hydration and caloric intake boosted.' },
        { time: '17:00', text: 'Ground debriefing with EVA ground flight control team.' }
      ]
    },
    '25': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 25TH 2026',
      activity: 'Post-EVA Science Review',
      entries: [
        { time: '09:00', text: 'Scientific data transmission backhaul to Goddard Space Flight Center.' },
        { time: '13:15', text: 'Microgravity protein crystal growth cassette swap in Kibo facility.' },
        { time: '17:00', text: 'Evening crew sync: Flight surgeon debriefing on radiation dose.' }
      ]
    },
    '26': {
      month: 'NOV',
      year: '2026',
      week: 'Week 4',
      title: 'NOV 26TH 2026',
      activity: 'Station Operations Day',
      entries: [
        { time: '08:30', text: 'Atmospheric pressure monitor recalibrated to 14.7 psi sea-level standard.' },
        { time: '12:00', text: 'Nitrogen recharge from Progress cargo resupply craft manifold.' },
        { time: '16:30', text: 'Ham radio outreach pass with educational school group on ground.' }
      ]
    },

    // Week 5
    '27': {
      month: 'NOV',
      year: '2026',
      week: 'Week 5',
      title: 'NOV 27TH 2026',
      activity: 'Waste Management Service',
      entries: [
        { time: '08:00', text: 'Cabin air scrubber zeolite bed thermal regeneration cycle completed.' },
        { time: '12:00', text: 'Deep cleaning of hygiene stall and air distribution diffusers.' },
        { time: '16:30', text: 'Waste containment transfer to uncrewed disposal craft.' }
      ]
    },
    '28': {
      month: 'NOV',
      year: '2026',
      week: 'Week 5',
      title: 'NOV 28TH 2026',
      activity: 'Water Loop Flush',
      entries: [
        { time: '08:30', text: 'Urine Processing Assembly (UPA) distillation centrifuge service.' },
        { time: '11:45', text: 'Replaced peristaltic brine tubing and rotary separator filter.' },
        { time: '16:00', text: 'Water recovery efficiency restored back to nominal 98.2%.' }
      ]
    },
    '29': {
      month: 'NOV',
      year: '2026',
      week: 'Week 5',
      title: 'NOV 29TH 2026',
      activity: 'Ground Comms Conference',
      entries: [
        { time: '09:30', text: 'Public affairs high-definition live uplink to NASA HQ.' },
        { time: '14:00', text: 'Family two-way private videoconference via TDRS satellite constellation.' },
        { time: '17:00', text: 'Mission Specialist science review with university principal investigators.' }
      ]
    },
    '30': {
      month: 'NOV',
      year: '2026',
      week: 'Week 5',
      title: 'NOV 30TH 2026',
      activity: 'Monthly Health Baseline',
      entries: [
        { time: '08:00', text: 'Monthly health baseline consolidation and bio-trend report compiled.' },
        { time: '12:30', text: 'Radiation cumulative dose total: 699 mSv logged for medical archives.' },
        { time: '17:00', text: 'Inventory audit for upcoming month resupply mission.' }
      ]
    },
    'Dec1': {
      month: 'DEC',
      year: '2026',
      week: 'Week 5',
      title: 'DEC 1ST 2026',
      activity: 'New Month Orbit Transition',
      entries: [
        { time: '08:00', text: 'December flight schedule unlocked. Solar array beta angle adjustment.' },
        { time: '12:00', text: 'Expedition 74 secondary mission milestone review.' }
      ]
    },
    'Dec2': {
      month: 'DEC',
      year: '2026',
      week: 'Week 5',
      title: 'DEC 2ND 2026',
      activity: 'Rover Surface Link',
      entries: [
        { time: '09:00', text: 'Surface Rover battery telemetry recharge via solar array array.' }
      ]
    },
    'Dec3': {
      month: 'DEC',
      year: '2026',
      week: 'Week 5',
      title: 'DEC 3RD 2026',
      activity: 'Cargo Manifest Close',
      entries: [
        { time: '10:00', text: 'Cargo container packing checklist completed for uncrewed return.' }
      ]
    }
  };


  // =========================================================================
  // [SECTION 5]: INTERACTIVE CALENDAR CELL SELECTION & LOG UPDATES
  // =========================================================================
  const dayCells = document.querySelectorAll('.cal-day-cell');
  const logDateTitle = document.getElementById('logDateTitle');
  const logEntriesStack = document.getElementById('logEntriesStack');
  const weekBadge = document.getElementById('weekBadge');

  function renderDayLog(dayKey) {
    let data = calendarLogs[dayKey];

    // Fallback if key not in dictionary
    if (!data) {
      const cleanDay = dayKey.replace(/[^\d]/g, '');
      data = {
        title: `NOV ${cleanDay || dayKey} 2026`,
        week: 'Week 3',
        activity: 'Nominal Orbital Operations',
        entries: [
          { time: '08:00', text: `Routine morning vital telemetry stream verified for Day ${cleanDay || dayKey}.` },
          { time: '13:00', text: 'Payload maintenance and orbital life support monitoring nominal.' },
          { time: '17:30', text: 'Daily crew health telemetry synchronized with MCC-Houston.' }
        ]
      };
    }

    // 1. Update Title with clean superscript
    if (logDateTitle) {
      const parts = data.title.split(' ');
      if (parts.length >= 3) {
        const month = parts[0];
        const dayStr = parts[1];
        const year = parts[2];
        const dayDigits = dayStr.replace(/[^\d]/g, '');
        const suffix = dayStr.replace(/[\d]/g, '');
        logDateTitle.innerHTML = `${month} ${dayDigits}<sup>${suffix}</sup> ${year}`;
      } else {
        logDateTitle.textContent = data.title;
      }
    }

    // 2. Update Week Indicator Badge
    if (weekBadge && data.week) {
      const weekTitleEl = weekBadge.querySelector('.week-title');
      if (weekTitleEl) {
        weekTitleEl.textContent = data.week;
      }
    }

    // 3. Render Log Entries Stack
    if (logEntriesStack) {
      logEntriesStack.innerHTML = '';
      data.entries.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'log-entry-item';
        entryDiv.innerHTML = `
          <p class="log-text">
            <strong class="log-time">${entry.time} &bull;</strong> ${entry.text}
          </p>
        `;
        logEntriesStack.appendChild(entryDiv);
      });
    }

    // 4. Show Toast Notification
    showToast(data.title, data.activity || 'Activity Selected');
  }

  // Bind click listener to each calendar cell
  dayCells.forEach(cell => {
    cell.addEventListener('click', () => {
      // Audio feedback
      playUiSound('select');

      // Toggle active class
      dayCells.forEach(c => c.classList.remove('active-day'));
      cell.classList.add('active-day');

      // Resolve key
      const isDimmed = cell.classList.contains('dimmed');
      const monthAttr = cell.getAttribute('data-month');
      const dayAttr = cell.getAttribute('data-day') || cell.querySelector('.day-num')?.textContent?.trim();

      let key = dayAttr;
      if (isDimmed && monthAttr === 'Dec') {
        key = `Dec${dayAttr}`;
      }

      renderDayLog(key);
    });
  });


  // =========================================================================
  // [SECTION 6]: HOLOGRAPHIC NAVIGATION CIRCLES
  // =========================================================================
  const dials = document.querySelectorAll('.holo-dial');
  dials.forEach(dial => {
    dial.addEventListener('click', (e) => {
      playUiSound('nav');

      // Dial 4 is the current Calendar page
      if (dial.id === 'dial-4' || dial.classList.contains('dial-4')) {
        e.preventDefault();
        showToast('MISSION CALENDAR', 'Currently Active Page');
      }
    });

    dial.addEventListener('mouseenter', () => {
      // Subtle pulse on hover
      if (!dial.classList.contains('active')) {
        dial.style.filter = 'drop-shadow(0 0 14px #00e5ff)';
      }
    });

    dial.addEventListener('mouseleave', () => {
      if (!dial.classList.contains('active')) {
        dial.style.filter = '';
      }
    });
  });

});
