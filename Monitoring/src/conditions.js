// Colours, plain-language explanations and suggested actions for each condition.
// non-reviewed guidance only, NOT a medical advice.

export const LEVEL_COLORS = {
  NORMAL: '#22c55e', WATCH: '#eab308', URGENT: '#f97316', CRITICAL: '#ef4444', INFO: '#38bdf8',
}
export const STATUS_COLORS = {
  NORM: '#22c55e', URGENT: '#f97316', CRITICAL: '#ef4444', FAULT: '#94a3b8',
}

// region = which part of the body map it lives on ('systemic' = whole body, shown as a button)
export const CONDITION_INFO = {
  SANS_OCULAR_RISK: {
    label: 'Spaceflight-Associated Neuro-ocular Syndrom (SANS)', region: 'head',
    why: 'In microgravity body fluids shift toward the head. The retina can thicken and vision can shift toward far-sightedness.',
    actions: ['Repeat the vision and retinal scan in 24 h', 'Use the available countermeasures as Lower Body Negative Pressure (LBNP) to shift the body fuilds down', 'Report any sudden vision loss to the earthbase immediately'],
  },
  VTE_THROMBOSIS_RISK: {
    label: 'Neck vein clot risk', region: 'neck',
    why: 'Slow or stagnant blood in the jugular vein and clot markers can mean a blood clot is forming.',
    actions: ['Repeat the neck ultrasound', 'Keep well hydrated', 'Contact the flight surgeon promptly, do not wait if there is neck pain or swelling'],
  },
  AUTONOMIC_STRESS_CARDIO: {
    label: 'Heart stress & fatigue', region: 'chest',
    why: 'Heart rate, heart-rate variability and sleep show how hard the body is working to cope with stress and fatigue.',
    actions: ['Protect 7-9 h of sleep', 'Do the scheduled aerobic exercise session', 'Try a slow-breathing exercise', 'Report chest pain or irregular heartbeat'],
  },
  METABOLIC_HYDRATION: {
    label: 'Metabolism & hydration', region: 'abdomen',
    why: 'Blood sugar, water intake, calories and body weight show whether the body is getting enough fuel and fluid.',
    actions: ['Drink at least 2 L per day', 'Review the food log against the calorie target', 'Recheck blood glucose after fasting'],
  },
  BONE_RENAL_DECONDITIONING: {
    label: 'Bone loss & kidney-stone risk', region: 'legs',
    why: 'Without gravity bones lose mineral and extra calcium ends up in the urine, raising fracture and kidney-stone risk.',
    actions: ['Do resistive exercise on the scheduled days', 'Check vitamin D and calcium intake with the flight surgeon', 'Keep hydration high'],
  },
  NUTRITION_DEFICIENCY: {
    label: 'Nutrient deficiency', region: 'arms',
    why: 'Low vitamin D, omega-3, zinc or magnesium weaken bones, muscles and the immune system.',
    actions: ['Review supplements and the menu plan', 'Log meals for the next 3 days'],
  },
  SYSTEMIC_INFLAMMATION: {
    label: 'Inflammation & infection', region: 'systemic',
    why: 'High IL-6 or TNF-alpha, fever or many microbes in the habitat suggest an infection or inflammation.',
    actions: ['Recheck body temperature in 6 h', 'Rest and drink fluids', 'Inspect air filters and surfaces for microbial growth', 'Report a fever that lasts'],
  },
  ACUTE_RADIATION_SYNDROME: {
    label: 'Radiation exposure', region: 'systemic',
    why: 'A high absorbed radiation dose and a falling lymphocyte (white blood cell) count are early signs of radiation damage.',
    actions: ['Move to the shielded area during solar events', 'Repeat the blood count', 'Inform the flight surgeon of the dose trend'],
  },
}
// accept the old spelling too
CONDITION_INFO.ACUTE_RADIATION_SYNDOME = CONDITION_INFO.ACUTE_RADIATION_SYNDROME

export const labelOf = (cond) => (CONDITION_INFO[cond] ? CONDITION_INFO[cond].label : cond)

export const LEVEL_RANK = { CRITICAL: 3, URGENT: 2, WATCH: 1, NORMAL: 0, INFO: 0 }

export const fmt = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '-'
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)
}

// status of one value against the limits row from /api/thresholds
export function statusOf(value, lim) {
  if (value === null || value === undefined || !lim) return null
  if (value < lim.crit_lo || value > lim.crit_hi) return 'CRITICAL'
  if (value >= lim.norm_lo && value <= lim.norm_hi) return 'NORM'
  return 'URGENT'
}
