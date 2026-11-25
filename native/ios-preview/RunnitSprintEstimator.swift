import Foundation

// Pure estimator. No Core Location, I/O, network or persistence. All durations
// are seconds relative to the manually armed start; distance is displacement.
struct RunnitSprintEstimator {
    let targetM: Double
    private(set) var distanceM = 0.0
    private(set) var accepted = 0
    private(set) var rejected = 0
    private(set) var finishSeconds: Double?
    private(set) var invalid = false
    private var previousSeconds: Double
    private var crossing: Double?
    private var beyond = 0

    init?(targetM: Int, anchorSeconds: Double) {
        guard [50, 75, 100].contains(targetM), anchorSeconds.isFinite,
              anchorSeconds >= -3, anchorSeconds <= 0 else { return nil }
        self.targetM = Double(targetM)
        self.previousSeconds = anchorSeconds
    }

    // Returns true only when this fix becomes the new accepted anchor-relative sample.
    mutating func accept(seconds: Double, displacementM: Double, segmentM: Double, accuracyM: Double) -> Bool {
        guard !invalid, finishSeconds == nil else { return false }
        guard seconds.isFinite, seconds >= 0, seconds <= 30, displacementM.isFinite,
              displacementM >= 0, segmentM.isFinite, segmentM >= 0,
              accuracyM.isFinite, accuracyM >= 0, accuracyM <= 15 else {
            rejected += 1; return false
        }
        let dt = seconds - previousSeconds
        guard dt >= 0.2 else { rejected += 1; return false }
        // A gap cannot support a trustworthy interpolated crossing.
        if dt > 3 { invalid = true; rejected += 1; return false }
        guard segmentM / dt <= 12 else { rejected += 1; return false }
        if displacementM >= targetM {
            beyond += 1
            if crossing == nil {
                let delta = displacementM - distanceM
                let fraction = delta > 0 ? min(1, max(0, (targetM - distanceM) / delta)) : 1
                crossing = max(0, previousSeconds + dt * fraction)
            }
            if beyond >= 2, let t = crossing, t > 0 { finishSeconds = t }
        } else {
            beyond = 0; crossing = nil
        }
        previousSeconds = seconds
        distanceM = displacementM
        accepted += 1
        return true
    }

    mutating func invalidate() { if finishSeconds == nil { invalid = true } }
}
