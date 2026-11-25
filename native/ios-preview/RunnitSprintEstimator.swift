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


// Experimental motion peaks, not verified steps. No raw samples leave this
// in-memory, bounded capture. Analyze the exact selected measurement window.
struct RunnitMotionSummary {
    let candidates: Int
    let samples: Int
    let gaps: Int
    let coverage: Double
    let cadence: Double?
    let state: String
}
struct RunnitMotionCapture {
    private struct Sample {
        let t: Double
        let magnitude: Double
    }
    private var samples: [Sample] = []
    private var truncated = false
    mutating func push(time: Double, magnitude: Double) {
        guard time.isFinite, magnitude.isFinite, magnitude >= 0, magnitude < 200,
              samples.last.map({ time > $0.t }) ?? true else { return }
        guard samples.count < 3000 else { truncated = true; return }
        samples.append(Sample(t: time, magnitude: magnitude))
    }
    private func median(_ values: [Double]) -> Double {
        let sorted = values.sorted()
        let i = sorted.count / 2
        return sorted.count % 2 == 1 ? sorted[i] : (sorted[i-1] + sorted[i]) / 2
    }
    func summarize(from start: Double, through end: Double) -> RunnitMotionSummary {
        let valid = samples.filter { $0.t >= start && $0.t <= end }
        let duration = end - start
        var gaps = 0, segment = 0
        var segments: [Int] = []
        var observed = 0.0
        for i in valid.indices {
            if i > 0 {
                let dt = valid[i].t - valid[i-1].t
                if dt > 0.25 { gaps += 1; segment += 1 }
                else { observed += dt }
            }
            segments.append(segment)
        }
        let coverage = duration.isFinite && duration > 0 ? min(1, observed / duration) : 0
        var peaks: [(t: Double, segment: Int)] = []
        if valid.count >= 3 {
            for i in 1..<(valid.count - 1) {
                let p = valid[i]
                guard segments[i-1] == segments[i], segments[i+1] == segments[i],
                      p.magnitude >= 4, p.magnitude > valid[i-1].magnitude,
                      p.magnitude >= valid[i+1].magnitude else { continue }
                var left = p.magnitude, right = p.magnitude
                var j = i-1
                while j >= 0 && segments[j] == segments[i] && p.t-valid[j].t <= 0.11 {
                    left = min(left, valid[j].magnitude); j -= 1
                }
                j = i+1
                while j < valid.count && segments[j] == segments[i] && valid[j].t-p.t <= 0.11 {
                    right = min(right, valid[j].magnitude); j += 1
                }
                guard p.magnitude - max(left,right) >= 1.8 else { continue }
                if let last = peaks.last, last.segment == segments[i], p.t-last.t < 0.19 { continue }
                peaks.append((p.t, segments[i]))
            }
        }
        func result(_ state: String, _ cadence: Double? = nil) -> RunnitMotionSummary {
            RunnitMotionSummary(candidates: peaks.count, samples: valid.count, gaps: gaps,
                coverage: coverage, cadence: cadence, state: state)
        }
        guard !truncated, duration >= 1, coverage >= 0.7, gaps == 0, valid.count >= 10 else { return result("incomplete") }
        let latest = Array(peaks.suffix(10))
        guard latest.count >= 6 else { return result("insufficient") }
        let intervals = (1..<latest.count).map { latest[$0].t - latest[$0-1].t }
        let typical = median(intervals)
        let variation = median(intervals.map { abs($0-typical) }) / typical
        guard typical > 0, variation.isFinite, variation <= 0.2 else { return result("irregular") }
        let cadence = 60 / typical
        guard cadence.isFinite, cadence > 0, cadence <= 320 else { return result("irregular") }
        return result(cadence >= 140 && cadence <= 300 ? "sprint-like" : "other-rhythm", cadence)
    }
}
