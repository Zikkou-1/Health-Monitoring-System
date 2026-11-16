/**
 * ============================================================================
 * NASA V.I.T.A.L. - CREW AUTHENTICATION & LOGIN PROCESS CONTROLLER
 * ============================================================================
 * 
 * Flow:
 *  Step 1: Crew Profile Selection (Ouissal, Hibib, Ishak., Abdellah, Hiba)
 *  Step 2: Welcome / Action Screen (Swipe right for note / Swipe left for login)
 *  Step 3: Password Authentication Screen -> Redirects to nasa.html
 * 
 * Features:
 *  - Procedural Starfield Canvas
 *  - Web Audio sci-fi sound effects
 *  - Touch swipe gestures & click interactions
 *  - Mission Note modal with localStorage persistence
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // =========================================================================
  // [1] PROCEDURAL STARFIELD CANVAS
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
  // [2] WEB AUDIO SYNTHESIZER
  // =========================================================================
  let audioCtx = null;

  function playUiTone(type = 'select') {
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
        // High-tech profile select tone
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(960, now);
        osc.frequency.exponentialRampToValueAtTime(1440, now + 0.07);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        osc.start(now);
        osc.stop(now + 0.07);

      } else if (type === 'swipe') {
        // Sci-Fi transition swoosh
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.12);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);

      } else if (type === 'access-granted') {
        // Authentic NASA authorization sequence
        [660, 880, 1320].forEach((freq, idx) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.type = 'sine';
          const t = now + (idx * 0.09);
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.045, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
        });

      } else if (type === 'error') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {}
  }


  // =========================================================================
  // [3] TOAST NOTIFICATIONS
  // =========================================================================
  const toast = document.getElementById('vitals-toast');
  const toastTitle = document.getElementById('toast-title');
  const toastVal = document.getElementById('toast-val');
  let toastTimeout = null;

  function showToast(title, val) {
    if (!toast) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastVal) toastVal.textContent = val;
    toast.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), 2800);
  }


  // =========================================================================
  // [4] STEP NAVIGATION STATE MACHINE
  // =========================================================================
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const step3 = document.getElementById('step-3');

  let currentCrew = {
    key: 'hiba',
    name: 'Hiba',
    photo: 'Health app (4).png'
  };

  function setStep(stepNum) {
    playUiTone('swipe');

    [step1, step2, step3].forEach(step => {
      if (step) step.classList.remove('step-active');
    });

    if (stepNum === 1 && step1) {
      step1.classList.add('step-active');
    } else if (stepNum === 2 && step2) {
      step2.classList.add('step-active');
    } else if (stepNum === 3 && step3) {
      step3.classList.add('step-active');
      const passField = document.getElementById('passwordInput');
      if (passField) {
        setTimeout(() => passField.focus(), 300);
      }
    }
  }

  function applySelectedCrew(crewData) {
    currentCrew = crewData;
    localStorage.setItem('nasa_active_crew', JSON.stringify(crewData));

    // Update Step 2 Elements
    const step2Name = document.getElementById('step2-name');
    const step2Avatar = document.getElementById('step2-avatar');
    if (step2Name) step2Name.textContent = crewData.name;
    if (step2Avatar) step2Avatar.src = crewData.photo;

    // Update Step 3 Elements
    const step3Greeting = document.getElementById('step3-greeting');
    const step3Avatar = document.getElementById('step3-avatar');
    if (step3Greeting) step3Greeting.textContent = `Hello, ${crewData.name}.`;
    if (step3Avatar) step3Avatar.src = crewData.photo;

    // Update Note Modal
    const noteTarget = document.getElementById('noteTargetName');
    if (noteTarget) noteTarget.textContent = crewData.name;
  }


  // =========================================================================
  // [5] STEP 1: CREW PROFILE SELECTION
  // =========================================================================
  const crewCards = document.querySelectorAll('.crew-card');
  crewCards.forEach(card => {
    card.addEventListener('click', () => {
      playUiTone('select');

      const key = card.getAttribute('data-crew') || 'hiba';
      const name = card.getAttribute('data-name') || 'Hiba';
      const photo = card.getAttribute('data-photo') || 'Health app (4).png';

      applySelectedCrew({ key, name, photo });
      showToast('Profile Selected', name);

      // Transition to Step 2
      setStep(2);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });


  // =========================================================================
  // [6] STEP 2: ACTION WINGS (LEAVE NOTE & PROCEED TO LOGIN)
  // =========================================================================
  const actionLeaveNote = document.getElementById('actionLeaveNote');
  const actionProceedLogin = document.getElementById('actionProceedLogin');
  const btnBackToProfiles = document.getElementById('btnBackToProfiles');

  // Swipe Left -> Proceed to Login
  if (actionProceedLogin) {
    actionProceedLogin.addEventListener('click', () => {
      setStep(3);
    });
  }

  // Swipe Right -> Open Note Modal
  const noteModal = document.getElementById('noteModal');
  const btnCloseNoteModal = document.getElementById('btnCloseNoteModal');
  const btnCancelNote = document.getElementById('btnCancelNote');
  const btnSaveNote = document.getElementById('btnSaveNote');
  const noteInput = document.getElementById('noteInput');

  function openNoteModal() {
    playUiTone('select');
    if (noteModal) {
      noteModal.classList.add('modal-open');
      noteModal.setAttribute('aria-hidden', 'false');
      if (noteInput) {
        // Load existing saved note for this crew member if any
        const saved = localStorage.getItem(`nasa_note_${currentCrew.key}`);
        noteInput.value = saved || '';
        setTimeout(() => noteInput.focus(), 250);
      }
    }
  }

  function closeNoteModal() {
    playUiTone('select');
    if (noteModal) {
      noteModal.classList.remove('modal-open');
      noteModal.setAttribute('aria-hidden', 'true');
    }
  }

  if (actionLeaveNote) {
    actionLeaveNote.addEventListener('click', openNoteModal);
  }
  if (btnCloseNoteModal) btnCloseNoteModal.addEventListener('click', closeNoteModal);
  if (btnCancelNote) btnCancelNote.addEventListener('click', closeNoteModal);

  if (btnSaveNote) {
    btnSaveNote.addEventListener('click', () => {
      const text = noteInput ? noteInput.value.trim() : '';
      if (text) {
        localStorage.setItem(`nasa_note_${currentCrew.key}`, text);
        showToast('Mission Note Saved', `Logged for ${currentCrew.name}`);
      }
      closeNoteModal();
    });
  }

  // Return to Profile Selection
  if (btnBackToProfiles) {
    btnBackToProfiles.addEventListener('click', () => {
      setStep(1);
    });
  }


  // =========================================================================
  // [7] SWIPE GESTURE SUPPORT (MOBILE & DESKTOP DRAG)
  // =========================================================================
  let touchStartX = 0;
  let touchEndX = 0;

  const step2Stage = document.getElementById('step-2');
  if (step2Stage) {
    step2Stage.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    step2Stage.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleStep2Swipe();
    }, { passive: true });
  }

  function handleStep2Swipe() {
    const diff = touchEndX - touchStartX;
    const SWIPE_THRESHOLD = 50;

    // Swiped right -> Leave note
    if (diff > SWIPE_THRESHOLD) {
      openNoteModal();
    }
    // Swiped left -> Proceed to login
    else if (diff < -SWIPE_THRESHOLD) {
      setStep(3);
    }
  }


  // =========================================================================
  // [8] STEP 3: PASSWORD AUTHENTICATION & LOGIN
  // =========================================================================
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('passwordInput');
  const lockSubmitBtn = document.getElementById('lockSubmitBtn');
  const authStatusMsg = document.getElementById('authStatusMsg');
  const statusText = document.getElementById('statusText');
  const btnBackToStep2 = document.getElementById('btnBackToStep2');

  function handleAuthentication() {
    const entered = passwordInput ? passwordInput.value : '';

    // Play access granted sound
    playUiTone('access-granted');

    if (authStatusMsg && statusText) {
      authStatusMsg.className = 'auth-status-message success';
      statusText.textContent = `ACCESS GRANTED // INITIALIZING HUD TELEMETRY FOR ${currentCrew.name.toUpperCase()}...`;
    }

    if (lockSubmitBtn) {
      lockSubmitBtn.style.borderColor = '#00ff88';
      lockSubmitBtn.style.color = '#00ff88';
      lockSubmitBtn.style.boxShadow = '0 0 25px #00ff88';
    }

    // Save login session
    localStorage.setItem('nasa_logged_in', 'true');
    localStorage.setItem('nasa_active_crew', JSON.stringify(currentCrew));

    showToast('Access Authorized', 'Loading Biotelemetry HUD...');

    // Redirect to main HUD screen (nasa.html)
    setTimeout(() => {
      window.location.href = 'nasa.html';
    }, 700);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleAuthentication();
    });
  }

  if (lockSubmitBtn) {
    lockSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleAuthentication();
    });
  }

  // Back to Step 2
  if (btnBackToStep2) {
    btnBackToStep2.addEventListener('click', () => {
      setStep(2);
    });
  }

  // Set default initial crew (Hiba)
  applySelectedCrew({
    key: 'hiba',
    name: 'Hiba',
    photo: 'Health app (4).png'
  });

});
