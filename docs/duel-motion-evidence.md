# 1v1 motion evidence (experimental)

The Ready gesture requests browser motion permission when required; denied, missing or interrupted motion does not prevent a duel. Foreground motion timestamps are converted to the GPS epoch time base; invalid, late, pre-start or duplicate samples are not counted. A bounded local buffer is analyzed at the interpolated GPS finish, excluding post-finish samples. The existing live step counter and sprint cadence detector are separate: neither proves an actual step.

Only aggregate diagnostics leave the browser: sample count, coverage, gaps, optional sprint cadence, and consistency status. No raw IMU or GPS trace is transmitted by this feature. The staged SQL allowlist accepts the new bounded fields, but the production RPC has not been changed. All results remain unverified; consistent movement cannot prove identity, defeat a rhythmic phone shake or rule out vehicle use. No bans or rankings changes, no IMU-derived distance or time correction, no microphone, no UI redesign.

Field tests: iPhone Ready permission granted/denied, no sensor, phone in hand and pocket, screen lock, stationary and walking, straight 50/75/100 m with independent reference timing, GPS callback delay. Compare timestamps, coverage and cadence without publishing raw private data. The synthetic tests are not evidence of real sprint accuracy.
