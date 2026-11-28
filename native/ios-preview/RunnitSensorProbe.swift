// Foreground-only diagnostic: no coordinates or raw motion samples leave native code.
import Foundation
import UIKit
import CoreLocation
import CoreMotion
import Capacitor

@objc(RunnitSensorProbe)
public class RunnitSensorProbe: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "RunnitSensorProbe"
    public let jsName = "RunnitSensorProbe"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startProbe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readProbe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "armSprint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopProbe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "previewPing", returnType: CAPPluginReturnPromise)
    ]
    private lazy var gps = CLLocationManager()
    private let motion = CMMotionManager()
    private var timer: Timer?
    private var runID: String?
    private var started = 0.0
    private var startedWall = Date.distantPast
    private var elapsed = 0.0
    private var status = "idle"
    private var fixes = 0
    private var rejected = 0
    private var accuracy: Double?
    private var motionSamples = 0
    private var motionGaps = 0
    private var lastMotion: Double?
    private var motionAvailable = false
    private var observer: NSObjectProtocol?
    private var sceneObserver: NSObjectProtocol?
    private var latestGoodFix: CLLocation?
    private var sprintAnchor: CLLocation?
    private var sprintPrevious: CLLocation?
    private var sprintStart: Date?
    private var sprintUptime: Double?
    private var sprint: RunnitSprintEstimator?
    private var motionCapture = RunnitMotionCapture()
    private var finalMotion: RunnitMotionSummary?

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
            object: nil, queue: .main) { [weak self] _ in self?.finish("interrupted") }
        // UIScene can deactivate without the legacy application callback.
        // Conservative: stop for any scene deactivation, never continue capture.
        sceneObserver = NotificationCenter.default.addObserver(forName: UIScene.willDeactivateNotification,
            object: nil, queue: .main) { [weak self] _ in self?.finish("interrupted") }
    }
    deinit {
        if let observer = observer { NotificationCenter.default.removeObserver(observer) }
        if let sceneObserver = sceneObserver { NotificationCenter.default.removeObserver(sceneObserver) }
        timer?.invalidate()
        motion.stopDeviceMotionUpdates()
    }
    private func motionSummary() -> RunnitMotionSummary {
        let start = sprintUptime ?? started
        let end = sprintUptime.flatMap { t in sprint?.finishSeconds.map { t + $0 } }
            ?? min(started + 30, started + elapsed)
        return motionCapture.summarize(from: start, through: end)
    }
    private func report() -> [String: Any] {
        var result: [String: Any] = [
            "runId": runID ?? "", "status": status,
            "elapsedMs": min(30000, max(0, elapsed * 1000)),
            "gpsFixes": fixes, "rejectedFixes": rejected,
            "motionSamples": motionSamples, "motionGaps": motionGaps,
            "motionAvailable": motionAvailable
        ]
        if let accuracy = accuracy { result["accuracyM"] = accuracy }
        else { result["accuracyM"] = NSNull() }
        if let sprint = sprint {
            var metrics: [String: Any] = ["targetM": sprint.targetM, "distanceM": sprint.distanceM,
                "accepted": sprint.accepted, "rejected": sprint.rejected, "invalid": sprint.invalid]
            if let time = sprint.finishSeconds { metrics["finishMs"] = time * 1000 }
            else { metrics["finishMs"] = NSNull() }
            result["sprint"] = metrics
        }
        let summary = finalMotion ?? motionSummary()
        var motionMetrics: [String: Any] = ["candidates": summary.candidates, "samples": summary.samples,
            "gaps": summary.gaps, "coverage": summary.coverage, "state": summary.state,
            "window": sprint == nil ? "probe" : "sprint"]
        if let cadence = summary.cadence { motionMetrics["cadenceSpm"] = cadence }
        else { motionMetrics["cadenceSpm"] = NSNull() }
        result["motionAnalysis"] = motionMetrics
        return result
    }
    private func finish(_ reason: String) {
        guard status == "running" else { return }
        elapsed = ProcessInfo.processInfo.systemUptime - started
        status = reason
        finalMotion = motionSummary()
        motionCapture = RunnitMotionCapture()
        timer?.invalidate(); timer = nil
        gps.stopUpdatingLocation()
        motion.stopDeviceMotionUpdates()
        latestGoodFix = nil; sprintAnchor = nil; sprintPrevious = nil
        sprintStart = nil; sprintUptime = nil
    }
    @objc public func previewPing(_ call: CAPPluginCall) {
        RunnitPreviewSmoke.trace("sensor ping")
        guard RunnitPreviewSmoke.nonce() != nil else { call.reject("Preview smoke disabled"); return }
        // Intentionally do not access CLLocationManager or motion permissions.
        call.resolve(["ready": true])
    }

    @objc public func startProbe(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIApplication.shared.applicationState == .active else {
                call.reject("Probe requires foreground"); return
            }
            guard self.status != "running" else { call.reject("Probe already running"); return }
            self.gps.delegate = self
            switch self.gps.authorizationStatus {
            case .notDetermined:
                self.gps.requestWhenInUseAuthorization()
                call.resolve(["status": "permission-requested"]); return
            case .authorizedAlways, .authorizedWhenInUse: break
            default: call.resolve(["status": "permission-denied"]); return
            }
            self.runID = UUID().uuidString.lowercased()
            let currentID = self.runID
            self.started = ProcessInfo.processInfo.systemUptime
            self.startedWall = Date()
            self.elapsed = 0; self.fixes = 0; self.rejected = 0; self.accuracy = nil
            self.motionSamples = 0; self.motionGaps = 0; self.lastMotion = nil
            self.motionCapture = RunnitMotionCapture(); self.finalMotion = nil
            self.latestGoodFix = nil; self.sprintAnchor = nil; self.sprintPrevious = nil
            self.sprintStart = nil; self.sprintUptime = nil; self.sprint = nil
            self.motionAvailable = self.motion.isDeviceMotionAvailable
            self.status = "running"
            self.gps.desiredAccuracy = kCLLocationAccuracyBest
            self.gps.distanceFilter = kCLDistanceFilterNone
            self.gps.allowsBackgroundLocationUpdates = false
            self.gps.startUpdatingLocation()
            if self.motionAvailable {
                self.motion.deviceMotionUpdateInterval = 0.02
                self.motion.startDeviceMotionUpdates(to: .main) { [weak self] data, error in
                    guard let self = self, self.status == "running", self.runID == currentID else { return }
                    if ProcessInfo.processInfo.systemUptime - self.started >= 30 { self.finish("completed"); return }
                    if error != nil { self.finish("sensor-error"); return }
                    guard let data = data, data.timestamp.isFinite, data.timestamp >= self.started,
                          data.timestamp <= ProcessInfo.processInfo.systemUptime else { return }
                    if let prior = self.lastMotion {
                        guard data.timestamp > prior else { return }
                        if data.timestamp - prior > 0.25 { self.motionGaps += 1 }
                    }
                    self.lastMotion = data.timestamp
                    self.motionSamples += 1
                    // Core Motion userAcceleration is in g; convert to m/s².
                    let a = data.userAcceleration
                    let magnitude = sqrt(a.x*a.x + a.y*a.y + a.z*a.z) * 9.80665
                    self.motionCapture.push(time: data.timestamp, magnitude: magnitude)
                }
            }
            let deadline = Timer(timeInterval: 30, repeats: false) { [weak self] _ in
                self?.finish("completed")
            }
            self.timer = deadline
            RunLoop.main.add(deadline, forMode: .common)
            call.resolve(self.report())
        }
    }
    @objc public func armSprint(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("runId"), id == self.runID,
                  self.status == "running", self.sprint == nil,
                  UIApplication.shared.applicationState == .active,
                  let raw = call.getString("targetM"), let target = Int(raw),
                  let fix = self.latestGoodFix else { call.reject("Sprint not ready"); return }
            let now = Date()
            let uptime = ProcessInfo.processInfo.systemUptime
            let age = now.timeIntervalSince(fix.timestamp)
            guard age >= 0, age <= 3, uptime - self.started <= 15,
                  abs(now.timeIntervalSince(self.startedWall) - (uptime - self.started)) <= 1,
                  let estimator = RunnitSprintEstimator(targetM: target, anchorSeconds: -age)
            else { call.reject("Fresh GPS fix and remaining test time required"); return }
            self.sprint = estimator
            self.sprintAnchor = fix; self.sprintPrevious = fix
            self.sprintStart = now; self.sprintUptime = uptime
            call.resolve(self.report())
        }
    }
    @objc public func readProbe(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("runId"), id == self.runID else {
                call.reject("Unknown probe"); return
            }
            if self.status == "running" {
                self.elapsed = ProcessInfo.processInfo.systemUptime - self.started
                if self.elapsed >= 30 { self.finish("completed") }
            }
            call.resolve(self.report())
        }
    }
    @objc public func stopProbe(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let id = call.getString("runId"), id == self.runID else {
                call.reject("Unknown probe"); return
            }
            self.finish("stopped")
            call.resolve(self.report())
        }
    }
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard status == "running" else { return }
        if ProcessInfo.processInfo.systemUptime - started >= 30 { finish("completed"); return }
        for fix in locations {
            let age = Date().timeIntervalSince(fix.timestamp)
            guard fix.timestamp >= startedWall, age >= 0, age <= 3,
                  fix.horizontalAccuracy.isFinite, fix.horizontalAccuracy >= 0 else {
                rejected += 1; continue
            }
            fixes += 1
            accuracy = fix.horizontalAccuracy
            if fix.horizontalAccuracy <= 15 && (latestGoodFix == nil || fix.timestamp > latestGoodFix!.timestamp) {
                latestGoodFix = fix
            }
            if var measurement = sprint, let anchor = sprintAnchor, let previous = sprintPrevious,
               let start = sprintStart, let uptime = sprintUptime, measurement.finishSeconds == nil, !measurement.invalid {
                if abs(Date().timeIntervalSince(start) - (ProcessInfo.processInfo.systemUptime - uptime)) > 1 {
                    measurement.invalidate(); sprint = measurement; finish("sensor-error"); return
                }
                let accepted = measurement.accept(seconds: fix.timestamp.timeIntervalSince(start),
                    displacementM: fix.distance(from: anchor), segmentM: fix.distance(from: previous),
                    accuracyM: fix.horizontalAccuracy)
                sprint = measurement
                if accepted { sprintPrevious = fix }
                if measurement.invalid { finish("sensor-error"); return }
                if measurement.finishSeconds != nil { finish("completed"); return }
            }
        }
    }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if (error as? CLError)?.code == .locationUnknown { return }
        finish("sensor-error")
    }
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted {
            finish("sensor-error")
        }
    }
}
