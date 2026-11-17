import React, { useState } from 'react';
import {
  View, TouchableOpacity, Modal, StyleSheet, StyleProp, ViewStyle, ActivityIndicator,
} from 'react-native';
import AppText from './AppText';
import {
  NICO, TEXT_STYLE, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, BTN_SIZE, BTN_VARIANT, scale,
} from '../constants/theme';
import {
  ReportTarget, ReportReason, REPORT_REASONS, REPORT_TITLES, REPORT_THANKS,
  isReportedThisSession, showAlreadyReported, submitReport,
} from '../lib/reporting';

const ACCESSIBILITY_NOUN: Record<ReportTarget['area'], string> = {
  guardian_chat:    'guardian',
  discussion_post:  'post',
  discussion_reply: 'reply',
  event:            'event',
  guardian_profile: 'guardian',
};

type SheetState =
  | { step: 'form' }
  | { step: 'done'; title: string; message?: string };

/**
 * 🚩 report button — icon only, same size/look as the existing ✏️ / 🗑️ card actions.
 * Tapping opens a small report sheet: a single-select reason dropdown + Cancel / Report.
 * Dimmed once the item has been reported in this session; tapping a dimmed flag shows
 * "Already Reported". Callers must not render it on the guardian's own content.
 */
export default function ReportFlag({ target, style }: { target: ReportTarget; style?: StyleProp<ViewStyle> }) {
  const [reported, setReported]     = useState(() => isReportedThisSession(target));
  const [open, setOpen]             = useState(false);
  const [listOpen, setListOpen]     = useState(false);
  const [reason, setReason]         = useState<ReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed]         = useState(false);
  const [sheet, setSheet]           = useState<SheetState>({ step: 'form' });

  function onFlagPress() {
    if (reported) { showAlreadyReported(); return; }
    setReason(null); setListOpen(false); setFailed(false); setSheet({ step: 'form' });
    setOpen(true);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
  }

  async function onSubmit() {
    if (!reason || submitting) return;
    setSubmitting(true);
    setFailed(false);
    const result = await submitReport(target, reason);
    setSubmitting(false);
    if (result === 'reported') {
      setReported(true);
      setSheet({ step: 'done', title: 'Reported', message: REPORT_THANKS });
    } else if (result === 'already') {
      setReported(true);
      setSheet({ step: 'done', title: 'Already Reported' });
    } else {
      setFailed(true);   // stay on the form so they can try again
    }
  }

  const selectedLabel = REPORT_REASONS.find(r => r.key === reason)?.label;

  return (
    <>
      <TouchableOpacity
        style={[s.flagBtn, reported && s.dimmed, style]}
        // stopPropagation: the flag often sits on a tappable card
        onPress={e => { e.stopPropagation?.(); onFlagPress(); }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}   // 28 + 16 = 44pt touch area
        accessibilityRole="button"
        accessibilityLabel={reported ? 'Already reported' : `Report ${ACCESSIBILITY_NOUN[target.area]}`}
      >
        <AppText style={s.flagIcon}>🚩</AppText>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={close}>
          <View style={s.card} onStartShouldSetResponder={() => true}>
            {sheet.step === 'form' ? (
              <>
                <AppText style={s.title}>{REPORT_TITLES[target.area]}</AppText>
                <AppText style={s.sub}>Choose a reason. Our team will review it.</AppText>

                {/* Single-select dropdown (inline, like the category dropdowns) */}
                <TouchableOpacity
                  style={[s.dropdown, listOpen && s.dropdownOpen]}
                  onPress={() => setListOpen(o => !o)}
                  disabled={submitting}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={selectedLabel ? `Reason: ${selectedLabel}` : 'Select a reason'}
                >
                  <AppText style={[s.dropdownText, !selectedLabel && s.placeholder]}>
                    {selectedLabel ?? 'Select a reason'}
                  </AppText>
                  <AppText style={s.chevron}>{listOpen ? '▴' : '▾'}</AppText>
                </TouchableOpacity>
                {listOpen && (
                  <View style={s.list}>
                    {REPORT_REASONS.map((r, i) => (
                      <TouchableOpacity
                        key={r.key}
                        style={[s.option, i < REPORT_REASONS.length - 1 && s.optionBorder, reason === r.key && s.optionSelected]}
                        onPress={() => { setReason(r.key); setListOpen(false); setFailed(false); }}
                      >
                        <AppText style={[s.optionText, reason === r.key && s.optionTextSelected]}>{r.label}</AppText>
                        {reason === r.key && <AppText style={s.check}>✓</AppText>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {failed && <AppText style={s.error}>Couldn't send the report. Please try again.</AppText>}

                <View style={s.btnRow}>
                  <TouchableOpacity style={[s.btn, s.btnOutline]} onPress={close} disabled={submitting}>
                    <AppText style={s.btnOutlineText}>Cancel</AppText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.btnPrimary, (!reason || submitting) && s.btnDisabled]}
                    onPress={onSubmit}
                    disabled={!reason || submitting}
                  >
                    {submitting
                      ? <ActivityIndicator size="small" color={NICO.textOnAccent} />
                      : <AppText style={s.btnPrimaryText}>Report</AppText>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <AppText style={s.title}>{sheet.title}</AppText>
                {sheet.message && <AppText style={s.sub}>{sheet.message}</AppText>}
                <TouchableOpacity style={[s.btn, s.btnPrimary, s.btnSingle]} onPress={close}>
                  <AppText style={s.btnPrimaryText}>OK</AppText>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  // 🚩 button — matches the ✏️ / 🗑️ card action buttons
  flagBtn: {
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: NICO.primaryLight, justifyContent: 'center', alignItems: 'center',
  },
  dimmed:   { opacity: 0.35 },
  flagIcon: { fontSize: scale(14) },

  // Report sheet (centered card, like the Guardian Mode PIN card)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: {
    width: '100%', maxWidth: 420,
    backgroundColor: NICO.surface, borderRadius: RADIUS['2xl'],
    padding: SPACING.lg, gap: SPACING.md,
  },
  title: { ...TEXT_STYLE.modalTitle, textAlign: 'center' },
  sub:   { fontSize: FONT_SIZE.md, color: NICO.textMuted, textAlign: 'center', lineHeight: 20 },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: NICO.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  dropdownOpen: { borderColor: NICO.primary },
  dropdownText: { fontSize: FONT_SIZE.lg, color: NICO.text },
  placeholder:  { color: NICO.textMuted },
  chevron:      { fontSize: FONT_SIZE.md, color: NICO.textMuted },

  list: { borderWidth: 1, borderColor: NICO.border, borderRadius: RADIUS.md, overflow: 'hidden', marginTop: -SPACING.sm },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
  },
  optionBorder:       { borderBottomWidth: 1, borderBottomColor: NICO.border },
  optionSelected:     { backgroundColor: NICO.primaryLight },
  optionText:         { fontSize: FONT_SIZE.lg, color: NICO.text },
  optionTextSelected: { color: NICO.primary, fontWeight: FONT_WEIGHT.semiBold },
  check:              { fontSize: FONT_SIZE.lg, color: NICO.primary, fontWeight: FONT_WEIGHT.bold },

  error: { fontSize: FONT_SIZE.sm, color: NICO.error, textAlign: 'center' },

  btnRow:         { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  btn:            { ...BTN_SIZE.md, flex: 1 },
  btnSingle:      { flex: 0, alignSelf: 'center', minWidth: scale(140) },
  btnPrimary:     { ...BTN_VARIANT.primary },
  btnOutline:     { ...BTN_VARIANT.outline },
  btnDisabled:    { opacity: 0.5 },
  btnPrimaryText: { color: NICO.textOnAccent, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
  btnOutlineText: { color: NICO.primary, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
});
