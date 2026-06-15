# Replace Network Infection with Phishing URL Detection

Replace the Network Infection simulation module with a new client-side Phishing URL Detection module. Also clean up various UI text and remove instructional/dev-facing content.

## Proposed Changes

### Phishing Detection Logic

#### [NEW] [phishing.ts](file:///x:/Threat%20Simulation/Threat-Simulation/src/utils/phishing.ts)

New utility file implementing rule-based phishing URL analysis. Includes:
- **`analyzeUrl(url: string): PhishingResult`** — main analysis function
- Checks: missing HTTPS, IP address presence, excessive URL length (>75 chars), suspicious keywords (`login`, `verify`, `account`, `secure`, `bank`, `password`, `update`, `confirm`), multiple subdomains (>3 dots in hostname), suspicious TLDs (`.xyz`, `.tk`, `.top`, `.click`, `.gq`)
- Returns a `PhishingResult` with: `score` (0–100), `verdict` (`Safe` / `Suspicious` / `Phishing`), and `reasons[]` array
- All analysis is client-side, no backend required
- Well-commented for presentation use

---

### Phishing Detector Component

#### [NEW] [PhishingDetector.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/PhishingDetector.tsx)

New React component replacing the Network Infection card. Features:
- URL text input with analyze button
- Animated circular risk gauge showing score 0–100
- Color-coded verdict badge (green = Safe, yellow = Suspicious, red = Phishing)
- Expandable list of flagged reasons with icons
- Educational cybersecurity disclaimer at the bottom
- Matches existing Card/design system style

---

### Risk Computation Update

#### [MODIFY] [risk.ts](file:///x:/Threat%20Simulation/Threat-Simulation/src/utils/risk.ts)

- Replace `infectionRisk` / `infectionPercent` / `infectionActive` with `phishingRisk` / `phishingScore` / `phishingActive`
- Replace `infectionRiskFromPercent()` with `phishingRiskFromScore()` — maps the 0–100 phishing score to a 0–100 risk contribution
- Update `RiskAssessment` and `RiskInputs` interfaces
- Adjust weights: Password 30%, DoS 40%, Phishing 30% (same weights, just renamed)

---

### Icons

#### [MODIFY] [Icons.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/Icons.tsx)

- Add `PhishingIcon` (a hook/fishing icon) for the phishing module card header

---

### Main App Update

#### [MODIFY] [App.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/App.tsx)

**Remove:**
- All Network Infection state (`network`, `nodeCountInput`, `thresholdInput`, `clickMode`) 
- All network interaction functions (`onNodeClick`, `stepSpread`, `healAllNodes`, `clearAllNodes`, `infectRandom`, `rebuildNetwork`)
- The Network Infection `<Card>` block (lines 232–281)
- Network-related imports (`NetworkGraph`, `buildNetwork`, etc.)
- Unused icon imports (`VirusIcon`, `FirewallIcon`, `PlayIcon`, `RefreshIcon`, `HeartIcon`, `TrashIcon`)
- Helper components only used by Network Infection (`Legend`, `Stat`, `ModeBtn`, `FieldLabel`)

**Add:**
- Import `PhishingDetector` component
- Import `PhishingIcon`
- Phishing state: `phishingScore` (number, 0–100)
- New `<Card title="Phishing URL Detection">` with `<PhishingDetector>` inside

**Update:**
- Header subtitle: from `"Real DoS attack via Python script · SIR infection model · GPU password cracking"` → `"DoS Stress Testing · Password Strength Analysis · Phishing URL Detection"`
- Footer text: update to match new module list
- Risk computation call: replace `infectionPercent` with `phishingScore`
- `RiskBar` for infection → phishing
- `RiskFormula` label: `"Inf"` → `"Phish"`

---

### LiveAttackPanel Cleanup

#### [MODIFY] [LiveAttackPanel.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/LiveAttackPanel.tsx)

- **Remove** the `localhost:3001` `<code>` badge (lines 160–162)
- **Remove** the entire "How to Attack" instructions section (lines 236–258)
- Keep all live metrics, chart, and WebSocket connection functionality intact

---

## Files NOT Modified (No Changes Needed)

- [PasswordAnalyzer.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/PasswordAnalyzer.tsx) — untouched
- [ActivityLog.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/ActivityLog.tsx) — untouched  
- [index.css](file:///x:/Threat%20Simulation/Threat-Simulation/src/index.css) — untouched
- [Card.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/Card.tsx) — untouched

## Files to Consider Removing (Optional)

> [!NOTE]
> The following files are only used by the Network Infection module and will become dead code. They can be safely deleted, or kept for reference.

- [NetworkGraph.tsx](file:///x:/Threat%20Simulation/Threat-Simulation/src/components/NetworkGraph.tsx)
- [network.ts](file:///x:/Threat%20Simulation/Threat-Simulation/src/utils/network.ts)

---

## Verification Plan

### Manual Verification
- Run `npm run dev` and verify:
  1. Network Infection card is gone, Phishing URL Detection card is in its place
  2. Header subtitle and footer text are professional
  3. "How to Attack" section and `localhost:3001` badge are removed from DoS panel
  4. Phishing module: entering URLs produces correct scores, verdicts, and reason lists
  5. Risk gauge updates when phishing analysis runs
  6. Educational disclaimer is visible
  7. All three module cards are responsive and aligned
