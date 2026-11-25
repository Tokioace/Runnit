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
        CAPPluginMethod(name: "stopProbe", returnType: CAPPluginReturnPromise)
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

    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,
            object: nil, queue: .main) { [weak self] _ in self?.finish("interrupted") }
    }
    deinit {
        if let observer = observer { NotificationCenter.default.removeObserver(observer) }
        timer?.invalidate()
        motion.stopDeviceMotionUpdates()
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
        return result
    }
    private func finish(_ reason: String) {
        guard status == "running" else { return }
        elapsed = ProcessInfo.processInfo.systemUptime - started
        status = reason
        timer?.invalidate(); timer = nil
        gps.stopUpdatingLocation()
        motion.stopDeviceMotionUpdates()
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
                    if error != nil { self.finish("sensor-error"); return }
                    guard let data = data, data.timestamp.isFinite, data.timestamp >= self.started,
                          data.timestamp <= ProcessInfo.processInfo.systemUptime else { return }
                    if let prior = self.lastMotion {
                        guard data.timestamp > prior else { return }
                        if data.timestamp - prior > 0.25 { self.motionGaps += 1 }
                    }
                    self.lastMotion = data.timestamp
                    self.motionSamples += 1
                }
            }
            self.timer = Timer.scheduledTimer(withTimeInterval: 30, repeats: false) { [weak self] _ in
                self?.finish("completed")
            }
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
        for fix in locations {
            let age = Date().timeIntervalSince(fix.timestamp)
            guard fix.timestamp >= startedWall, age >= 0, age <= 3,
                  fix.horizontalAccuracy.isFinite, fix.horizontalAccuracy >= 0 else {
                rejected += 1; continue
            }
            fixes += 1
            accuracy = fix.horizontalAccuracy
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
