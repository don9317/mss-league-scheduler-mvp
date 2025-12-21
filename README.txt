League Scheduler MVP v5

Run:
- Unzip and open index.html in Chrome.
- Optional local server:
    python -m http.server 8000
  then visit http://localhost:8000

What’s new in v5:
- Divisions are Gender + Grade + Skill (Open/Rec)
- CSV upload + template download
- Operator settings: courts used (1–4), days of week, start/end times (start on :00 or :30), season start date
- Global exception (blackout) dates
- Minimum games per team (best-effort) with warnings if capacity is insufficient
- Schedule list with score entry; standings update (W/L, PF/PA, Point Differential)
- Export schedule to CSV
- Saves to localStorage

CSV format:
Team Name,Gender,Grade,Skill
Thunder,Boys,5th,Open
Lightning,Girls,3rd/4th,Rec
