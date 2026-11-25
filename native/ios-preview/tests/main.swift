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
