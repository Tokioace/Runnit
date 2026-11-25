import Foundation
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if !condition() { fatalError(message) }
}
check(RunnitSprintEstimator(targetM: 10, anchorSeconds: 0) == nil, "unsupported distance")
check(RunnitSprintEstimator(targetM: 50, anchorSeconds: -4) == nil, "stale anchor")
for target in [50,75,100] {
    var run = RunnitSprintEstimator(targetM: target, anchorSeconds: 0)!
    for i in 1...(target/5) { check(run.accept(seconds: Double(i), displacementM: Double(i*5), segmentM: 5, accuracyM: 3), "valid fix") }
    check(run.finishSeconds == nil, "one beyond is insufficient")
    let time = Double(target/5)
    check(run.accept(seconds: time+1, displacementM: Double(target)+5, segmentM: 5, accuracyM: 3), "confirmation")
    check(abs((run.finishSeconds ?? -1)-time)<0.001, "finish must use first crossing")
}
var run = RunnitSprintEstimator(targetM: 50, anchorSeconds: 0)!
check(!run.accept(seconds: 1, displacementM: 100, segmentM: 100, accuracyM: 3), "jump rejected")
check(!run.accept(seconds: 1, displacementM: 5, segmentM: 5, accuracyM: 20), "poor accuracy rejected")
check(run.accept(seconds: 1, displacementM: 5, segmentM: 5, accuracyM: 3), "rejections did not replace prior")
check(!run.accept(seconds: 1, displacementM: 6, segmentM: 1, accuracyM: 3), "duplicate rejected")
check(!run.accept(seconds: 5, displacementM: 20, segmentM: 15, accuracyM: 3), "gap rejected")
check(run.invalid && run.finishSeconds == nil, "gap invalidates")
var crossing = RunnitSprintEstimator(targetM: 50, anchorSeconds: 0)!
for i in 1...6 { check(crossing.accept(seconds: Double(i), displacementM: Double(i*8), segmentM: 8, accuracyM: 3), "approach") }
check(crossing.accept(seconds: 7, displacementM: 52, segmentM: 4, accuracyM: 3), "cross")
check(crossing.accept(seconds: 8, displacementM: 49, segmentM: 3, accuracyM: 3), "return below")
check(crossing.accept(seconds: 9, displacementM: 53, segmentM: 4, accuracyM: 3), "second crossing")
check(crossing.finishSeconds == nil, "crossing reset")
check(crossing.accept(seconds: 10, displacementM: 56, segmentM: 3, accuracyM: 3), "confirm")
check(abs((crossing.finishSeconds ?? -1)-8.25)<0.001, "interpolation")
print("Swift sprint estimator synthetic tests passed")

func syntheticMotion(_ period: Double, gap: Bool = false) -> RunnitMotionCapture {
    var capture = RunnitMotionCapture()
    for i in 0...500 {
        let t = Double(i) * 0.02
        if gap && t > 3 && t < 4 { continue }
        let phase = t.truncatingRemainder(dividingBy: period)
        let nearest = min(phase, period-phase)
        capture.push(time:t, magnitude:0.5 + 8 * exp(-pow(nearest/0.035,2)))
    }
    return capture
}
let running = syntheticMotion(0.3)
let rhythm = running.summarize(from: 0, through: 9)
check(rhythm.state == "sprint-like", "synthetic running rhythm")
check(abs((rhythm.cadence ?? 0)-200) < 1, "synthetic cadence")
let clipped = running.summarize(from: 2, through: 5)
check(clipped.candidates < rhythm.candidates && clipped.samples < rhythm.samples, "clip to actual sprint window")
check(clipped.candidates >= 8 && clipped.candidates <= 11, "window peak count")
let walking = syntheticMotion(0.6).summarize(from:0,through:9)
check(walking.state == "other-rhythm", "walking not sprint rhythm")
let missing = syntheticMotion(0.3,gap:true).summarize(from:0,through:9)
check(missing.gaps == 1 && missing.cadence == nil && missing.state == "incomplete", "no cadence over gap")
var stationary = RunnitMotionCapture()
for i in 0...200 { stationary.push(time:Double(i)*0.02,magnitude:0.1) }
stationary.push(time:4.1,magnitude:Double.nan)
stationary.push(time:3,magnitude:10)
let still = stationary.summarize(from:0,through:4)
check(still.candidates == 0 && still.cadence == nil && still.samples == 201, "invalid and stationary samples")
print("Swift motion candidate synthetic tests passed")
