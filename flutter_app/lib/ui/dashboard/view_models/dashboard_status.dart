/// What the news dashboard shows below the source chips.
enum DashboardStatus {
  loading,
  error,

  /// Every source is down: no chips, one notice (web `DashboardPage`).
  allUnavailable,

  /// The selected source is down.
  sourceUnavailable,
  empty,
  ready,
}
