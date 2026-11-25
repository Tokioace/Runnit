// App-local Capacitor bridge. Included in the generated SceneDelegate target.
import Foundation
import Security
import Capacitor

final class RunnitBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RunnitSessionVault())
        bridge?.registerPluginInstance(RunnitSensorProbe())
    }
}

@objc(RunnitSessionVault)
public class RunnitSessionVault: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RunnitSessionVault"
    public let jsName = "RunnitSessionVault"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeSession", returnType: CAPPluginReturnPromise)
    ]
    private let queue = DispatchQueue(label: "runnit.session.vault")
    private let service = (Bundle.main.bundleIdentifier ?? "runnit.preview") + ".auth.v1"
    private var prepared = false

    private func validKey(_ call: CAPPluginCall) -> String? {
        guard let key = call.getString("key"),
              key.range(of: #"^sb-[a-zA-Z0-9-]{1,100}-auth-token(-code-verifier|-user)?$"#, options: .regularExpression) != nil
        else { call.reject("Invalid auth storage key"); return nil }
        return key
    }
    private func query(_ key: String? = nil) -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrSynchronizable as String: false
        ]
        if let key = key { q[kSecAttrAccount as String] = key }
        return q
    }
    // Keychain may outlive an uninstall. A non-backed-up sandbox marker
    // prevents silently restoring a session from a previous installation.
    private func prepare() throws {
        if prepared { return }
        let fm = FileManager.default
        var folder = try fm.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                appropriateFor: nil, create: true).appendingPathComponent("RunnitAuth", isDirectory: true)
        try fm.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try folder.setResourceValues(values)
        let marker = folder.appendingPathComponent("installation-v1")
        if !fm.fileExists(atPath: marker.path) {
            let status = SecItemDelete(query() as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                throw NSError(domain: "RunnitSessionVault", code: Int(status))
            }
            try Data([1]).write(to: marker, options: .atomic)
        }
        prepared = true
    }

    @objc public func readSession(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        queue.async {
            do { try self.prepare() } catch { call.reject("Secure storage unavailable"); return }
            var q = self.query(key)
            q[kSecReturnData as String] = true
            q[kSecMatchLimit as String] = kSecMatchLimitOne
            var raw: CFTypeRef?
            let status = SecItemCopyMatching(q as CFDictionary, &raw)
            if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
            guard status == errSecSuccess, let data = raw as? Data,
                  let value = String(data: data, encoding: .utf8) else {
                call.reject("Secure storage read failed"); return
            }
            call.resolve(["value": value])
        }
    }
    @objc public func writeSession(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        guard let value = call.getString("value"), let data = value.data(using: .utf8),
              data.count <= 262144 else { call.reject("Invalid session value"); return }
        queue.async {
            do { try self.prepare() } catch { call.reject("Secure storage unavailable"); return }
            let q = self.query(key)
            let changes: [String: Any] = [
                kSecValueData as String: data,
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
            ]
            var status = SecItemUpdate(q as CFDictionary, changes as CFDictionary)
            if status == errSecItemNotFound {
                var item = q
                for (name, value) in changes { item[name] = value }
                status = SecItemAdd(item as CFDictionary, nil)
            }
            guard status == errSecSuccess else { call.reject("Secure storage write failed"); return }
            call.resolve()
        }
    }
    @objc public func removeSession(_ call: CAPPluginCall) {
        guard let key = validKey(call) else { return }
        queue.async {
            do { try self.prepare() } catch { call.reject("Secure storage unavailable"); return }
            let status = SecItemDelete(self.query(key) as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else {
                call.reject("Secure storage removal failed"); return
            }
            call.resolve()
        }
    }
}
