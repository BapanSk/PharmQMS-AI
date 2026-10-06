const db = require('../config/db');
const { CATEGORIES, SEVERITIES, PRIORITIES } = require('../utils/constants');

const CRITICAL_WORDS = [
  'side effect',
  'adverse',
  'reaction',
  'patient',
  'hospital',
  'anaphyla',
  'breathing',
  'wheez',
  'contaminated',
  'wrong medicine',
  'wrong drug',
  'overdose'
];

const MAJOR_WORDS = [
  'broken',
  'damaged',
  'crack',
  'leak',
  'missing',
  'particulate',
  'discolor',
  'odour',
  'odor',
  'seal',
  'temperature',
  'excursion'
];

const PACKAGING_WORDS = ['packaging', 'pack', 'box', 'carton', 'bottle', 'cap', 'blister', 'seal'];
const LABEL_WORDS = ['label', 'labelling', 'labeling', 'leaflet', 'artwork', 'strength mismatch'];
const QUALITY_WORDS = ['quality', 'tablet', 'capsule', 'powder', 'particle', 'color', 'colour', 'taste'];
const DIST_WORDS = ['shipment', 'temperature', 'cold chain', 'delivery', 'warehouse'];
const MFG_WORDS = ['manufactur', 'batch variation', 'process'];
const MINOR_WORDS = ['minor', 'small', 'slight', 'cosmetic', 'hard to open'];

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function clampCategory(value, fallback) {
  return CATEGORIES.includes(value) ? value : fallback;
}

function clampSeverity(value, fallback) {
  return SEVERITIES.includes(value) ? value : fallback;
}

function clampPriority(value, fallback) {
  return PRIORITIES.includes(value) ? value : fallback;
}

function fallbackAnalyze(complaint) {
  const text = `${complaint.category || ''} ${complaint.description || ''}`.toLowerCase();
  let category = complaint.category || 'Other';
  let severity = 'Minor';
  let priority = 'Low';

  if (containsAny(text, LABEL_WORDS)) category = 'Labeling';
  else if (containsAny(text, PACKAGING_WORDS)) category = 'Packaging';
  else if (containsAny(text, DIST_WORDS)) category = 'Distribution';
  else if (containsAny(text, MFG_WORDS)) category = 'Manufacturing';
  else if (containsAny(text, QUALITY_WORDS)) category = 'Product Quality';

  if (containsAny(text, CRITICAL_WORDS)) {
    severity = 'Critical';
    priority = 'High';
    if (containsAny(text, ['side effect', 'adverse', 'reaction', 'patient', 'hospital', 'anaphyla'])) {
      category = 'Adverse Event';
    }
  } else if (containsAny(text, MAJOR_WORDS)) {
    severity = 'Major';
    priority = 'High';
  } else if (containsAny(text, MINOR_WORDS)) {
    severity = 'Minor';
    priority = 'Low';
  } else {
    severity = 'Minor';
    priority = 'Medium';
  }

  const summary = `Rule-based review of ${complaint.product_name || 'the product'} batch ${complaint.batch_number || 'unknown'}: ${String(complaint.description || '').slice(0, 180)}`;
  const suspected = containsAny(text, CRITICAL_WORDS)
    ? 'Possible product quality or safety issue requiring immediate QA review.'
    : containsAny(text, PACKAGING_WORDS.concat(LABEL_WORDS))
      ? 'Possible packaging or labeling control failure.'
      : 'Reported product complaint requiring standard QA triage.';
  const impact = severity === 'Critical'
    ? 'Potential patient safety impact. Escalate according to pharmacovigilance procedure.'
    : severity === 'Major'
      ? 'Possible delayed or incorrect use. Quarantine remaining units if available.'
      : 'Limited likely patient impact. Investigate remaining stock and supplier records.';
  const action = severity === 'Critical'
    ? 'Preserve remaining product, notify QA manager, and open investigation immediately.'
    : 'Confirm batch genealogy, inspect retains, and assign a QA analyst.';

  return {
    product_name: complaint.product_name || null,
    batch_number: complaint.batch_number || null,
    category,
    severity,
    priority,
    summary,
    suspected_issue: suspected,
    patient_impact: impact,
    recommended_action: action,
    confidence_score: severity === 'Critical' ? 78 : 64,
    source: 'fallback',
    model_name: 'rule-based-fallback'
  };
}

