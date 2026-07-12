/**
 * CharacterSummaryCalculator.gs
 * Handles conversion of SAHABAT indicators to FITRAH character values.
 */

/**
 * Calculates FITRAH scores from SAHABAT sums and counts.
 * R = average of SSS and HB
 * I = average of AM
 * T = average of BR
 * F = average of ASM
 * A = average of AK
 * H = average of TM
 * @param {Object} sumCountObj - Object containing sums and counts.
 * @returns {Object} FITRAH scores (f_score, i_score, t_score, r_score, a_score, h_score).
 */
function calculateFitrahScores(sumCountObj) {
  var sss_sum = sumCountObj.sss_sum || 0;
  var sss_count = sumCountObj.sss_count || 0;
  var am_sum = sumCountObj.am_sum || 0;
  var am_count = sumCountObj.am_count || 0;
  var hb_sum = sumCountObj.hb_sum || 0;
  var hb_count = sumCountObj.hb_count || 0;
  var asm_sum = sumCountObj.asm_sum || 0;
  var asm_count = sumCountObj.asm_count || 0;
  var br_sum = sumCountObj.br_sum || 0;
  var br_count = sumCountObj.br_count || 0;
  var ak_sum = sumCountObj.ak_sum || 0;
  var ak_count = sumCountObj.ak_count || 0;
  var tm_sum = sumCountObj.tm_sum || 0;
  var tm_count = sumCountObj.tm_count || 0;

  var f = asm_count > 0 ? Number((asm_sum / asm_count).toFixed(2)) : null;
  var i = am_count > 0 ? Number((am_sum / am_count).toFixed(2)) : null;
  var t = br_count > 0 ? Number((br_sum / br_count).toFixed(2)) : null;
  var a = ak_count > 0 ? Number((ak_sum / ak_count).toFixed(2)) : null;
  var h = tm_count > 0 ? Number((tm_sum / tm_count).toFixed(2)) : null;
  
  var r_denom = sss_count + hb_count;
  var r = r_denom > 0 ? Number(((sss_sum + hb_sum) / r_denom).toFixed(2)) : null;

  return {
    f_score: f,
    i_score: i,
    t_score: t,
    r_score: r,
    a_score: a,
    h_score: h
  };
}

/**
 * Gets week start and end dates (Monday - Sunday) for a given date string.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Object} { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
function getWeekRange(dateStr) {
  var parts = dateStr.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0);
  var day = d.getDay();
  // Adjust so Monday is day 1, Sunday is day 7
  var diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  var monday = new Date(d.setDate(diffToMonday));
  var sunday = new Date(d.setDate(monday.getDate() + 6));
  
  return {
    start: formatDateString(monday),
    end: formatDateString(sunday)
  };
}

/**
 * Formats a Date object to YYYY-MM-DD.
 */
function formatDateString(date) {
  var yyyy = date.getFullYear();
  var mm = String(date.getMonth() + 1);
  if (mm.length < 2) mm = '0' + mm;
  var dd = String(date.getDate());
  if (dd.length < 2) dd = '0' + dd;
  return yyyy + '-' + mm + '-' + dd;
}

/**
 * Normalizes a date value (string or Date object) to YYYY-MM-DD.
 * @param {Date|string} value
 * @returns {string} YYYY-MM-DD
 */
function normalizeDateString(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return formatDateString(value);
  }
  if (typeof value === 'string') {
    var match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return match[1] + '-' + match[2] + '-' + match[3];
    }
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return formatDateString(parsed);
    }
  }
  return String(value);
}
