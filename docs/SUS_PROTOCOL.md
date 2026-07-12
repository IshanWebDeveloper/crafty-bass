# Usability testing protocol (System Usability Scale)

A repeatable protocol for evaluating Crafty Bass usability with real homeowners
and tradesmen, producing a comparable System Usability Scale (SUS) score.

## Participants

- **n ≥ 10**, split across both roles (target ≥ 5 homeowners and ≥ 5 tradesmen).
- Recruited to roughly reflect the target users (a range of ages and comfort
  with technology; include at least two participants who prefer Sinhala or Tamil).
- No participant who has worked on the codebase.

## Consent & anonymisation

- Each participant reads a one-page information sheet and signs a consent form
  before starting; participation is voluntary and can stop at any time.
- Sessions are identified by a code (`P01`, `P02`, …), never by name. No
  personally identifying data is stored with the results. Any recording (screen
  or audio) is optional, consented separately, and deleted after analysis.

## Fixed task script

Every participant attempts the same tasks for their role, read verbatim.

**Homeowner**

1. Create an account and sign in.
2. Post a job for a leaking kitchen tap (title, description, location).
3. Find your posted job and open its detail page.
4. Review the quote(s) received and accept one.
5. Open the deposit funding page for the accepted quote.

**Tradesman**

1. Create an account and complete your profile (add at least one skill).
2. Browse open jobs and open one that matches your trade.
3. Submit a quote with line items and (optionally) a materials deposit.
4. Find the job once it is assigned to you and mark materials released.

The facilitator does not help unless the participant is fully blocked; brief
hints after 90 s of being stuck are recorded as friction.

## Measures captured per task

- **Task success**: completed unaided / completed with a hint / not completed.
- **Time on task** (seconds).
- **Friction notes**: errors, wrong turns, confusion, verbatim quotes.

## SUS questionnaire (post-session)

The standard 10 items, rated 1 (strongly disagree) – 5 (strongly agree):

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

## Scoring (0–100)

- Odd items: contribution = (response − 1).
- Even items: contribution = (5 − response).
- Sum the 10 contributions and multiply by 2.5 → SUS score in 0–100.
- Report the **mean** SUS across participants, plus per-role means and the range.

**Target: mean SUS ≥ 70** (a score of ~68 is the industry average; ≥ 70 is
"good"). Scores below target are triaged against the friction notes to prioritise
fixes.

## Reporting

For each round, record: participant count and role split, per-task success rate
and median time, the SUS mean/range (overall and per role), and the top friction
themes with representative quotes. Keep the raw per-participant scores in an
anonymised sheet so results are reproducible.
