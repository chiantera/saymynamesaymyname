# Screens

Home owns presentation of the private check-in, saved reflections and day band.
`DayBand.tsx` renders the pure model from `../day-band.ts`; the parent supplies time
and real records. LocalRelationships is fictional-preview only. SettingsScreen
composes preference controls and cloud sections without granting new access.
Growth and Bartender describe planned functionality; neither calls a provider.

Data writes and check-in version guards stay in App or the guarded cloud modules.
All copy goes through the seven shared catalogs. Follow ../../DESIGN.md and keep
the accessible names and classes required by browser tests.
