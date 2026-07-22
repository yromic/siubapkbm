# Enterprise UX Prioritization & Scoring Model

This model establishes an objective, quantitative algorithm for scoring and prioritizing UX heuristic findings. It balances user friction against business risk, occurrence frequency, development cost, and potential technical regression.

---

## 1. Prioritization Dimensions & Weights

Each finding is evaluated across 5 core dimensions on a 1 – 5 scale:

| Dimension | Abbr. | Weight | Description |
| :--- | :---: | :---: | :--- |
| **User Impact** | **UI** | 35% | Degree of task friction, cognitive load, or data risk caused to the end user |
| **Business Impact** | **BI** | 25% | Financial, legal, operational, or support overhead caused to the enterprise |
| **Frequency** | **FREQ**| 20% | How often users encounter this specific screen, component, or workflow |
| **Implementation Effort**| **EFF** | 10% | Estimated development complexity to resolve the issue (1 = trivial, 5 = massive) |
| **Regression Risk** | **REG** | 10% | Likelihood that fixing this issue will break adjacent features or API contracts |

---

## 2. Dimensional Scoring Rules

### User Impact (UI) — 1 to 5
- **5 (Critical)**: Task completion blocked; potential data loss.
- **4 (High)**: Major friction; workaround required.
- **3 (Medium)**: Moderate inefficiency; extra clicks.
- **2 (Low)**: Minor annoyance; slight visual flaw.
- **1 (Negligible)**: Minimal visual discrepancy.

### Business Impact (BI) — 1 to 5
- **5 (Critical)**: Direct compliance violation, security breach, or operational halt.
- **4 (High)**: Increased support ticket volume; high user training costs.
- **3 (Medium)**: Decreased operator throughput over time.
- **2 (Low)**: Slight brand/quality perception defect.
- **1 (Negligible)**: Zero operational impact.

### Frequency (FREQ) — 1 to 5
- **5 (Constant)**: Experienced every login session or on every primary dashboard.
- **4 (Frequent)**: Experienced daily by core administrative personas.
- **3 (Moderate)**: Experienced weekly during specific workflows.
- **2 (Rare)**: Experienced monthly during period transitions or setups.
- **1 (Isolated)**: Edge case experienced only under rare filter combinations.

### Implementation Effort (EFF) — 1 to 5 (Inverted Weight in Score)
- **1 (Trivial)**: CSS tweak, text string change, tooltip addition (< 2 hours).
- **2 (Low)**: Component prop adjustment, simple state handle (1 day).
- **3 (Medium)**: Component redesign, modal flow rework (2-3 days).
- **4 (High)**: Full page layout overhaul, multi-state refactor (1 sprint).
- **5 (Massive)**: Architectural design system overhaul, API schema changes (> 1 sprint).

### Regression Risk (REG) — 1 to 5 (Inverted Weight in Score)
- **1 (None)**: Isolated UI component change with no global impact.
- **2 (Low)**: Localized form adjustment.
- **3 (Medium)**: Shared component change used across 3-5 screens.
- **4 (High)**: Core layout or middleware state management change.
- **5 (Critical)**: Fundamental routing, state context, or API wrapper refactor.

---

## 3. Priority Score Formula

$$\text{Priority Score} = (\text{UI} \times 0.35) + (\text{BI} \times 0.25) + (\text{FREQ} \times 0.20) + ((6 - \text{EFF}) \times 0.10) + ((6 - \text{REG}) \times 0.10)$$

*Note: Implementation Effort and Regression Risk are inverted $(6 - \text{Value})$ so that lower effort and lower regression risk yield a HIGHER priority score.*

---

## 4. Prioritization Matrix & Action Tiers

```
   Priority Score
   ┌─────────────────────────────────────────────────────────────┐
   │ 4.20 – 5.00  │ TIER 1: IMMEDIATE QUICK WIN / HOTFIX         │
   ├──────────────┼──────────────────────────────────────────────┤
   │ 3.40 – 4.19  │ TIER 2: HIGH PRIORITY (NEXT SPRINT)          │
   ├──────────────┼──────────────────────────────────────────────┤
   │ 2.50 – 3.39  │ TIER 3: SCHEDULED BACKLOG                    │
   ├──────────────┼──────────────────────────────────────────────┤
   │ 1.00 – 2.49  │ TIER 4: LOW PRIORITY / DEFERRED              │
   └─────────────────────────────────────────────────────────────┘
```

### Action Tier Definitions:
1. **Tier 1 (Immediate Quick Win / Hotfix)**: High user impact, low effort, low risk. Must be deployed immediately.
2. **Tier 2 (High Priority - Next Sprint)**: High user/business impact, moderate effort. Scheduled for the upcoming development cycle.
3. **Tier 3 (Scheduled Backlog)**: Medium impact items. Groomed and assigned to feature sprints.
4. **Tier 4 (Low Priority / Deferred)**: Low impact, high effort or cosmetic items. Maintained in design debt backlog.