function extractJson(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

async function callAiApi(complaint) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl = (process.env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'You are a pharmaceutical QA triage assistant. Return JSON only. Recommendations are not final QA decisions.'
          },
          {
            role: 'user',
            content: `Analyze this fictional pharmaceutical complaint and return JSON with keys: category, severity, priority, summary, suspected_issue, patient_impact, recommended_action, confidence_score (0-100).
Category must be one of: ${CATEGORIES.join(', ')}.
Severity must be one of: ${SEVERITIES.join(', ')}.
Priority must be one of: ${PRIORITIES.join(', ')}.
Product: ${complaint.product_name}
Batch: ${complaint.batch_number}
Customer category: ${complaint.category}
Description: ${complaint.description}`
          }
        ]
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
      ? payload.choices[0].message.content
      : null;
    const parsed = extractJson(content);
    if (!parsed) {
      return null;
    }

    return {
      product_name: complaint.product_name || null,
      batch_number: complaint.batch_number || null,
      category: clampCategory(parsed.category, complaint.category),
      severity: clampSeverity(parsed.severity, 'Major'),
      priority: clampPriority(parsed.priority, 'Medium'),
      summary: String(parsed.summary || '').slice(0, 2000),
      suspected_issue: String(parsed.suspected_issue || '').slice(0, 2000),
      patient_impact: String(parsed.patient_impact || '').slice(0, 2000),
      recommended_action: String(parsed.recommended_action || parsed.recommendedAction || '').slice(0, 2000),
      confidence_score: Math.max(0, Math.min(100, Number(parsed.confidence_score) || 70)),
      source: 'ai',
      model_name: model,
      raw_response: payload
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function analyzeComplaint(complaint) {
  const ai = await callAiApi(complaint);
  return ai || fallbackAnalyze(complaint);
}

function toPublicAnalysis(row) {
  if (!row) return null;
  let raw = row.raw_response;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (error) { raw = null; }
  }
  const details = raw && raw.pharmqms ? raw.pharmqms : {};
  return {
    id: row.id,
    product_name: details.product_name || null,
    batch_number: details.batch_number || null,
    category: row.suggested_category,
    severity: row.suggested_severity,
    priority: row.suggested_priority,
    summary: row.summary,
    suspected_issue: details.suspected_issue || null,
    patient_impact: details.patient_impact || null,
    recommended_action: row.recommendations,
    confidence_score: row.risk_score == null ? null : Number(row.risk_score),
    source: row.model_name === 'rule-based-fallback' ? 'fallback' : (details.source || 'ai'),
    model_name: row.model_name,
    qa_decision: details.qa_decision || 'pending',
    reviewed_by: details.reviewed_by || null,
    reviewed_at: details.reviewed_at || null,
    created_at: row.created_at,
    disclaimer: (details.source || (row.model_name === 'rule-based-fallback' ? 'fallback' : 'ai')) === 'fallback'
      ? 'Rule-based analysis — AI service unavailable'
      : 'AI Generated — Requires QA Review'
  };
}

async function saveAnalysis(complaintPk, analysis) {
  const raw = {
    pharmqms: {
      product_name: analysis.product_name,
      batch_number: analysis.batch_number,
      suspected_issue: analysis.suspected_issue,
      patient_impact: analysis.patient_impact,
      source: analysis.source,
      qa_decision: 'pending',
      reviewed_by: null,
      reviewed_at: null
    }
  };

  const result = await db.query(
    `INSERT INTO complaint_ai_analysis (
       complaint_pk, summary, suggested_severity, suggested_priority, suggested_category,
       risk_score, recommendations, model_name, raw_response
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      complaintPk,
      analysis.summary,
      analysis.severity,
      analysis.priority,
      analysis.category,
      analysis.confidence_score,
      analysis.recommended_action,
      analysis.model_name,
      JSON.stringify(raw)
    ]
  );

  const rows = await db.query('SELECT * FROM complaint_ai_analysis WHERE id = ? LIMIT 1', [result.insertId]);
  return toPublicAnalysis(rows[0]);
}

async function getLatestAnalysis(complaintPk) {
  const rows = await db.query(
    `SELECT * FROM complaint_ai_analysis WHERE complaint_pk = ? ORDER BY id DESC LIMIT 1`,
    [complaintPk]
  );
  return rows[0] ? toPublicAnalysis(rows[0]) : null;
}

async function getLatestAnalysisRow(complaintPk) {
  const rows = await db.query(
    `SELECT * FROM complaint_ai_analysis WHERE complaint_pk = ? ORDER BY id DESC LIMIT 1`,
    [complaintPk]
  );
  return rows[0] || null;
}

async function updateAnalysisDecision(row, { decision, edits, reviewer }) {
  let raw = {};
  try {
    raw = typeof row.raw_response === 'string' ? JSON.parse(row.raw_response) : (row.raw_response || {});
  } catch (error) {
    raw = {};
  }
  if (!raw.pharmqms) raw.pharmqms = {};
  raw.pharmqms.qa_decision = decision;
  raw.pharmqms.reviewed_by = reviewer ? { id: reviewer.id, name: reviewer.name } : null;
  raw.pharmqms.reviewed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const severity = edits && edits.severity ? clampSeverity(edits.severity, row.suggested_severity) : row.suggested_severity;
  const priority = edits && edits.priority ? clampPriority(edits.priority, row.suggested_priority) : row.suggested_priority;
  const category = edits && edits.category ? clampCategory(edits.category, row.suggested_category) : row.suggested_category;
  const summary = edits && edits.summary ? String(edits.summary).slice(0, 2000) : row.summary;
  const recommended = edits && edits.recommended_action ? String(edits.recommended_action).slice(0, 2000) : row.recommendations;
  if (edits && edits.suspected_issue) raw.pharmqms.suspected_issue = String(edits.suspected_issue).slice(0, 2000);
  if (edits && edits.patient_impact) raw.pharmqms.patient_impact = String(edits.patient_impact).slice(0, 2000);

  await db.query(
    `UPDATE complaint_ai_analysis
     SET suggested_severity = ?, suggested_priority = ?, suggested_category = ?, summary = ?, recommendations = ?, raw_response = ?
     WHERE id = ?`,
    [severity, priority, category, summary, recommended, JSON.stringify(raw), row.id]
  );

  const updated = await db.query('SELECT * FROM complaint_ai_analysis WHERE id = ? LIMIT 1', [row.id]);
  return toPublicAnalysis(updated[0]);
}

module.exports = {
  fallbackAnalyze,
  analyzeComplaint,
  saveAnalysis,
  getLatestAnalysis,
  getLatestAnalysisRow,
  updateAnalysisDecision,
  toPublicAnalysis
};
